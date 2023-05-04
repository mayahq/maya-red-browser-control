const puppeteer = require('puppeteer-core')

/**
 * Find all elements that correspond to a given xpath.
 * Throws error if no such elements exist or if xpath is invalid.
 * 
 * @param {Object} options
 * @param {string} options.xpath - xpath for which you want to find corresponding elements
 * @param {number} options.timeout - Time (in ms) for which it waits for element to appear, before throwing error
 * @param {puppeteer.Page} options.page - puppeteer page instance on which you want to find elements
 * @param {puppeteer.ElementHandle} options.parent - puppeteer page instance on which you want to find elements
 * @returns 
 */
async function getElementsWithXpath({ parent = null, page, xpath, timeout }) {
    console.log('getElementsWithXpath', parent, page, page.waitForXPath)
    if (!parent) {
        parent = page
    }

    let elements
    try {
        elements = await parent.$x(xpath)
    } catch (e) {
        console.log('Error in evaluation:', e)
        const err = new Error('Invalid xpath')
        err.type = 'INVALID_XPATH'
        throw err
    }

    if (elements.length === 0) {
        try {
            await parent.waitForXPath(xpath, { timeout })
            elements = await parent.$x(xpath)
        } catch (e) {
            console.log('xpath find err', e)
            const err = new Error('No elements found for xpath')
            err.type = 'NO_ELEMENTS_FOUND'
            throw err
        }
    }

    return elements
}

module.exports = getElementsWithXpath