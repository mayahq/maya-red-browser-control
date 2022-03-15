const os = require('os')
const crypto = require('crypto')
const path = require('path')
const { localDb } = require('@mayahq/maya-db')
const puppeteer = require('puppeteer-core')
const express = require('express')
const fp = require('find-free-port')

const PuppeteerControlServer = require('./controller')

// const KILL_TIMEOUT = 5 * 60 * 1000 // 5 minutes
const KILL_TIMEOUT = 5 * 60 * 1000 // 10 seconds
const MINUTE = 60*1000
const VERSION = 1

const app = express()
app.use(express.json())


const pcs = new PuppeteerControlServer()
const mayaFolder = process.env.NODE_ENV === 'development' ? '.mayadev' : '.maya'

const db = localDb({
    root: path.join(os.homedir(), mayaFolder, 'db/browserAutomation')
})

let started = false

function generateId() {
    return crypto.randomBytes(8).toString('hex')
}

app.get('/healthcheck', (req, res) => {
    const response = {
        status: 'OK',
        version: VERSION
    }
    return res.send(response)
})

app.post('/start_browser', async (req, res) => {
    const id = generateId()
    const opts = req.body.opts
    try {
        const wsEndpoint = await pcs.connect(id, opts)
        return res.status(201).send({
            connectionId: id,
            status: 'STARTED',
            wsEndpoint: wsEndpoint
        })
    } catch (e) {
        console.log('Error starting browser', e)
        return res.status(500).send({
            status: 'ERROR',
            error: e
        })
    }
})

app.post('/stop_browser', async (req, res) => {
    const { connectionId, opts } = req.body
    try {
        await pcs.disconnect(connectionId, opts)
        return res.status(200).send({
            status: 'STOPPED'
        })
    } catch (e) {
        console.log('Error stopping browser', e)
        return res.status(500).send({
            status: 'ERROR',
            error: e
        })
    }
})

app.post('/kill_controller', async (req, res) => {
    res.send({
        status: 'KILLED'
    })
    setTimeout(() => process.exit(0), 500)
})

async function startServer() {
    await db.ensureHierarchy({
        connections: 'BLOCK'
    })
    const connBlock = db.block('connections')
    const [freePort] = await fp(32016)
    connBlock.lockAndUpdate({
        serverPort: { $set: freePort }
    })

    app.listen(freePort, () => {
        console.log(`Puppeteer control server running on :${freePort}`)
        started = true
    })
}

startServer()

process.on('message', async (msg) => {
    console.log('Message from starting client:', msg)
    switch (msg.type) {
        case 'START_CONTROLLER': {
            const interval = setInterval(() => {
                if (started) {
                    process.send({
                        type: 'CONTROLLER_STARTED'
                    })
                    return clearInterval(interval)
                }
            }, 50)
        }
        case 'STOP_CONTROLLER': {
            process.exit()
        }
        default: return
    }
})