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
    static version = 1

    constructor() {
        const mayaDir = process.env.NODE_ENV === 'development' ? '.mayadev' : '.maya'
        this.sockpath = path.join(os.homedir(), `${mayaDir}/pupsock`)
        this.ipcComm = null
        this.ipc = null
        this.db = localDb({
            root: path.join(os.homedir(), mayaDir, 'db/browserAutomation')
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
            } catch (e) {
                reject(new Error('Unable to start maya browser controller'))
            }
        })
    }

    async _setServerVersion(serverPort) {
        console.log('Setting server version')
        await axios.post(`http://localhost:${serverPort}/set_version`, {
            version: LocalInstanceControl.version
        })
        console.log('Set server version')
    }

    async init() {
        // console.log('Initialising browser control client')
        await this.db.ensureHierarchy({
            serverInfo: 'BLOCK'
        })
        const serverInfoBlock = this.db.block('serverInfo')

        return await serverInfoBlock.acquireLock(async () => {
            const { serverPort } = await serverInfoBlock.get({ serverPort: 32016 })
            const { running, version } = await this._isServerRunning(serverPort)
            // console.log('Server version:', version)
            if (!running) {
                // console.log('Server not running, so starting')
                await this._startServer()
            }
            
            const res = await serverInfoBlock.get({ serverPort: 32016 })

            // If control server is an older version, kill it and start
            // a newer one
            if (version < LocalInstanceControl.version || version === undefined) {
                // console.log('Version mismatch. Restarting controller')
                await this.killController({ lock: false })
                await new Promise(res => setTimeout(res, 1000))
                await this._startServer()
                await this._setServerVersion(res.serverPort)
            }

            // console.log('Browser control server running')
            return res.serverPort
        })

    }

    async killController({ lock } = { lock: true }) {
        try {
            const serverInfoBlock = this.db.block('serverInfo')
            
            // Sometimes we wanna do this without a lock, just in case the calling function
            // has already acquired one
            const getFn = lock ? 'lockAndGet' : 'get'
            const { serverPort } = await serverInfoBlock[getFn]({ serverPort: 32016 })

            await axios.post(`http://localhost:${serverPort}/kill_controller`)
        } catch (e) {
            return
        }
    }

    async startBrowser(opts, timeout = BROWSER_START_STOP_TIMEOUT) {
        const serverPort = await this.init()
        const res = await axios.post(`http://localhost:${serverPort}/start_browser`, {
            opts
        })
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
// async function test() {
//     const { connectionId } = await lic.startBrowser({ headless: false })
//     setTimeout(() => {
//         console.log('Asking controller to stop browser')
//         lic.stopBrowser({connectionId})
//     }, 5000)
// }

// test()


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