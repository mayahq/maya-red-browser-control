const {
    Node,
    Schema,
    fields
} = require('@mayahq/module-sdk')

const puppeteer = require('puppeteer-core')
const { nodeColor } = require('../../constants')
const LocalInstanceControl = require('../../utils/client')
const BROWSER_BIN_PATH = '/Users/dushyant/Chromium.app/Contents/MacOS/Chromium'
const USER_DATA_DIR = '/Users/dushyant/Library/Application Support/Google/Chrome'

class Connect extends Node {
    constructor(node, RED, opts) {
        super(node, RED, {
            ...opts,
            // masterKey: 'You can set this property to make the node fall back to this key if Maya does not provide one'
        })
    }

    static schema = new Schema({
        name: 'connect',
        label: 'Connect',
        category: 'Maya Red Browser Control',
        isConfig: false,
        color: nodeColor,
        icon: 'chrome.png',
        fields: {
            connectionType: new fields.SelectFieldSet({
                fieldSets: {
                    existing: {
                        link: new fields.Typed({ 
                            type: 'str',
                            allowedTypes: ['str', 'msg', 'global', 'flow'], 
                            displayName: 'Browser Websocket link',
                            required: true
                        })
                    }
                }
            })
        },
    })

    onInit() {
        // Do something on initialization of node
    }

    async onMessage(msg, vals) {
        const connectionType = vals.connectionType.selected

        const context = this._node.context()

        let browser
        if (connectionType === 'new') {
            const browserClient = new LocalInstanceControl()
            // await browserClient.init()
            const { showBrowser } = vals.connectionType.childValues
            try {
                const { connectionId, details } = await browserClient.startBrowser({
                    headless: showBrowser === 'no', // I know. Too lazy to fix.
                    defaultViewport: null
                })
                browser = await puppeteer.connect({
                    browserWSEndpoint: details.wsEndpoint
                })
                msg._connectionId = connectionId
            } catch (e) {
                msg.__error = e
                msg.__isError = true
            }
        } else {
            const wsEndpoint = vals.connectionType.childValues.link
            browser = await puppeteer.connect({
                browserWSEndpoint: wsEndpoint
            })
            msg._connectionId = Date.now().toString(36) + Math.floor(Math.random() * 10000).toString(36)
        }

        context.global.set(`_browser::${msg._connectionId}`, browser)
        context.global.set(`_pages::${msg._connectionId}`, [])
        return msg
    }
}

module.exports = Connect