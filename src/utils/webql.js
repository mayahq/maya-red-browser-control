const getElementsWithXpath = require('./getElementsWithXpath')

const puppeteer = require('puppeteer-core')

const defaults = {
    __type: "text",
    __attribute: "innerText",
    __singleton: true,
};

const dontUseGetAttributeFor = {
    innerHTML: true,
    innerText: true,
    value: true,
};

const isMetaKey = {
    __type: true,
    __attribute: true,
    __singleton: true,
    __selector: true,
    __skip: true,
    __limit: true,
};


// const query = {
//     videos: [{
//         _xpath: ''
//     }],
//     currentVideo: {
//         channel: '',
//         title: ''
//     }
// }

function appendTextFn(xpath) {
    xpath = xpath.trim()
    if (xpath.endsWith('text()')) {
        return xpath
    }

    // Checking if property to be accessed is an attribute,
    // like @href, @src, etc
    const comps = xpath.split('/')
    if (comps[comps.length-1][0] === '@') {
        return xpath
    }

    if (xpath[xpath.length-1] === '/') {
        return `${xpath}text()`
    } else {
        return `${xpath}/text()`
    }
}

/**
 * 
 * @param {puppeteer.ElementHandle | puppeteer.Page} parent 
 * @param {string} xpath 
 * @returns {Array<puppeteer.ElementHandle>}
 */
const getXpathElems = async (parent, xpath, timeout = 0) => {
    try {
        const elems = await getElementsWithXpath({ parent, xpath, timeout })
        console.log('getXpathElems elems', elems)
        return elems
    } catch (e) {
        console.log('getXpathElems error', e)
        switch (e.type) {
            case 'INVALID_XPATH': throw e
            case 'NO_ELEMENTS_FOUND': return []
            default: return []
        }
    }
}

// I'm using OG for-loops everywhere so I don't have to rack my head
// with async functions in iterators. Don't edit.
/**
 * 
 * @param {puppeteer.ElementHandle | puppeteer.Page} parent 
 * @param {string} query 
 * @param {number} timeout 
 * @returns 
 */
async function resolveXpathQuery(parent, query, timeout = 0) {
    console.log('resolveXpathQuery', query)
    if (Array.isArray(query)) {
        if (query.length === 0) {
            return null
        }

        const tempRes = []
        for (let i = 0; i < query.length; i++) {
            const nspec = query[i]
            if (typeof nspec === 'string') {
                const xpath = appendTextFn(nspec)
                const elems = await getXpathElems(parent, xpath, timeout)
                console.log('da elems', elems)
                
                for (let j = 0; j < elems.length; j++) {
                    const elem = elems[j]
                    const tc = await elem.evaluate(el => el.textContent)
                    if (tc) {
                        tempRes.push(tc.trim())
                    } else {
                        // tempRes.push(tc)
                        tempRes.push('')
                    }

                    console.log('tempres', tempRes)
                }
                continue
            }
    
            if (!nspec._xpath) {
                const err = new Error('Must specify _xpath for array of nodes')
                err.type = 'INVALID_QUERY_SPEC'
                err.description = 'Must specify _xpath for array of nodes'
                throw err
            }
    
            const elems = await getXpathElems(parent, nspec._xpath, timeout)
            for (let j = 0; j < elems.length; j++) {
                const elem = elems[j]
                const result = await resolveXpathQuery(elem, nspec, timeout)
                tempRes.push(result)
            }
        }

        return tempRes
    }

    const result = {}
    const queryKeys = Object.keys(query)
    for (let i = 0; i < queryKeys.length; i++) {
        const key = queryKeys[i]
        const val = query[key]

        if (key[0] === '_') { // Hehe that looks like a poker face
            continue
        }
    
        if (typeof val === 'string') {
            // const xpath = appendTextFn(val)
            let ele = null
            try {
                const res = await getXpathElems(parent, val, timeout)
                ele = res[0]
            } catch (e) {
                console.log('error here', e)
                const err = new Error(`Invalid xpath: "${val}"`)
                err.type = 'SYNTAX_ERROR'
                err.description = `Invalid xpath: "${val}"`
                throw err
            }
    
            if (!ele) {
                result[key] = null
                continue
            }
            const tc = await ele.evaluate(e => e.textContent || '', ele)
            result[key] = tc.trim()
            // result[key] = ele.textContent ? ele.textContent.trim() : ele
            continue
        }
    
        if (typeof val !== 'object') {
            const err = new Error('Query spec can either be xpath string or object')
            err.description = 'Query spec can either be xpath string or object'
            err.type = 'INVALID_QUERY_SPEC'
            throw err
        }
    
        if (!Array.isArray(val)) {
            if (!val._xpath) {
                result[key] = await resolveXpathQuery(parent, val, timeout)
                continue
            }
            const tempElems = await getXpathElems(parent, val._xpath)
            if (tempElems.length === 0) {
                result[key] = null
                continue
            }
            result[key] = await resolveXpathQuery(tempElems[0], val, timeout)
            continue
        }
    
        result[key] = await resolveXpathQuery(parent, val, timeout)

    }

    return result
}

