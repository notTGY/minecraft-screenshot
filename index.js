require('dotenv').config()
const TelegramBot = require('node-telegram-bot-api')
const { spawn } = require('node:child_process')
const { resolve } = require('node:path')
const fs = require('node:fs')

const { takeScreenshot } = require('./screenshot.js')
const { captionAi } = require('./ai-caption.js')
const { downloadServer } = require('./download_server.js')


const startTime = Date.now()

const chatId = process.env.TGID
const botToken = process.env.BOT_TOKEN
const DEBUG = process.env.DEBUG

const bot = new TelegramBot(botToken, {
  polling: true,
  filepath: false,
})

const args = process.argv.slice(2)
if (args.length > 0 && args[0] === "regen") {
  fs.rmSync('./world', {
    force: true,
    recursive: true,
  })
  if (DEBUG) {
    console.log("removed world")
  }
}

let seed = null
const getSeed = (data) => {
  seed = new String(data)
    .substring(data.indexOf('Seed: ['))
}

const start = async () => {
  const mcVersion = '1.21.4' // Minecraft version (must match the server)
  if (!fs.existsSync('./minecraft_server.jar')) {
    await downloadServer(mcVersion)
  }

  const s = spawn(
    'java',
    [
      '-Xmx1024M',
      '-Xms1024M',
      '-jar',
      resolve('./minecraft_server.jar'),
      'nogui',
    ]
  )
  const gracefulShutdown = () => {
    s.stdin.write('stop\n')
  }
  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);

  const onServerReady = async () => {
    s.stdin.write('/seed\n')

    if (!fs.existsSync('./output')) {
      fs.mkdirSync('./output')
    }
    await takeScreenshot(mcVersion, '360p', ["north"])
    await takeScreenshot(mcVersion, '4k', ["north", "south", "east", "west"])

    const cap = await captionAi('./output/360p_north.jpg')
    const finalCaption = `${cap}

  ${seed}
#MinecraftSeeds #Minecraft`

    const filename = '4k_north'
    const fileOptionsPhoto = {
      filename,
      contentType: 'image/jpg',
    }
    const streamPhoto = fs.createReadStream(`./output/${filename}.jpg`)
    bot.sendPhoto(chatId, streamPhoto, {
      caption: finalCaption,
    }, fileOptionsPhoto)

    if (DEBUG) {
      console.log({finalCaption})
    }

    gracefulShutdown()
    const endTime = Date.now()
    const dt = (endTime - startTime) / (60*1000)
    console.log(`Took ${dt}m`)
  }

  s.stdout.on('data', (data) => {
    if (DEBUG) {
      console.log(`# ${data}`)
    }
    if (data.indexOf(': Done ') != -1) {
      if (DEBUG) {
        console.log('Server ready!')
      }
      onServerReady()
    }
    if (data.indexOf('Seed: [') != -1) {
      getSeed(data)
    }
  })

  s.stderr.on('data', (data) => {
    console.error(`stderr: ${data}`)
  })

  s.on('close', (code) => {
    if (DEBUG) {
      console.log(`exited with code ${code}`)
    }
    process.exit(0)
  })
}
start()
