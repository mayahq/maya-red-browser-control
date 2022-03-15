const os = require('os')
const path = require('path')
const fs = require('fs')
const { fork, spawn } = require('child_process');
const { default: ipc, IPCModule } = require('node-ipc')

const BROWSER_START_STOP_TIMEOUT = 60 * 1000
const SERVER_HEARTBEAT_DURATION = 30 * 1000

class LocalInstanceControl {
    static version = 2

    constructor() {
        const mayaDir = process.env.NODE_ENV === 'development' ? '.mayadev' : '.maya'
        this.sockpath = path.join(os.homedir(), `${mayaDir}/pupsock`)
        this.ipcComm = null
        this.ipc = null
    }

    _isServerRunning() {
        return new Promise((resolve, reject) => {
            const testIPC = new IPCModule()
            testIPC.config.silent = true
            testIPC.config.stopRetrying = 1
            
            const id = (Math.random() * 100000000).toString()
            const versionCheckMessage = {
                id: id,
                type: 'maya::controller_version'
            }

            const tm = setTimeout(() => resolve({ running: false }), 3000)
            testIPC.connectTo(
                'ping',
                this.sockpath,
                () => {
                    testIPC.of.ping.on(`maya::controller_version::${id}`, (msg) => {
                        testIPC.disconnect('ping')
                        clearTimeout(tm)
                        resolve({ running: true, version: msg.version })
                    })

                    testIPC.of.ping.on('connect', () => {
                        testIPC.of.ping.emit('maya::controller_version', versionCheckMessage)
                    })

                    testIPC.of.ping.on('error', (e) => {
                        try {
                            testIPC.disconnect('ping')
                        } catch (e) {}
                        testIPC.config.stopRetrying = true
                        clearTimeout(tm)
                        resolve({ running: false })
                    })
                }
            )
        })
    }

    _startServer() {
        return new Promise((resolve, reject) => {
            try {
                const controllerPath = path.join(__dirname, 'controller.js')
                const controllerProc = fork(controllerPath, {
                    detached: true
                })
        
                controllerProc.unref()
                controllerProc.on('message', (msg) => {
                    switch (msg.type) {
                        case 'CONTROLLER_STARTED': return resolve()
                        default: return resolve()
                    }
                })
                controllerProc.send({
                    type: 'START_CONTROLLER'
                })
            } catch (e) {
                reject(new Error('Unable to start maya browser controller'))
            }
        })
    }

    getServerVersion() {
        return new Promise((resolve, reject) => {
            try {
                const id = (Math.random() * 100000000).toString()
                const versionCheckMessage = {
                    id: id,
                    type: 'maya::controller_version'
                }

                const tm = setTimeout(() => resolve(-1), 3000)
                this.ipc.of.mayaBrowserControl.once(`maya::controller_version::${id}`, () => {
                    resolve(msg.version)
                    clearTimeout(tm)
                })
                this.ipc.of.mayaBrowserControl.emit('maya::controller_version', versionCheckMessage)
            } catch (e) {
                resolve(-1)
            }
        })
    }

    async init() {
        const { running, version } = await this._isServerRunning()
        if (!running) {
            console.log('Server not running, so starting')
            await this._startServer()
        }

        // If control server is an older version, kill it and start
        // a newer one
        if (version < LocalInstanceControl.version || version === undefined) {
            await this.killController()
            await new Promise(res => setTimeout(res, 1000))
            await this._startServer()
        }

        const ipcMod = new IPCModule()
        ipcMod.config.silent = true
        this.ipc = ipcMod

        await new Promise((resolve, reject) => {
            ipcMod.connectTo(
                'mayaBrowserControl',
                this.sockpath,
                () => {
                    ipcMod.of.mayaBrowserControl.on('connect', () => {
                        console.log('Connected to maya puppeteer controller')
                        resolve()
                    })

                    ipcMod.of.mayaBrowserControl.on('disconnect', () => {
                        console.log('Disconnected from maya puppeteer controller')
                    })

                    ipcMod.of.mayaBrowserControl.on('error', (e) => {
                        console.log('Error connecting to controller', e)
                    })

                }
            )
        })

    }

