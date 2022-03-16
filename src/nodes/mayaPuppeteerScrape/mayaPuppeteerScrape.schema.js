const {
    Node,
    Schema,
    fields
} = require('@mayahq/module-sdk')
const { nodeColor } = require('../../constants')
const evaluateQuery = require('../../utils/webql')

class MayaPuppeteerScrape extends Node {
    constructor(node, RED, opts) {
        super(node, RED, {
            ...opts,
            // masterKey: 'You can set this property to make the node fall back to this key if Maya does not provide one'
        })
    }

    static schema = new Schema({
        name: 'maya-puppeteer-scrape',
        label: 'Scrape',
        category: 'Maya Red Browser Control',
        isConfig: false,
        color: nodeColor,
        icon: 'chrome.png',
        fields: {
            pageId: new fields.Typed({ type: 'msg', allowedTypes: ['msg', 'global', 'flow', 'str'], defaultVal:'pageIds[0]', displayName: 'Page ID'}),
            query: new fields.Typed({ type: 'json', allowedTypes: ['msg', 'flow', 'global'], displayName: 'Query' }),
            timeout: new fields.Typed({ type: 'num', allowedTypes: ['msg', 'global', 'flow'], defaultVal: 2000, displayName: 'Timeout' }),
        },

    })

    onInit() {
        // Do something on initialization of node
    }

    async onMessage(msg, vals) {
        const context = this._node.context()
        const { pageId, query, timeout } = vals
        const pages = context.global.get(`_pages::${msg._connectionId}`)
        const page = pages[pageId]

        const result = await evaluateQuery(page, query, timeout)
        console.log('scrapeResult', result)
        msg.result = result
        return msg
    }
}

module.exports = MayaPuppeteerScrape