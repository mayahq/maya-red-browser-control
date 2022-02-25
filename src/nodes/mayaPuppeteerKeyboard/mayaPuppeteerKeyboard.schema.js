const {
    Node,
    Schema,
    fields
} = require('@mayahq/module-sdk')
const puppeteer = require('puppeteer-core')
const getElementsWithXpath = require('../../utils/getElementsWithXpath')

const DATStr = ['str', 'msg', 'flow', 'global']
const DATNum = ['num', 'msg', 'flow', 'global']

class MayaPuppeteerKeyboard extends Node {
    constructor(node, RED, opts) {
        super(node, RED, {
            ...opts,
            // masterKey: 'You can set this property to make the node fall back to this key if Maya does not provide one'
        })
    }

    static schema = new Schema({
        name: 'maya-puppeteer-keyboard',
        label: 'Keyboard Action',
        category: 'Maya Red Browser Control',
        isConfig: false,
        fields: {
            pageId: new fields.Typed({ type: 'msg', allowedTypes: DATNum, displayName: 'Page ID', defaultVal: 'pageIds[0]' }),
            actionType: new fields.SelectFieldSet({
                displayName: 'Action',
                fieldSets: {
                    type: {
                        typeText: new fields.Typed({ type: 'str', allowedTypes: DATStr, displayName: 'Text' }),
                        typeDelay: new fields.Typed({ type: 'num', allowedTypes: DATNum, displayName: 'Keypress delay', defaultVal: 0 }),
                        typeXpath: new fields.Typed({ type: 'msg', allowedTypes: DATStr, displayName: 'Xpath', defaultVal: 'typeXpath' }),
                        typeTimeout: new fields.Typed({ type: 'num', allowedTypes: DATNum, displayName: 'Timeout', defaultVal: 2000 }),
                        typeIndex: new fields.Typed({ type: 'num', allowedTypes: DATNum, displayName: 'Element index', defaultVal: 0 }),
                    },
                    keyPress: {
                        kpKey: new fields.Typed({ type: 'str', allowedTypes: DATStr, displayName: 'Key Name' }),
                        kpDelay: new fields.Typed({ type: 'num', allowedTypes: DATNum, displayName: 'Delay', defaultVal: 0 }),
                    },
                    keyDown: {
                        kdKey: new fields.Typed({ type: 'str', allowedTypes: DATStr, displayName: 'Key Name' }),
                    },
                    keyUp: {
                        kuKey: new fields.Typed({ type: 'str', allowedTypes: DATStr, displayName: 'Key Name' }),
                    },
                }
            })
        },

    })

    onInit() {
        // Do something on initialization of node
    }

    async handleType({ msg, text, delay, xpath, timeout, pageId, index }) {
        const context = this._node.context()
        const pages = context.flow.get(`_pages::${msg._msgid}`)

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

        await elements[index].type(text, { delay })
        return msg
    }

    async handleKeypress({ msg, pageId, keyName, delay }) {
        try {
            const context = this._node.context()
            const pages = context.flow.get(`_pages::${msg._msgid}`)
            const page = pages[pageId]
    
            await page.keyboard.press(keyName, { delay })
        } catch (e) {
            msg.__error = new Error(`Unexpected error during keyPress: ${e}`)
            msg.__isError = true
        }

        return msg
    }

    async handleKeyAction({ msg, pageId, keyName, action }) {
        try {
            const context = this._node.context()
            const pages = context.flow.get(`_pages::${msg._msgid}`)
            const page = pages[pageId]

            if (action === 'down') {
                await page.keyboard.down(keyName)
            } else {
                await page.keyboard.up(keyName)
            }
        } catch (e) {
            msg.__error = new Error(`Unexpected error during keyPress: ${e}`)
            msg.__isError = true
        }

        return msg
    }

    async onMessage(msg, vals) {
        switch (vals.actionType.selected) {
            case 'type': {
                const { 
                    typeText: text,
                    typeDelay: delay,
                    typeXpath: xpath,
                    typeTimeout: timeout,
                    typeIndex: index
                 } = vals.actionType.childValues
                 const { pageId } = vals
                 return await this.handleType({ msg, text, delay, xpath, timeout, pageId, index })
            }
            case 'keyPress': {
                const {
                    kpKey: keyName,
                    kpDelay: delay
                } = vals.actionType.childValues
                const { pageId } = vals
                return await this.handleKeypress({ msg, pageId, keyName, delay })
            }
            case 'keyDown': {
                const { kdKey: keyName } = vals.actionType.childValues
                const { pageId } = vals
                return await this.handleKeyAction({ msg, pageId, keyName, action: 'down' })
            }
            case 'keyUp': {
                const { kuKey: keyName } = vals.actionType.childValues
                const { pageId } = vals
                return await this.handleKeyAction({ msg, pageId, keyName, action: 'up' })
            }
            default: return msg
        }
    }
}

module.exports = MayaPuppeteerKeyboard