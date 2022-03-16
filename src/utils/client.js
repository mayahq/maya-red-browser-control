const os = require('os')
const path = require('path')
const fs = require('fs')
const { fork, spawn } = require('child_process');
const { default: ipc, IPCModule } = require('node-ipc')
const xios = require('axios');
const axios = require('axios')
const { localDb } = require('@mayahq/maya-db')


const BROWSER_START_STOP_TIMEOUT = 60 * 1000
const SERVER_HEARTBEAT_DURATION = 30 * 1000

class LocalInstanceControl {
    static version = 2

    constructor() {
        const mayaDir = process.env.NODE_ENV === 'development' ? '.mayadev' : '.maya'
        this.sockpath = path.join(os.homedir(), `${mayaDir}/pupsock`)
        this.ipcComm = null
        this.ipc = null
        this.db = localDb({
            root: path.join(os.homedir(), mayaFolder, 'db/browserAutomation')
        })
    }

    async _isServerRunning(serverPort) {
        try {
            const res = await axios.get(`http://localhost:${serverPort}/healthcheck`)
            if (res.data.status === 'OK') {
                return { running: true, version: res.data.version, serverPort: serverPort }
            } else {
                return { running: false }
            }
        } catch (e) {
            return { running: false }
        }
    }

    _startServer() {
        return new Promise((resolve, reject) => {
            try {
                const controllerPath = path.join(__dirname, 'controlServer.js')
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

    async init() {
        const serverInfoBlock = this.db.block('serverInfo')
        return await serverInfoBlock.acquireLock(async () => {
            const { serverPort } = serverInfoBlock.get({ serverPort: 32016 })
            const { running, version } = await this._isServerRunning(serverPort)
            if (!running) {
                console.log('Server not running, so starting')
                return await this._startServer()
            }
            
            // If control server is an older version, kill it and start
            // a newer one
            if (version < LocalInstanceControl.version || version === undefined) {
                await this.killController()
                await new Promise(res => setTimeout(res, 1000))
                await this._startServer()
            }

            const res = serverInfoBlock.get({ serverPort: 32016 })
            return res.serverPort
        })

    }

    async killController() {
        try {
            const serverInfoBlock = this.db.block('serverInfo')
            const { serverPort } = await serverInfoBlock.lockAndGet({ serverPort: 32016 })
            await axios.post(`http://localhost:${serverPort}/kill_controller`)
        } catch (e) {
            console.log('Error killing controller:', e)
            return
        }
    }

    async startBrowser(opts, timeout = BROWSER_START_STOP_TIMEOUT) {
        const serverPort = await this.init()
        const res = await axios.post(`http://localhost:${serverPort}/start_browser`)
        const data = res.data
        if (data.status !== 'STARTED') {
            throw new Error(`Error starting browser: ${data.error}`)
        }

        return {
            connectionId: data.connectionId,
            details: data
        }
    }

    async stopBrowser({ connectionId, force }, timeout = BROWSER_START_STOP_TIMEOUT) {
        const serverPort = await this.init()
        const request = {
            method: 'post',
            url: `http://localhost:${serverPort}/stop_browser`,
            data: {
                connectionId,
                opts: { force }
            }
        }

        const res = await axios(request)
        const data = res.data
        if (data.status === 'ERROR') {
            throw new Error(`Error stopping browser: ${data.error}`)
        }
    }
}

// const lic = new LocalInstanceControl()
// lic.init()
//     .then(async () => {
//         await lic.killController()
//         process.exit(0)
//         return

//         const {connectionId} = await lic.startBrowser({ headless: false })
//         setTimeout(async () => {
//             await lic.stopBrowser({ connectionId })
//         }, 7000)
//     })

module.exports = LocalInstanceControl