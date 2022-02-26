const {
    Node,
    Schema,
    fields
} = require('@mayahq/module-sdk')
const getElementsWithXpath = require('../../utils/getElementsWithXpath')

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
            pageId: new fields.Typed({ type: 'msg', allowedTypes: DATNum, displayName: 'Page ID', defaultVal: 'pageIds[0]' }),
            actionType: new fields.SelectFieldSet({
                displayName: 'Action',
                fieldSets: {
                    click: {
                        clickXpath: new fields.Typed({ type: 'msg', allowedTypes: DATStr, displayName: 'Xpath', defaultVal: 'clickXpath' }),
                        clickTimeout: new fields.Typed({ type: 'num', allowedTypes: DATNum, displayName: 'Timeout', defaultVal: 2000 }),
                        clickIndex: new fields.Typed({ type: 'num', allowedTypes: DATNum, displayName: 'Element index', defaultVal: 0 }),
                    },
                    hover: {
                        hoverXpath: new fields.Typed({ type: 'msg', allowedTypes: DATStr, displayName: 'Xpath', defaultVal: 'hoverXpath' }),
                        hoverTimeout: new fields.Typed({ type: 'num', allowedTypes: DATNum, displayName: 'Timeout', defaultVal: 2000 }),
                        hoverIndex: new fields.Typed({ type: 'num', allowedTypes: DATNum, displayName: 'Element index', defaultVal: 0 }),
                    },
                    scroll: {
                        scrollType: new fields.SelectFieldSet({
                            fieldSets: {
                                intoView: {},
                                byAmount: {
                                    verticalScrollAmount: new fields.Typed({ 
                                        type: 'num', allowedTypes: DATNum, displayName: 'Vertical amount', defaultVal: 1000 
                                    }),
                                    horizontalScrollAmount: new fields.Typed({ 
                                        type: 'num', allowedTypes: DATNum, displayName: 'Horizontal amount', defaultVal: 1000 
                                    }),
                                }
                            }
                        }),
                        scrollXpath: new fields.Typed({ type: 'str', allowedTypes: DATStr, displayName: 'Xpath', defaultVal: '/' }),
                        scrollIndex: new fields.Typed({ type: 'num', allowedTypes: DATNum, displayName: 'Element index', defaultVal: 0 }),
                    }
                }
            })
        },

    })

    onInit() {
        // Do something on initialization of node
    }

    async handleClick({ msg, xpath, timeout, pageId, index }) {
        try {
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
        console.log('Starting hover')
        try {
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

            await elements[index].hover()
            return msg
        } catch (e) {
            console.log('Unexpected error in mouse node during hover:', e)
            msg.__error = e
            msg.__isError = true
            return msg
        }
    }

    async handleScroll({ 
        msg, 
        pageId,
        type, 
        xpath = '/', 
        amount = { x: 0, y: 0 },
        index = 0
    }) {
        try {
            const context = this._node.context()
            const pages = context.flow.get(`_pages::${msg._msgid}`)
            const page = pages[pageId]
    
            let elements
            if (xpath !== '/') {
                try {
                    elements = await getElementsWithXpath({
                        xpath, timeout: 2000, page
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
            }
    
            switch (type) {
                case 'intoView': {
                    const elem = elements[index]
                    await page.evaluate((elem) => {
                        elem.scrollIntoView()
                    }, elem)
                }
                case 'byAmount': {
                    let elemToScroll
                    if (xpath !== '/') {
                        elemToScroll = elements[index]
                    }
    
                    await page.evaluate((elem, xpath, x, y) => {
                        if (xpath === '/') {
                            window.scrollBy(x, y)
                        } else {
                            elem.scrollBy(x, y)
                        }
                    }, elemToScroll, xpath, amount.x, amount.y)
                }
            }

            return msg
        } catch (e) {
            console.log('scroll', e)
            msg.__error = new Error(`Unexpected error during scroll action: ${e.toString()}`)
            msg.__isError = true
            return msg
        }
    }

    async onMessage(msg, vals) {
        // Prioritising maintainability over code-reuse. Pls don't "fix".
        switch (vals.actionType.selected) {
            case 'click': {
                const { clickXpath, clickTimeout, clickIndex } = vals.actionType.childValues
                const { pageId } = vals
                return await this.handleClick({
                    msg,
                    xpath: clickXpath,
                    timeout: clickTimeout,
                    index: clickIndex,
                    pageId
                })
            }
            case 'hover': {
                const { hoverXpath, hoverTimeout, hoverIndex } = vals.actionType.childValues
                const { pageId } = vals
                return await this.handleHover({
                    msg,
                    xpath: hoverXpath,
                    timeout: hoverTimeout,
                    index: hoverIndex,
                    pageId
                })
            }
            case 'scroll': {
                const { pageId } = vals
                const { scrollXpath: xpath, scrollIndex: index, scrollType } = vals.actionType.childValues
                const type = scrollType.selected
                const args = { msg, xpath, index, type, pageId }

                if (type === 'byAmount') {
                    const { verticalScrollAmount: y, horizontalScrollAmount: x } = scrollType.childValues
                    args.amount = { x, y }
                }

                return await this.handleScroll(args)
            }
            default: return msg
        }

        return msg
    }
}

module.exports = MayaPuppeteerMouse