    async killController() {
        const { running } = await this._isServerRunning()
        if (!running) {
            return
        }

        const killIPC = new IPCModule()
        
        await new Promise((resolve, reject) => {
            killIPC.connectTo(
                'kill',
                this.sockpath,
                () => {
                    killIPC.of.kill.on('connect', () => {
                        const id = (Math.random() * 100000000).toString()
                        killIPC.of.kill.once(`maya::controller_kill::${id}`, (msg) => {
                            if (msg.status === 'KILLED') {
                                console.log('Controller process killed')
                            } else {
                                console.log('Error killing controller process')
                            }
                            resolve()
                        })
                        killIPC.of.kill.emit('maya::controller_kill', { id })
                    })

                    killIPC.of.kill.on('error', (e) => reject(e))
                }
            )
        })

        return
    }

    startBrowser(opts, timeout = BROWSER_START_STOP_TIMEOUT) {
        return new Promise((resolve, reject) => {
            const id = (Math.random() * 100000000).toString()
            const browserStartMessage = {
                id: id,
                type: 'maya::browser_start',
                payload: opts // Provided to puppeteer.launch
            }
            this.ipc.of.mayaBrowserControl.emit('maya::browser_start', browserStartMessage)
            const tm = setTimeout(() => reject({ error: 'Timed out' }), timeout)

            this.ipc.of.mayaBrowserControl.once(`maya::browser_start::${id}`, (msg) => {
                clearTimeout(tm)
                switch (msg.status) {
                    case 'STARTED': {
                        console.log('Browser was started')
                        return resolve({ connectionId: id, details: msg })
                    }
                    case 'ALREADY_RUNNING': {
                        console.log('Browser was already running')
                        return resolve({ connectionId: id, details: msg })
                    }
                    case 'ERROR': {
                        console.log('Error starting browser:', msg.error)
                        return reject(msg.error)
                    }
                    default: {
                        console.log('Unknown error starting browser. Message received from controller:', msg)
                        return reject(msg)
                    }
                }
            })
        })
    }

    stopBrowser({ connectionId, force }, timeout = BROWSER_START_STOP_TIMEOUT) {
        return new Promise((resolve, reject) => {
            const id = (Math.random() * 100000000).toString()
            const browserStopMessage = {
                id: id,
                connectionId: connectionId,
                payload: {
                    force
                },
                type: 'maya::browser_stop'
            }
            this.ipc.of.mayaBrowserControl.emit('maya::browser_stop', browserStopMessage)
            const tm = setTimeout(() => reject({ error: 'Timed out' }), timeout)
            
            this.ipc.of.mayaBrowserControl.once(`maya::browser_stop::${id}`, (msg) => {
                clearTimeout(tm)
                switch (msg.status) {
                    case 'STOPPED': {
                        console.log('Browser was stopped')
                        // this.disconnectFromController()
                        return resolve()
                    }
                    case 'ALREADY_STOPPED': {
                        console.log('Browser was already stopped')
                        // this.disconnectFromController()
                        return resolve()
                    }
                    case 'ERROR': {
                        console.log('Error stopping browser:', msg.error)
                        return reject(msg.error)
                    }
                    default: {
                        console.log('Unknown error stopping browser. Message received from controller:', msg)
                        return reject(msg)
                    }
                }
            })
        })
    }

    disconnectFromController() {
        try {
            this.ipc.disconnect('mayaBrowserControl')
        } catch (e) {}
    }
}

const lic = new LocalInstanceControl()
lic.init()
    .then(async () => {
        await lic.killController()
        process.exit(0)
        return

        const {connectionId} = await lic.startBrowser({ headless: false })
        setTimeout(async () => {
            await lic.stopBrowser({ connectionId })
        }, 7000)
    })

module.exports = LocalInstanceControl