/**
 * 
 * @param {puppeteer.Page} page 
 * @param {string} query 
 * @param {number} timeout 
 * @returns {Object}
 */
async function evaluateQuery(page, query, timeout) {
    console.log('evaluateQuery', query)
    return await resolveXpathQuery(page, query, timeout)
}

module.exports = evaluateQuery




// const query = {
//     videos: [{
//         _xpath: "//*[@id='dismissible' and contains(@class, 'compact')]",
//         details: {
//             title: './/h3//span',
//             channel: `.//ytd-video-meta-block//div[@id='metadata']//div[@id='byline-container']//ytd-channel-name//yt-formatted-string`
//         }
//     }]
// }

// const query = {
//     channels: [
//         "//*[@id='dismissible' and contains(@class, 'compact')]//ytd-video-meta-block//div[@id='metadata']//div[@id='byline-container']//ytd-channel-name//yt-formatted-string"
//     ]
// }

// //*[@id='dismissible' and contains(@class, 'compact')]//ytd-video-meta-block//div[@id='metadata']//div[@id='byline-container']//ytd-channel-name//yt-formatted-string


// async function test() {
//     const browser = await puppeteer.launch({
//         headless: false,
//         defaultViewport: null,
//         executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
//     })

//     const page = await browser.newPage()
//     await page.setViewport({
//         width: 1600,
//         height: 900
//     })
//     await page.goto('https://www.youtube.com/watch?v=tvTRZJ-4EyI', {
//         waitUntil: 'networkidle2'
//     })

//     const result = await evaluateQuery(page, query, 2000)
//     console.log(JSON.stringify(result, null, 2))
//     console.log(result)
//     await browser.close()
// }


// test().catch(e => console.log(e))












// const query = {
//     __singleton: false,
//     __type: 'node',
//     title: {
//         __type: 'text',
//         __selector: 'div.title'
//     }
// }

// const query = [{
//     _xpath: 'askhdkasd',
//     title: 'titlexpath',

// }]

// const query = {
//     title: ['//title/video']
// }

// function test() {
    // const query = {
    //     videos: [{
    //         _xpath: '//*[@id="dismissible"]',
    //         details: {
    //             title: './/*[@id="video-title"]/@src',
    //             channel: './/*[@id="text"]/text()'
    //         }
    //     }]
    // }

//     const result = evaluateQuery(query)
//     console.log('SCRAPE', result)
// }

// setTimeout(() => test(), 5000)

// const elems = []
// for (let i = 0; i < result.snapshotLength; i++) {
//     const ele = result.snapshotItem(i)
//     ele.textContent ? elems.push(ele.textContent.trim()) : elems.push(ele)
// }
// result[key] = elems
// return