require('dotenv').config()
const minecraftWrap = require('minecraft-wrap')
const TelegramBot = require('node-telegram-bot-api')
const { spawn } = require('node:child_process')
const { resolve } = require('node:path')
const fs = require('node:fs')

const { takeScreenshot } = require('./screenshot.js')
const { captionAi } = require('./ai-caption.js')


const startTime = Date.now()

const DEBUG = process.env.DEBUG

const mcVersion = '1.21.4' // Minecraft version (must match the server)
const viewDistance = 64
const jarLocation = './minecraft_server.jar'

const sendMessage = async (caption) => {
  const chatId = process.env.TGID
  const botToken = process.env.BOT_TOKEN
  const bot = new TelegramBot(botToken, {
    polling: true,
    filepath: false,
  })
  const filename = '4k_north'
  const fileOptionsPhoto = {
    filename,
    contentType: 'image/jpg',
  }
  const streamPhoto = fs.createReadStream(`./output/${filename}.jpg`)
  await bot.sendPhoto(chatId, streamPhoto, { caption }, fileOptionsPhoto)

  if (DEBUG) {
    console.log({caption})
  }
}

const args = process.argv.slice(2)
/*
if (args.length > 0 && args[0] === "regen") {
  fs.rmSync('./world', {
    force: true,
    recursive: true,
  })
  if (DEBUG) {
    console.log("removed world")
  }
}
*/
const sleep = (t) => new Promise(r => setTimeout(r, t))

let seed = null
const getSeed = (data) => {
  seed = new String(data)
    .substring(data.indexOf('Seed: '))
}

const downloadServer = () => new Promise(
  (resolve, reject) => {
    minecraftWrap.downloadServer(mcVersion, jarLocation, (err) => {
      if (err) {
        reject(err)
      }
      resolve()
    })
  },
)

const startServer = (s) => new Promise(
  (resolve, reject) => {
    s.startServer({
      'online-mode': false,
      'view-distance': viewDistance,
    }, function (err) {
      if (err) {
        reject(err)
        return
      }
      resolve()
    })
  }
)
const deleteServerData = (s) => new Promise(
  (resolve, reject) => {
    s.deleteServerData({
    }, function (err) {
      if (err) {
        reject(err)
        return
      }
      if (DEBUG) {
        console.log('removed data')
      }
      resolve()
    })
  }
)

const start = async () => {
  if (!fs.existsSync(jarLocation)) {
    await downloadServer()
  }

  const s = new minecraftWrap.WrapServer(
    jarLocation,
    '.',
  )
  s.on('line', (line) => {
    if (DEBUG) {
      console.log(`# ${line}`)
    }
    if (line.indexOf('Seed: ') != -1) {
      getSeed(line)
    }
  })
  if (args.length > 0 && args[0] === "regen") {
    await deleteServerData(s)
  }
  await startServer(s)
  if (DEBUG) {
    console.log('started server')
  }

  const gracefulShutdown = () => {
    s.stopServer((err) => {
      if (err) {
        console.log(err)
      }
      if (DEBUG) {
        console.log('server stopped')
      }
      process.exit(0)
    })
  }
  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);


  s.writeServer('/seed\n')
  await sleep(1000)

  if (!fs.existsSync('./output')) {
    fs.mkdirSync('./output')
  }
  await takeScreenshot({
    mcVersion,
    viewDistance,
    quality: '360p',
    directions: ["north"],
  })
  await takeScreenshot({
    mcVersion,
    viewDistance,
    quality: '4k',
    directions: ["north", "south", "east", "west"],
  })

  let cap = ''
  if (process.env.HF_API_TOKEN) {
    cap = await captionAi('./output/360p_north.jpg')
  } else {
    cap = 'AI DISABLED, add HF_API_TOKEN in .env'
  }
  const caption = `${cap}

${seed}
#MinecraftSeeds #Minecraft`

  if (process.env.BOT_TOKEN) {
    await sendMessage(caption)
  }

  const endTime = Date.now()
  const dt = (endTime - startTime) / (60*1000)
  console.log(`Took ${dt}m`)
  gracefulShutdown()
}
start()
