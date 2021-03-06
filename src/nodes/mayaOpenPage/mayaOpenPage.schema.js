const {
    Node,
    Schema,
    fields
} = require('@mayahq/module-sdk')
const puppeteer = require('puppeteer-core')
const { nodeColor } = require('../../constants')

const DAT = ['str', 'msg', 'flow', 'global']
const DATNum = ['num', 'msg', 'flow', 'global']

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
        icon: 'chrome.png',
        color: nodeColor,
        fields: {
            url: new fields.Typed({ type: 'msg', allowedTypes: DAT, displayName: 'URL', defaultVal: 'url' }),
            waitUntil: new fields.Select({ defaultVal: 'networkidle2', options: waitOptions}),
            viewport: new fields.SelectFieldSet({
                fieldSets: {
                    default: {},
                    custom: {
                        vwidth: new fields.Typed({ type: 'num', allowedTypes: DATNum, displayName: 'Width', defaultVal: 1600 }),
                        vheight: new fields.Typed({ type: 'num', allowedTypes: DATNum, displayName: 'Height', defaultVal: 900 }),
                    }
                }
            })
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
        const browser = context.global.get(`_browser::${msg._connectionId}`)
        
        if (!browser) {
            this.setStatus('ERROR', 'No connect node at flow beginning')
            throw new Error('No connect node at flow beginning')
        }
        
        const page = await browser.newPage()

        let width = 1600, height = 900
        if (vals.viewport.selected === 'custom') {
            width = viewport.childValues.vwidth,
            height = viewport.childValues.vheight
        }
        await page.setViewport({ width, height })

        await page.goto(vals.url, {
            waitUntil: vals.waitUntil
        })
        
        const pages = context.global.get(`_pages::${msg._connectionId}`)
        const pageId = pages.length
        const newPages = [...pages].concat(page)
        context.global.set(`_pages::${msg._connectionId}`, newPages)

        msg.pageIds = [pageId]
        return msg
    }
}

module.exports = MayaOpenPage