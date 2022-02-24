const puppeteer = require('puppeteer-core')

/**
 * Find all elements that correspond to a given xpath.
 * Throws error if no such elements exist or if xpath is invalid.
 * 
 * @param {Object} options
 * @param {string} options.xpath - xpath for which you want to find corresponding elements
 * @param {number} options.timeout - Time (in ms) for which it waits for element to appear, before throwing error
 * @param {puppeteer.Page} options.page - puppeteer page instance on which you want to find elements
 * @returns 
 */
async function getElementsWithXpath({ xpath, timeout, page }) {
    let elements
    try {
        elements = await page.$x(xpath)
    } catch (e) {
        console.log('Error in evaluation:', e)
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

module.exports = getElementsWithXpath