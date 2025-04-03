require('dotenv').config()
const DEBUG = process.env.DEBUG

const minecraftWrap = require('minecraft-wrap')
const fs = require('node:fs')
const { takeScreenshot } = require('./src/MCBot.js')
const { captionAi } = require('./src/AICaption.js')
const { sendMessage } = require('./src/reporter.js')

const startTime = Date.now()
const mcVersion = '1.21.4' // Minecraft version (must be supported by mineflayer, prismarine-viewer)
const viewDistance = 64
const path = require('node:path')
const jarLocation = path.resolve('./minecraft_server.jar')
const serverRoot = './server'

const sleep = (t) => new Promise(r => setTimeout(r, t))

let seed = null
const getSeed = (data) => {
  seed = new String(data)
    .substring(data.indexOf('Seed: '))
}

const promisify = (fn, fnThis, ...args) => {
  return new Promise((res, rej) => {
    fn.call(fnThis, ...args, (err) => {
      if (err) {
        rej(err)
      }
      res()
    })
  })
}

const start = async () => {
  if (!fs.existsSync(jarLocation)) {
    await promisify(minecraftWrap.downloadServer, minecraftWrap, mcVersion, jarLocation)
    if (DEBUG) {
      console.log('downloaded jar file')
    }
  }

  const s = new minecraftWrap.WrapServer(
    jarLocation,
    serverRoot,
  )
  s.on('line', (line) => {
    if (DEBUG) {
      console.log(`# ${line}`)
    }
    if (line.indexOf('Seed: ') != -1) {
      getSeed(line)
    }
  })
  const args = process.argv.slice(2)
  if (args.length > 0 && args[0] === "regen") {
    await promisify(s.deleteServerData, s)
    if (DEBUG) {
      console.log('deleted server data')
    }
  }
  await promisify(s.startServer, s, {
    'online-mode': false,
    'view-distance': viewDistance,
    difficulty: 0,
    'spawn-animals': false,
    'spawn-npcs': false,
    'spawn-monsters': false,
  })
  if (DEBUG) {
    console.log('started server')
  }

  const gracefulShutdown = async () => {
    await promisify(s.stopServer, s)
    if (DEBUG) {
      console.log('server stopped')
    }
    process.exit(0)
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
  } else {
    console.log('Reporter disabled, add BOT_TOKEN in .env')
  }

  const endTime = Date.now()
  const dt = (endTime - startTime) / (60*1000)
  console.log(`Took ${dt}m`)
  gracefulShutdown()
}
start()
