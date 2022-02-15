const os = require('os')
const path = require('path')
const puppeteer = require('puppeteer-core')
const { default: ipc } = require('node-ipc')


class PuppeteerControlServer {
    start() {
        ipc.serve(path.join(os.homedir(), '.mayadev/pupsock'), () => {
            ipc.server.on('maya.message', (data, socket) => {
                console.log('data', data)
                ipc.server.emit(socket, 'maya.message', {
                    id: 'maya',
                    message: data.message + ' bruh'
                })
            })
        })

        ipc.server.start()
    }
}

const pcs = new PuppeteerControlServer()
pcs.start()