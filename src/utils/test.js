const os = require('os')
const path = require('path')
const { default: ipc } = require('node-ipc')

// ipc.config.id = 'pcs'
// ipc.config.retry = 1000



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
            ipc.log('## Disconnected from pcs ##')
        })

        ipc.of.pcs.on('maya.message', (data) => {
            ipc.log('## Got message from pcs ##', data)
        })

        console.log(ipc.of.pcs.destroy)
})