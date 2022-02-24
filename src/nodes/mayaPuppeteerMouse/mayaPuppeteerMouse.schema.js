const {
    Node,
    Schema,
    fields
} = require('@mayahq/module-sdk')
const puppeteer = require('puppeteer-core')

const DATStr = ['str', 'msg', 'flow', 'global']
const DATNum = ['num', 'msg', 'flow', 'global']

class MayaPuppeteerMouse extends Node {
    constructor(node, RED, opts) {
        super(node, RED, {
            ...opts,
            // masterKey: 'You can set this property to make the node fall back to this key if Maya does not provide one'
        })
    }

    static schema = new Schema({
        name: 'maya-puppeteer-mouse',
        label: 'Mouse Action',
        category: 'Maya Red Browser Control',
        isConfig: false,
        fields: {
            actionType: new fields.SelectFieldSet({
                displayName: 'Action',
                fieldSets: {
                    click: {
                        clickXpath: new fields.Typed({ type: 'msg', allowedTypes: DATStr, displayName: 'Xpath', defaultVal: 'clickXpath' }),
                        clickTimeout: new fields.Typed({ type: 'num', allowedTypes: DATNum, displayName: 'Timeout', defaultVal: 2000 }),
                        clickPageId: new fields.Typed({ type: 'num', allowedTypes: DATNum, displayName: 'Page ID', defaultVal: 0 }),
                        clickIndex: new fields.Typed({ type: 'num', allowedTypes: DATNum, displayName: 'Element index', defaultVal: 0 }),
                    },
                    hover: {
                        hoverXpath: new fields.Typed({ type: 'msg', allowedTypes: DATStr, displayName: 'Xpath', defaultVal: 'hoverXpath' }),
                        hoverTimeout: new fields.Typed({ type: 'num', allowedTypes: DATNum, displayName: 'Timeout', defaultVal: 2000 }),
                        hoverPageId: new fields.Typed({ type: 'num', allowedTypes: DATNum, displayName: 'Page ID', defaultVal: 0 }),
                        hoverIndex: new fields.Typed({ type: 'num', allowedTypes: DATNum, displayName: 'Element index', defaultVal: 0 }),
                    },
                    scroll: {
                        scrollXpath: new fields.Typed({ type: 'msg', allowedTypes: DATStr, displayName: 'Xpath', defaultVal: 'scrollXpath' }),
                    }
                }
            })
        },

    })

    onInit() {
        // Do something on initialization of node
    }


    async getElementsWithXpath({ xpath, timeout, page }) {
        let elements
        try {
            elements = await page.$x(xpath)
        } catch (e) {
            throw new Error('Invalid xpath')
        }

        if (elements.length === 0) {
            try {
                await page.waitForXpath(xpath, { timeout })
                elements = await page.$x(xpath)
            } catch (e) {
                throw new Error('No elements found for xpath')
            }
        }

        return elements
        
    }

    async handleClick({ msg, xpath, timeout, pageId, index }) {
        try {
            const context = this._node.context()
            const pages = context.flow.get(`_pages::${msg._msgid}`)
    
            const page = pages[pageId]
            let elements
            try {
                elements = await this.getElementsWithXpath({
                    xpath, timeout, page
                })
            } catch (e) {
                msg.__error = e
                msg.__isError = true
                return msg
            }
    
            if (elements.length - 1 > index) {
                msg.__error = new Error(`Index out of bounds. Only ${elements.length} elements found for given xpath`)
                msg.__isError = true
                return msg
            }
    
            await elements[index].click()
            return msg
        } catch (e) {
            console.log('Unexpected error in mouse node during click:', e)
            msg.__error = e
            msg.__isError = true
            return msg
        }
    }

    async handleHover({ msg, xpath, timeout, pageId, index }) {
        try {
            const context = this._node.context()
            const pages = context.flow.get(`_pages::${msg._msgid}`)
    
            const page = pages[pageId]
            let elements
            try {
                elements = await this.getElementsWithXpath({
                    xpath, timeout, page
                })
            } catch (e) {
                msg.__error = e
                msg.__isError = true
                return msg
            }
    
            if (elements.length - 1 > index) {
                msg.__error = new Error(`Index out of bounds. Only ${elements.length} elements found for given xpath`)
                msg.__isError = true
                return msg
            }

            await elements[index].hover()
        } catch (e) {
            console.log('Unexpected error in mouse node during hover:', e)
            msg.__error = e
            msg.__isError = true
            return msg
        }
    }

    async onMessage(msg, vals) {
        // Prioritising maintainability over code-reuse. Pls don't "fix".
        switch (vals.actionType.selected) {
            case 'click': {
                const { clickXpath, clickTimeout, clickIndex, clickPageId } = vals.actionType.childValues
                return await this.handleClick({
                    msg,
                    xpath: clickXpath,
                    timeout: clickTimeout,
                    index: clickIndex,
                    pageId: clickPageId
                })
            }
            case 'hover': {
                const { hoverXpath, hoverTimeout, hoverIndex, hoverPageId } = vals.actionType.childValues
                return await this.handleHover({
                    msg,
                    xpath: hoverXpath,
                    timeout: hoverTimeout,
                    index: hoverIndex,
                    pageId: hoverPageId
                })
            }
            default: return msg
        }

        return msg
    }
}

module.exports = MayaPuppeteerMouse