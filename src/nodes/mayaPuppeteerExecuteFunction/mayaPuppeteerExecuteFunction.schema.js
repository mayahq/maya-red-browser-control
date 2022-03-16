const {
    Node,
    Schema,
    fields
} = require('@mayahq/module-sdk')
const puppeteer = require('puppeteer-core')
const { nodeColor } = require('../../constants')
const getElementsWithXpath = require('../../utils/getElementsWithXpath')

const DATStr = ['str', 'msg', 'flow', 'global']
const DATNum = ['num', 'msg', 'flow', 'global']
const DATJson = ['json', 'msg', 'flow', 'global']

class MayaPuppeteerExecuteFunction extends Node {
    constructor(node, RED, opts) {
        super(node, RED, {
            ...opts,
            // masterKey: 'You can set this property to make the node fall back to this key if Maya does not provide one'
        })
    }

    static schema = new Schema({
        name: 'maya-puppeteer-execute-function',
        label: 'Execute Function',
        category: 'Maya Red Browser Control',
        isConfig: false,
        color: nodeColor,
        icon: 'chrome.png',
        fields: {
            pageId: new fields.Typed({ type: 'num', allowedTypes: DATNum, displayName: 'Page ID', defaultVal: 0 }),
            xpath: new fields.Typed({ type: 'msg', allowedTypes: DATStr, displayName: 'Xpath', defaultVal: 'clickXpath' }),
            timeout: new fields.Typed({ type: 'num', allowedTypes: DATNum, displayName: 'Timeout', defaultVal: 2000 }),
            index: new fields.Typed({ type: 'num', allowedTypes: DATNum, displayName: 'Element index', defaultVal: 0 }),
            funcName: new fields.Typed({ type: 'str', allowedTypes: DATStr, displayName: 'Function name', defaultVal: '' }),
            args: new fields.Typed({ type: 'json', allowedTypes: DATJson, displayName: 'Arguments', defaultVal: [] }),
        },

    })

    onInit() {
        // Do something on initialization of node
    }

    async onMessage(msg, vals) {
        try {
            const context = this._node.context()
            const { pageId, xpath, timeout, index, funcName, args } = vals
            const pages = context.global.get(`_pages::${msg._connectionId}`)

            console.log('vals', vals)
    
            const page = pages[pageId]
            let elements
            try {
                elements = await getElementsWithXpath({
                    xpath, timeout, page
                })
            } catch (e) {
                msg.__error = e
                msg.__isError = true
                return msg
            }
    
            if (elements.length - 1 < index) {
                msg.__error = new Error(`Index out of bounds. Only ${elements.length} elements found for given xpath`)
                msg.__isError = true
                return msg
            }
    
            this.setStatus('PROGRESS', 'Executing function')
            const elem = elements[index]
            console.log('funcName', funcName)

            await page.evaluate((ele, funcName, args) => {
                ele[funcName](...args)
            }, elem, funcName, args)

            this.setStatus('SUCCESS', 'Done')
            return msg
        } catch (e) {
            this.setStatus('ERROR', e.toString())
            msg.__error = e,
            msg.__isError = true
            return msg
        }
    }
}

module.exports = MayaPuppeteerExecuteFunction