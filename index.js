require('dotenv').config()
const TelegramBot = require('node-telegram-bot-api')
const { spawn } = require('node:child_process')
const { resolve } = require('node:path')
const fs = require('node:fs')

const { takeScreenshot } = require('./screenshot.js')
const { captionAi } = require('./ai-caption.js')


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

const s = spawn(
  'java',
  [
    '-jar',
    resolve('./minecraft_server.jar'),
    'nogui',
  ]
)

const gracefulShutdown = () => {
  s.stdin.write('stop\n')
}

let seed = null
const getSeed = (data) => {
  seed = new String(data)
    .substring(data.indexOf('Seed: ['))
}
const onServerReady = async () => {
  s.stdin.write('/seed\n')

  await takeScreenshot('360p', ["north"])
  await takeScreenshot('4k', ["north", "south", "east", "west"])

  const cap = await captionAi('./output_360p_north.jpg')
  const finalCaption = `${cap}

${seed}
#MinecraftSeeds #Minecraft`

  const filename = 'output_4k_north'
  const fileOptionsPhoto = {
    filename,
    contentType: 'image/jpg',
  }
  const streamPhoto = fs.createReadStream(`./${filename}.jpg`)
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

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
