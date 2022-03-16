const os = require('os')
const path = require('path')
const puppeteer = require('puppeteer-core')
const { IPCModule } = require('node-ipc')
const { localDb } = require('@mayahq/maya-db')

const KILL_TIMEOUT = 10 * 1000 // 10 seconds
// const KILL_TIMEOUT = 5 * 60 * 1000 // 10 seconds
const MINUTE = 60*1000

class PuppeteerControlServer {
    static version = 1

    constructor() {
        const mayaFolder = process.env.NODE_ENV === 'development' ? '.mayadev' : '.maya'
        this.mayaFolder = mayaFolder

        this.ipc = new IPCModule()
        this.ipc.config.silent = true
        this.db = localDb({
            root: path.join(os.homedir(), mayaFolder, 'db/browserAutomation')
        })
        this.db.ensureHierarchy({
            connections: 'BLOCK'
        })

        this.killTimer = null

        setInterval(() => {
            this._checkIntegrity()
        }, (5 * 1000))
    }

    async _checkIntegrity() {
        // console.log('Checking integrity')
        const connBlock = this.db.block('connections')
        await connBlock.acquireLock(async () => {
            const { killAt, connections } = await connBlock.get({
                connections: [],
                killAt: -2
            })

            if (killAt < 0) {
                return
            } else {
                if (Date.now() - killAt > 0) {
                    console.log('Actually killing browser process')
                    console.log('Stopped browser', Date.now())
                    await this._stopBrowser()
                    return await connBlock.update({
                        wsEndpoint: { $set: '' },
                        connections: { $set: [] },
                        killAt: { $set: -3 }
                    })
                }
            }

            // Remove all connections more than 10 minutes old
            const now = Date.now()
            const newConnections = connections.filter(c => now - c.created < 10 * MINUTE)
            const updates = {
                connections: { $set: newConnections }
            }
            await connBlock.update(updates)
        })

    }

    async _startBrowser(opts = {}) {
        const browser = await puppeteer.launch({
            headless: false,
            // userDataDir: '/Users/dushyant/Library/Application Support/Google/Chrome',
            defaultViewport: null,
            // executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            channel: 'chrome',
            ...opts,
        })
    
        const endpoint = browser.wsEndpoint()
        this.browserEndpoint = endpoint
        return endpoint
    }

    async _stopBrowser() {
        const browser = await puppeteer.connect({
            browserWSEndpoint: this.browserEndpoint
        })
        await browser.close()
        return true

        // try {
        // } catch (e) {
        //     console.log('Browser not running on given endpoint')
        //     return false
        // }
    }

    async _browserRunning(endpoint) {
        try {
            const browser = await puppeteer.connect({
                browserWSEndpoint: endpoint
            })
            return browser
        } catch (e) {
            return null
        }
    }

    async connect(connectionId, opts) {
        console.log(connectionId, '\nGot connection command')
        const connStore = this.db.block('connections')

        const wsEndpoint = await connStore.acquireLock(async () => {
            const result = await connStore.get({
                connections: [],
                wsEndpoint: '',
                headless: false
            })
            const connections = [...result.connections]
            connections.push({
                id: connectionId,
                created: Date.now()
            })

            // If browser already running, just return its endpoint
            console.log('Checking if browser running at ws endpoint', result.wsEndpoint)
            const pupInstance = await this._browserRunning(result.wsEndpoint)
            if (pupInstance) {
                console.log(connectionId, 'Browser already running')
                await connStore.update({
                    connections: { $set: connections },
                    killAt: { $set: -3 }
                })
                return result.wsEndpoint
            }

            // Otherwise start new browser process
            console.log(connectionId, 'Starting browser')
            const wsEndpoint = await this._startBrowser(opts)
            await connStore.update({ 
                connections: { $set: connections },
                wsEndpoint: { $set: wsEndpoint },
                killAt: { $set: -4 },
                headless: { $set: opts.headless }
            })
            return wsEndpoint
        })

        this.browserEndpoint = wsEndpoint
        return wsEndpoint
    }

    async disconnect(connectionId, opts) {
        console.log(connectionId, 'Got disconnection command', Date.now())
        const connStore = this.db.block('connections')

        await connStore.acquireLock(async () => {
            const result = await connStore.get({
                connections: [],
                wsEndpoint: '',
                headless: false
            })

            if (opts.force || !result.headless) {
                await this._stopBrowser()
                return await connStore.update({
                    connections: { $set: [] },
                    killAt: { $set: -5 }
                })
            }

            // If no connection with given ID found, nothing to be done.
            const connections = [...result.connections]
            if (!connections.some(c => c.id === connectionId)) {
                console.log(`No connection with id ${connectionId} found. Aborting.`)
                return
            }

            // If other connections are left after removing the current on,
            // do nothing
            const newConnections = connections.filter(c => c.id !== connectionId)
            if (newConnections.length > 0) {
                console.log(connectionId, 'Connections still left:', newConnections)
                const res = await connStore.update({
                    connections: { $set: newConnections }
                })
                return 
            }

            // Otherwise schedule the browser to close after some amount
            // (5 minutes, currently) of time            
            await connStore.update({
                connections: { $set: newConnections },
                killAt: { $set: Date.now() + KILL_TIMEOUT }
            })
            console.log(connectionId, `Will kill browser process after ${KILL_TIMEOUT/1000} seconds`)
            return
        })
    }
}

module.exports = PuppeteerControlServer