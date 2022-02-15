const {
    Node,
    Schema,
    fields
} = require('@mayahq/module-sdk')

const puppeteer = require('puppeteer-core')
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
        const connectionType = vals.connectionType.selected

        let browser
        if (connectionType === 'new') {
            browser = await puppeteer.launch({
                // executablePath: BROWSER_BIN_PATH,
                channel: 'chrome',
                headless: false,
                userDataDir: '/Users/dushyant/Library/Application Support/Google/Chrome',
                defaultViewport: null
            })
            const page = await browser.newPage()
            await page.goto('https://www.youtube.com', {
                waitUntil: 'networkidle2'
            })
            // console.log('browser', browser)
            // console.log('page', page)
            setTimeout(() => browser.close(), 10000)
        } else {
            const wsEndpoint = vals.connectionType.childValues.link
            browser = await puppeteer.connect({
                browserWSEndpoint: wsEndpoint
            })
        }

        msg._browser = browser
        return msg
    }
}

module.exports = Connect