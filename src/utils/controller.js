const os = require('os')
const path = require('path')
const chromeLauncher = require('chrome-launcher')
const puppeteer = require('puppeteer-core')
const { IPCModule } = require('node-ipc')
const { localDb } = require('@mayahq/maya-db')

// const KILL_TIMEOUT = 5 * 60 * 1000 // 5 minutes
const KILL_TIMEOUT = 5 * 60 * 1000 // 10 seconds
const MINUTE = 60*1000

class PuppeteerControlServer {
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
        }, (10 * 1000))
    }

    async _checkIntegrity() {
        const connBlock = this.db.block('connections')
        await connBlock.acquireLock(async () => {
            const { killAt } = await connBlock.get({
                connections: [],
                killAt: -1
            })

            if (killAt < 0) {
                return
            } else {
                if (Date.now() - killAt > 0) {
                    console.log('Actually killing browser process')
                    await this._stopBrowser()
                    return await connBlock.update({
                        wsEndpoint: { $set: '' },
                        connections: { $set: [] },
                        killAt: { $set: -1 }
                    })
                }
            }

            // Remove all connections more than 10 minutes old
            const now = Date.now()
            const newConnections = connections.filter(c => now - c.created < 10 * MINUTE)
            const updates = {
                connections: { $set: newConnections }
            }
            if (newConnections.length === 0) {
                this._stopBrowser()
                updates.killAt = { $set: now - 1 }
                updates.wsEndpoint = { $set: '' }
            }
            await connBlock.update(updates)
        })

    }

    async _startBrowser(opts = {}) {
        console.log('######## WE STARTING', opts)
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
        try {
            const browser = await puppeteer.connect({
                browserWSEndpoint: this.browserEndpoint
            })
            await browser.close()
            return true
        } catch (e) {
            console.log('Browser not running on given endpoint')
            return false
        }
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
                wsEndpoint: ''
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
                    killAt: { $set: -1 }
                })
                return result.wsEndpoint
            }

            // Otherwise start new browser process
            console.log(connectionId, 'Starting browser')
            const wsEndpoint = await this._startBrowser(opts)
            await connStore.update({ 
                connections: { $set: connections },
                wsEndpoint: { $set: wsEndpoint },
                killAt: { $set: -1 }
            })
            return wsEndpoint
        })

        this.browserEndpoint = wsEndpoint
        return wsEndpoint
    }

    async disconnect(connectionId, opts) {
        console.log(connectionId, 'Got disconnection command')
        const connStore = this.db.block('connections')

        await connStore.acquireLock(async () => {
            if (opts.force) {
                await this._stopBrowser()
                return await connStore.update({
                    connections: { $set: [] },
                    killAt: { $set: -1 }
                })
            }

            const result = await connStore.get({
                connections: [],
                wsEndpoint: ''
            })

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


    startServer() {
        this.ipc.serve(path.join(os.homedir(), `${this.mayaFolder}/pupsock`), () => {
            const server = this.ipc.server

            server.on('maya::browser_start', (data, socket) => {
                const { id, payload = {} } = data
                this.connect(id, payload)
                    .then((wsEndpoint) => {
                        this.wsEndpoint = wsEndpoint
                        server.emit(socket, `maya::browser_start::${id}`, {
                            status: 'STARTED',
                            wsEndpoint: wsEndpoint
                        })
                    })
                    .catch((e) => {
                        console.log('error', e)
                        server.emit(socket, `maya::browser_start::${id}`, {
                            status: 'ERROR',
                            error: e
                        })
                    })
            })

            server.on('maya::browser_stop', (data, socket) => {
                const { id, connectionId, payload } = data
                this.disconnect(connectionId, payload)
                    .then(() => {
                        this.wsEndpoint = ''
                        server.emit(socket, `maya::browser_stop::${id}`, {
                            status: 'STOPPED'
                        })
                    })
                    .catch((e) => {
                        server.emit(socket, `maya::browser_stop::${id}`, {
                            status: 'ERROR',
                            error: e
                        })
                    })
            })

            server.on('maya::controller_kill', (data, socket) => {
                const { id } = data
                server.emit(socket, `maya::controller_kill::${id}`, {
                    status: 'KILLED'
                })
                setTimeout(() => process.exit(0), 2000)
            })
        })

        this.ipc.server.start()
    }
}

process.on('message', async (msg) => {
    console.log('Message from starting client:', msg)
    switch (msg.type) {
        case 'START_CONTROLLER': {
            const pcs = new PuppeteerControlServer()
            pcs.startServer()
            return process.send({
                type: 'CONTROLLER_STARTED'
            })
        }
        case 'STOP_CONTROLLER': {
            process.exit()
        }
        default: return
    }
})
