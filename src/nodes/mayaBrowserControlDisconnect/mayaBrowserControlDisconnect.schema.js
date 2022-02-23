const {
    Node,
    Schema
} = require('@mayahq/module-sdk')
const LocalInstanceControl = require('../../utils/client')

class MayaBrowserControlDisconnect extends Node {
    constructor(node, RED, opts) {
        super(node, RED, {
            ...opts,
            // masterKey: 'You can set this property to make the node fall back to this key if Maya does not provide one'
        })
    }

    static schema = new Schema({
        name: 'maya-browser-control-disconnect',
        label: 'disconnect',
        category: 'Maya Red Browser Control',
        isConfig: false,
        fields: {
            // Whatever custom fields the node needs.
        },

    })

    onInit() {
        // Do something on initialization of node
    }

    async onMessage(msg, vals) {
        const connectionId = msg._connectionId
        if (!connectionId) {
            console.log('No connection ID provided! Cannot close')
            this.setStatus('ERROR', 'No connection ID provided')
            msg.__error = new Error('No connection ID provided')
            msg.__isError = true
            return msg
        }

        const browserClient = new LocalInstanceControl()
        await browserClient.init()
        try {
            await browserClient.stopBrowser({ connectionId })
            delete msg['_browser']
            delete msg['_connectionId']
        } catch (e) {
            console.log('Error disconnecting from browser:', e)
            msg.__error = e
            msg.__isError = true
        }
        await browserClient.disconnectFromController()
        return msg
    }
}

module.exports = MayaBrowserControlDisconnect