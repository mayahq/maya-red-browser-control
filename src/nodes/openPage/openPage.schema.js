const {
    Node,
    Schema,
    fields
} = require('@mayahq/module-sdk')
const puppeteer = require('puppeteer-core')

const DAT = ['str', 'msg', 'flow', 'global']
const waitOptions = [
    'networkidle0',
    'networkidle2',
    'load',
    'domcontentloaded'
]

class OpenPage extends Node {
    constructor(node, RED, opts) {
        super(node, RED, {
            ...opts,
            // masterKey: 'You can set this property to make the node fall back to this key if Maya does not provide one'
        })
    }

    static schema = new Schema({
        name: 'open-page',
        label: 'open-page',
        category: 'Maya Red Browser Control',
        isConfig: false,
        fields: {
            url: new fields.Typed({ type: 'msg', allowedTypes: DAT, displayName: 'URL', defaultVal: 'url' }),
            waitUntil: new fields.Select({ defaultVal: 'networkidle2', options: waitOptions})
        },

    })

    onInit() {
        // Do something on initialization of node
    }

    async onMessage(msg, vals) {
        if (msg._browser) {
            throw new Error('No connect node at flow beginning')
        }

        /**
         * @type {puppeteer.Browser}
         */
        const browser = msg._browser
        const page = await browser.newPage()
        await browser.goto(vals.url, {
            waitUntil: vals.waitUntil
        })
        msg.pages = [page]
        return msg
    }
}

module.exports = OpenPage