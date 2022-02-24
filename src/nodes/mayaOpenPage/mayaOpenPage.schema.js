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

class MayaOpenPage extends Node {
    constructor(node, RED, opts) {
        super(node, RED, {
            ...opts,
            // masterKey: 'You can set this property to make the node fall back to this key if Maya does not provide one'
        })
    }

    static schema = new Schema({
        name: 'maya-open-page',
        label: 'Open Page',
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
        const context = this._node.context()

        /**
         * @type {puppeteer.Browser}
         */
        const browser = context.flow.get(`_browser::${msg._msgid}`)
        
        if (!browser) {
            this.setStatus('ERROR', 'No connect node at flow beginning')
            throw new Error('No connect node at flow beginning')
        }
        
        const page = await browser.newPage()
        await page.goto(vals.url, {
            waitUntil: vals.waitUntil
        })
        
        const pages = context.flow.get(`_pages::${msg._msgid}`)
        const pageId = pages.length
        const newPages = [...pages].concat(page)
        context.flow.set(`_pages::${msg._msgid}`, newPages)

        msg.pageIds = [pageId]
        return msg
    }
}

module.exports = MayaOpenPage