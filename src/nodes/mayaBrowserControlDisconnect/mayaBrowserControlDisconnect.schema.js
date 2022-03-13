const {
    Node,
    Schema,
    fields
} = require('@mayahq/module-sdk')
const { nodeColor } = require('../../constants')
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
        label: 'Disconnect',
        category: 'Maya Red Browser Control',
        isConfig: false,
        fields: {
            force: new fields.Select({ options: ['no', 'yes'], displayName: 'Force' })
        },
        icon: 'font-awesome/fa-chrome',
        color: nodeColor,
        icon: 'chrome.png'
    })

    onInit() {}

    async onMessage(msg, vals) {
        const connectionId = msg._connectionId
        const force = vals.force === 'yes'

        if (!connectionId && !force) {
            console.log('No connection ID provided! Cannot close')
            this.setStatus('ERROR', 'No connection ID provided')
            msg.__error = new Error('No connection ID provided')
            msg.__isError = true
            return msg
        }

        // Disconnecting the browser object from debug websocket of
        // the actual chromium process
        if (!force) {
            const context = this._node.context()
            const browser = context.flow.get(`_browser::${msg._msgid}`)
            await browser.disconnect()
        }

        // Telling the browser manager that we're done now
        const browserClient = new LocalInstanceControl()
        await browserClient.init()
        try {
            await browserClient.stopBrowser({ connectionId, force })
            delete msg['_browser']
            delete msg['_connectionId']
        } catch (e) {
            console.log('Error disconnecting from browser:', e)
            msg.__error = e
            msg.__isError = true
        }
        await browserClient.disconnectFromController()

        // Removing browser object from flow context
        context.flow.set([
            `_browser::${msg._msgid}`, 
            `_pages::${msg._msgid}`
        ], [
            undefined, 
            undefined
        ])
        return msg
    }
}

module.exports = MayaBrowserControlDisconnect