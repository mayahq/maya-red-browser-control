const os = require('os')
const path = require('path')
const puppeteer = require('puppeteer-core')
const { IPCModule } = require('node-ipc')


class PuppeteerControlServer {
    constructor() {
        this.ipc = new IPCModule()
        this.ipc.config.silent = true
    }

    start() {
        this.ipc.serve(path.join(os.homedir(), '.mayadev/pupsock'), () => {
            this.ipc.server.on('maya.message', (data, socket) => {
                console.log('data', data)
                this.ipc.server.emit(socket, 'maya.message', {
                    id: 'maya',
                    message: data.message + ' bruh'
                })
            })
        })

        this.ipc.server.start()
    }
}

const pcs = new PuppeteerControlServer()
pcs.start()