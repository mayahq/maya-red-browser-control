const os = require('os')
const path = require('path')
const fs = require('fs')
const { default: ipc, IPCModule } = require('node-ipc')

class LocalInstanceControl {
    constructor({ mayaDir = '.mayadev' }) {
        this.sockpath = path.join(os.homedir(), `${mayaDir}/pupsock`)

    }

    _isServerRunning() {
        return new Promise((resolve, reject) => {
            const testIPC = new IPCModule()
            testIPC.config.silent = true
            testIPC.config.stopRetrying = 1

            testIPC.connectTo(
                'ping',
                this.sockpath,
                () => {
                    testIPC.of.ping.on('connect', () => {
                        testIPC.disconnect('ping')
                        resolve(true)
                    })

                    testIPC.of.ping.on('error', (e) => {
                        testIPC.config.stopRetrying = true
                        resolve(false)
                    })
                }
            )
        })
    }

    init() {

    }
}

// const exists = fs.existsSync('/Users/dushyant/.mayadev/pupsock')
// console.log(exists)

// const lic = new LocalInstanceControl({ mayaDir: '.mayadev' })
// lic._isServerRunning()
//     .then(res => console.log(res))

module.exports = LocalInstanceControl