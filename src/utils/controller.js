const os = require('os')
const path = require('path')
const chromeLauncher = require('chrome-launcher')
const puppeteer = require('puppeteer-core')
const { IPCModule } = require('node-ipc')
const { localDb } = require('@mayahq/maya-db')

// const KILL_TIMEOUT = 5 * 60 * 1000 // 5 minutes
const KILL_TIMEOUT = 10 * 1000 // 5 minutes

class PuppeteerControlServer {
    constructor() {
        const mayaFolder = process.env.NODE_ENV === 'development' ? '.mayadev' : '.maya'

        this.ipc = new IPCModule()
        this.ipc.config.silent = true
        this.db = localDb({
            root: path.join(os.homedir(), mayaFolder, 'db/browserAutomation')
        })
        this.db.ensureHierarchy({
            connections: 'BLOCK'
        })

        this.killTimer = null
    }

    async _startBrowser(opts = {}) {
        const browser = await puppeteer.launch({
            headless: false,
            userDataDir: '/Users/dushyant/Library/Application Support/Google/Chrome',
            defaultViewport: null,
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
        console.log('Got connection command', connectionId)
        const connStore = this.db.block('connections')
        const wsEndpoint = await connStore.acquireLock(async () => {
            // console.log('Acquired lock for connect')
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
            const pupInstance = await this._browserRunning(result.wsEndpoint)
            if (pupInstance) {
                console.log('Browser already running', connectionId)
                await connStore.set({ connections })
                return result.wsEndpoint
            }

            // Otherwise start new browser process
            console.log('Starting browser', connectionId)
            const wsEndpoint = await this._startBrowser(opts)
            await connStore.set({ connections, wsEndpoint })
            return wsEndpoint
        })

        // Removing the kill timeout. Closing the browser is now the
        // responsibility of this connection.
        if (this.killTimer) {
            console.log('Removing browser kill timer')
            clearTimeout(this.killTimer)
        }

        this.browserEndpoint = wsEndpoint
        return wsEndpoint
    }

    async disconnect(connectionId, opts) {
        console.log('\n\n\nGot disconnection command', connectionId)
        const connStore = this.db.block('connections')
        await connStore.acquireLock(async () => {
            // console.log('Acquired lock for disconnect')
            const result = await connStore.get({
                connections: [],
                wsEndpoint: ''
            })

            // If no connection with given ID found, nothing to be done.
            const connections = [...result.connections]
            console.log('connections', connectionId, connections)

            if (!connections.some(c => c.id === connectionId)) {
                console.log(`No connection with id ${connectionId} found. Aborting.`)
                return
            }

            // If other connections are left after removing the current on,
            // do nothing
            const newConnections = connections.filter(c => c.id !== connectionId)
            console.log(newConnections)
            if (newConnections.length > 0) {
                console.log('Connections still left:', connectionId, newConnections)
                console.log('Setting these', connectionId)
                // const res = await connStore.set({ connections: newConnections })
                const res = await connStore.update({
                    connections: { $set: newConnections }
                })
                console.log('res', connectionId, res)
                return 
            }

            // Otherwise schedule the browser to close after some amount
            // (5 minutes, currently) of time            
            await connStore.update({
                connections: { $set: newConnections },
                wsEndpoint: { $set: '' }
            })
            this.killTimer = setTimeout(() => {
                console.log('Actually killing browser process', connectionId)
                this._stopBrowser()
            }, KILL_TIMEOUT)
            console.log(`Will kill browser process after ${KILL_TIMEOUT/1000} seconds`)
            return
        })
    }


    startServer() {
        this.ipc.serve(path.join(os.homedir(), '.mayadev/pupsock'), () => {
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

            // this.ipc.server.on('maya.message', (data, socket) => {
            //     console.log('data', data)
            //     this.ipc.server.emit(socket, 'maya.message', {
            //         id: 'maya',
            //         message: data.message + ' bruh'
            //     })
            // })
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


const pcs = new PuppeteerControlServer()
pcs.startServer()