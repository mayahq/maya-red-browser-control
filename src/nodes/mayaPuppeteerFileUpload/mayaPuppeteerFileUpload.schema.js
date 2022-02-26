const {
    Node,
    Schema,
    fields
} = require('@mayahq/module-sdk')
const { nodeColor } = require('../../constants')
const getElementsWithXpath = require('../../utils/getElementsWithXpath')

const DATStr = ['str', 'msg', 'flow', 'global']
const DATNum = ['num', 'msg', 'flow', 'global']

class MayaPuppeteerFileUpload extends Node {
    constructor(node, RED, opts) {
        super(node, RED, {
            ...opts,
            // masterKey: 'You can set this property to make the node fall back to this key if Maya does not provide one'
        })
    }

    static schema = new Schema({
        name: 'maya-puppeteer-file-upload',
        label: 'Upload File',
        category: 'Maya Red Browser Control',
        isConfig: false,
        icon: 'chrome.png',
        color: nodeColor,
        fields: {
            pageId: new fields.Typed({ type: 'msg', allowedTypes: DATStr, displayName: 'Page ID', defaultVal: 'pageIds[0]' }),
            inputXpath: new fields.Typed({ type: 'str', allowedTypes: DATStr, displayName: 'Input xpath', defaultVal: '//input' }),
            index: new fields.Typed({ type: 'num', allowedTypes: DATNum, displayName: 'Index', defaultVal: 0 }),
            timeout: new fields.Typed({ type: 'num', allowedTypes: DATNum, displayName: 'Timeout', defaultVal: 2000 }),
            pathToFile: new fields.Typed({ type: 'str', allowedTypes: DATStr, displayName: 'File path', defaultVal: '/path/to/file' })
        },

    })

    onInit() {
        // Do something on initialization of node
    }


    async onMessage(msg, vals) {
        const context = this._node.context()
        
        const { inputXpath: xpath, timeout, index, pathToFile, pageId } = vals
        const pages = context.flow.get(`_pages::${msg._msgid}`)
        const page = pages[pageId]

        console.log('xpath', xpath)
        let elements
        try {
            elements = await getElementsWithXpath({ page, timeout, xpath })
            if (elements.length - 1 < index) {
                throw new Error(`Index out of bounds. Only ${elements.length} elements found for given xpath`)
            }
        } catch (e) {
            msg.__error = e
            msg.__isError = true
            return msg
        }

        console.log('here 1')
        const inputField = elements[index]
        await inputField.uploadFile(pathToFile)
        console.log('here 2')
        return msg
    }
}

module.exports = MayaPuppeteerFileUpload