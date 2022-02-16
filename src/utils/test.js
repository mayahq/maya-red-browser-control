const os = require('os')
const path = require('path')
const { default: ipc } = require('node-ipc')

// ipc.config.id = 'pcs'

ipc.config.retry = 5000
ipc.config.stopRetrying = 1

ipc.connectTo(
    'pcs',
    path.join(os.homedir(), '.mayadev/pupsock'),
    () => {
        ipc.of.pcs.on('connect', () => {
            ipc.log('## Connected to pcs ##', ipc.config.delay)
            ipc.of.pcs.emit('maya.message', {
                id: ipc.config.id,
                message: 'hello'
            })
        })

        ipc.of.pcs.on('disconnect', () => {
            // ipc.log('## Disconnected from pcs ##')
            console.log('### Disconnected')
        })

        ipc.of.pcs.on('maya.message', (data) => {
            // ipc.log('## Got message from pcs ##', data)
        })

        ipc.of.pcs.on('error', (e) => {
            console.log('YOOOOOOOOOO error', e.errno)
            ipc.of.pcs.destroy
        })

        // console.log(ipc.of.pcs.destroy)
})