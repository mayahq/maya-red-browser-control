const {
    Node,
    Schema,
    fields
} = require('@mayahq/module-sdk')

const puppeteer = require('puppeteer-core')
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
        label: 'connect',
        category: 'Maya Red Browser Control',
        isConfig: false,
        fields: {
            connectionType: new fields.SelectFieldSet({
                fieldSets: {
                    new: {
                        headless: new fields.Select({ options: ['yes', 'no'], displayName: 'Show browser', defaultVal: 'no' })
                    },
                    existing: {
                        link: new fields.Typed({ type: 'str', allowedTypes: ['str', 'msg', 'global', 'flow'], displayName: 'WS link' })
                    }
                }
            })
        },
    })

    onInit() {
        // Do something on initialization of node
    }

    async onMessage(msg, vals) {
        console.log('Recieved a message', msg)
        const connectionType = vals.connectionType.selected

        let browser
        if (connectionType === 'new') {
            const browserClient = new LocalInstanceControl()
            await browserClient.init()
            try {
                const { connectionId, details } = await browserClient.startBrowser({
                    headless: false
                })
                console.log('here 1', connectionId, details)
                browser = await puppeteer.connect({
                    browserWSEndpoint: details.wsEndpoint
                })
                console.log('here 2')
                msg._connectionId = connectionId
            } catch (e) {
                msg.__error = e
                msg.__isError = true
            }
            console.log('here 3')
            await browserClient.disconnectFromController()
            console.log('here 4')
        } else {
            const wsEndpoint = vals.connectionType.childValues.link
            browser = await puppeteer.connect({
                browserWSEndpoint: wsEndpoint
            })
        }

        msg._browser = browser
        browser.toString = () => '[Puppeteer Browser Instance]'
        console.log('connect', msg)
        return msg
    }
}

module.exports = Connect