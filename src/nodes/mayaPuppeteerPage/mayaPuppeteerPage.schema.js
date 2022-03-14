const {
    Node,
    Schema,
    fields
} = require('@mayahq/module-sdk')
const puppeteer = require('puppeteer-core')
const { nodeColor } = require('../../constants')

const DATStr = ['str', 'msg', 'flow', 'global']
const DATNum = ['num', 'msg', 'flow', 'global']
const waitOptions = [
    'networkidle0',
    'networkidle2',
    'load',
    'domcontentloaded'
]
const pageFormatOptions = [
    'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'Legal', 'Letter', 'Tabloid'
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
        color: nodeColor,
        icon: 'chrome.png',
        fields: {
            pageId: new fields.Typed({ type: 'msg', allowedTypes: DATNum, displayName: 'Page ID', defaultVal: 'pageIds[0]' }),
            actionType: new fields.SelectFieldSet({
                displayName: 'Action',
                fieldSets: {

                    navigate: {
                        url: new fields.Typed({ type: 'str', allowedTypes: DATStr, displayName: 'URL', defaultVal: 'https://www.example.com' }),
                        waitUntil: new fields.Select({ options: waitOptions, defaultVal: 'networkidle2' }),
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

                    close: {},

                    generatePDF: {
                        pdfDestinationPath: new fields.Typed({ 
                            type: 'str', allowedTypes: DATStr, displayName: 'Ouput file path', defaultVal: '/absolute/path/to/output/file' 
                        }),
                        pdfScale: new fields.Typed({
                            type: 'num', allowedTypes: DATNum, displayName: 'Scale', defaultVal: 1
                        }),
                        headerTemplate: new fields.Typed({
                            type: 'str', allowedTypes: DATStr, displayName: 'Header HTML', defaultVal: ''
                        }),
                        footerTemplate: new fields.Typed({
                            type: 'str', allowedTypes: DATStr, displayName: 'Footer HTML', defaultVal: ''
                        }),
                        pdfOrientation: new fields.Select({
                            options: ['portrait', 'landscape'], defaultVal: 'portrait', displayName: 'Orientation'
                        }),
                        pdfPageFormat: new fields.Select({
                            options: pageFormatOptions, defaultVal: 'A4', displayName: 'Page format'
                        }),
                        useCustomMargins: new fields.SelectFieldSet({
                            fieldSets: {
                                No: {},
                                Yes: {
                                    pdfTopMargin: new fields.Typed({ type: 'str', allowedTypes: DATStr, displayName: 'Top' }),
                                    pdfRightMargin: new fields.Typed({ type: 'str', allowedTypes: DATStr, displayName: 'Right' }),
                                    pdfBottomMargin: new fields.Typed({ type: 'str', allowedTypes: DATStr, displayName: 'Bottom' }),
                                    pdfLeftMargin: new fields.Typed({ type: 'str', allowedTypes: DATStr, displayName: 'Left' }),
                                },
                            }
                        })
                    },

                    screenshot: {
                        ssDestinationPath: new fields.Typed({ 
                            type: 'str', allowedTypes: DATStr, displayName: 'Ouput file path', defaultVal: '/absolute/path/to/output/file' 
                        }),
                        ssType: new fields.Select({
                            options: ['png', 'jpeg', 'webp'], defaultVal: 'png', displayName: 'Type'
                        }),
                        ssQuality: new fields.Typed({
                            type: 'num', allowedTypes: DATNum, displayName: 'Quality (1-100)', defaultVal: 100
                        }),
                        captureArea: new fields.SelectFieldSet({
                            displayName: 'Capture area',
                            fieldSets: {
                                visiblePage: {},
                                fullScrollablePage: {},
                                custom: {
                                    ssx: new fields.Typed({ type: 'num', allowedTypes: DATNum, displayName: 'X coordinate', defaultVal: 0 }),
                                    ssy: new fields.Typed({ type: 'num', allowedTypes: DATNum, displayName: 'Y coordinate', defaultVal: 0 }),
                                    ssWidth: new fields.Typed({ type: 'num', allowedTypes: DATNum, displayName: 'Width', defaultVal: 0 }),
                                    ssHeight: new fields.Typed({ type: 'num', allowedTypes: DATNum, displayName: 'Height', defaultVal: 0 }),
                                }
                            }
                        })
                    },

                    setViewport: {

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
                const {  url, waitUntil, viewport } = vals.actionType.childValues
                this.setStatus('PROGRESS', `Navigating to ${url}`)
                if (viewport.selected === 'custom') {
                    await page.setViewport({
                        width: viewport.childValues.vwidth,
                        height: viewport.childValues.vheight
                    })
                }
                await page.goto(url, { waitUntil })
                this.setStatus('SUCCESS', `Navigated to ${url}`)
                return msg
            }

            case 'close': {
                await page.close()
                return msg
            }

            case 'generatePDF': {
                this.setStatus('PROGRESS', 'Saving page as PDF')
                const {
                    pdfDestinationPath,
                    pdfScale,
                    headerTemplate,
                    footerTemplate,
                    pdfOrientation,
                    pdfPageFormat,
                    useCustomMargins
                } = vals.actionType.childValues

                let options = {
                    path: pdfDestinationPath,
                    scale: pdfScale,
                    format: pdfPageFormat
                }

                if (headerTemplate !== '' || footerTemplate !== '') {
                    options = {
                        ...options,
                        displayHeaderFooter: true,
                        headerTemplate,
                        footerTemplate
                    }
                }

                if (pdfOrientation === 'landscape') {
                    options.landscape = true
                }

                if (useCustomMargins.selected === 'Yes') {
                    const {
                        pdfTopMargin = 0,
                        pdfRightMargin = 0,
                        pdfBottomMargin = 0,
                        pdfLeftMargin = 0
                    } = useCustomMargins.childValues
                    options = {
                        ...options,
                        margin: {
                            top: pdfTopMargin,
                            right: pdfRightMargin,
                            bottom: pdfBottomMargin,
                            left: pdfLeftMargin
                        }
                    }
                }

                await page.pdf(options)
                this.setStatus('SUCCESS', `Saved PDF to ${options.path}`)
                return msg
            }

            case 'screenshot': {
                const {
                    ssDestinationPath: path,
                    ssType: type,
                    ssQuality: quality,
                    captureArea
                } = vals.actionType.childValues

                const options = { path, type }
                if (type !== 'png') {
                    options.quality = quality
                }

                switch (captureArea.selected) {
                    case 'fullScrollablePage': {
                        options.fullPage = true
                        break
                    }
                    case 'custom': {
                        const {
                            ssx: x,
                            ssy: y,
                            ssWidth: width,
                            ssHeight: height
                        } = captureArea.childValues
                        options.clip = { x, y, width, height }
                        break
                    }
                    case 'visiblePage': break
                    default: break
                }

                this.setStatus('PROGRESS', 'Taking screenshot')
                await page.screenshot(options)
                this.setStatus('SUCCESS', `Saved screenshot to ${path}`)
            }
            default: return msg
        }
    }
}

module.exports = MayaPuppeteerPage