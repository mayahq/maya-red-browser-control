const chromeLauncher = require('chrome-launcher')
const puppeteer = require('puppeteer-core')
const axios = require('axios')

async function launchChrome() {
    const chrome = await chromeLauncher.launch({
        // chromeFlags: ['--headless']
    })
    console.log('Chrome port:', chrome.port)
    
    const response = await axios.get(`http://localhost:${chrome.port}/json/version`)
    const { webSocketDebuggerUrl } = response.data
    
    console.log(webSocketDebuggerUrl)
}

async function launchWithPup() {
    const browser = await puppeteer.launch({
        channel: 'chrome',
        headless: false,
        userDataDir: '/Users/dushyant/Library/Application Support/Google/Chrome',
        defaultViewport: null
    })

    const version = browser.wsEndpoint()
    console.log(version)
    await browser.close()
}

// launchChrome()
launchWithPup()