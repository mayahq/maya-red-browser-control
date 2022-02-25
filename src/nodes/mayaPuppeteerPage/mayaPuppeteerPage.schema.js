const {
    Node,
    Schema,
    fields
} = require('@mayahq/module-sdk')
const puppeteer = require('puppeteer-core')

const DATStr = ['str', 'msg', 'flow', 'global']
const DATNum = ['num', 'msg', 'flow', 'global']
const waitOptions = [
    'networkidle0',
    'networkidle2',
    'load',
    'domcontentloaded'
]

class MayaPuppeteerPage extends Node {
    constructor(node, RED, opts) {
        super(node, RED, {
            ...opts,
            // masterKey: 'You can set this property to make the node fall back to this key if Maya does not provide one'
        })
    }

    static schema = new Schema({
        name: 'maya-puppeteer-page',
        label: 'Page Action',
        category: 'Maya Red Browser Control',
        isConfig: false,
        fields: {
            pageId: new fields.Typed({ type: 'msg', allowedTypes: DATNum, displayName: 'Page ID', defaultVal: 'pageIds[0]' }),
            actionType: new fields.SelectFieldSet({
                displayName: 'Action',
                fieldSets: {
                    navigate: {
                        url: new fields.Typed({ type: 'str', allowedTypes: DATStr, displayName: 'URL', defaultVal: 'https://www.example.com' }),
                        waitUntil: new fields.Select({ options: waitOptions, defaultVal: 'networkidle2' })
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
        const pages = context.flow.get(`_pages::${msg._msgid}`)

        const { pageId } = vals
        /**
         * @type {puppeteer.Page}
         */
        const page = pages[pageId]
        if (!page) {
            this.setStatus('ERROR', `Page with given ID (${pageId}) does not exist`)
            msg.__error = new Error('Page with given ID does not exist')
            msg.__isError = true
            return msg
        }

        switch (vals.actionType.selected) {
            case 'navigate': {
                const {  url, waitUntil } = vals.actionType.childValues
                this.setStatus('PROGRESS', `Navigating to ${url}`)
                await page.goto(url, { waitUntil })
                this.setStatus('SUCCESS', `Navigated to ${url}`)
                return msg
            }
            default: return msg
        }
    }
}

module.exports = MayaPuppeteerPage