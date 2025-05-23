require('dotenv').config()
const DEBUG = process.env.DEBUG

global.THREE = require('three')
global.Worker = require('worker_threads').Worker
const { createCanvas } = require('node-canvas-webgl/lib')
const fs = require('fs').promises
const path = require('path')
const Vec3 = require('vec3').Vec3
const { Viewer, WorldView, getBufferFromStream } = require('prismarine-viewer').viewer
const mineflayer = require('mineflayer')
const { execSync } = require('child_process')


const whFromQuality = (quality) => {
  switch (quality) {
    case '4k':
      return { width: 3840, height: 2160 }
    case '360p':
      return { width: 640, height: 360 }
    case '206p':
      return { width: 336, height: 206 }
    default:
      throw new Error(`Unknown quality: ${qual}`)
  }
}

const takeScreenshot = async ({
  mcVersion,
  viewDistance,
  quality,
  directions,
}) => {
  const { width, height } = whFromQuality(quality)
  if (directions.length === 0) {
    throw new Error('No directions')
  }

  const canvas = createCanvas(width, height)
  const renderer = new THREE.WebGLRenderer({ canvas })
  const viewer = new Viewer(renderer)

  const bot = mineflayer.createBot()

  let prevLoaded = -1 
  const check = (res) => {
    const loadedChunks = Object.keys(bot.world.async.columns).length
    if (DEBUG) {
      console.log(`Chunks loaded: ${loadedChunks}`)
    }
    if (
      loadedChunks >= (viewDistance * 2 + 1) * (viewDistance * 2 + 1)
      || (loadedChunks == prevLoaded && loadedChunks > 0)
    ) {
      res()
    } else {
      setTimeout(() => {
        check(res)
      }, 1000)
    }
    prevLoaded = loadedChunks
  }
  await new Promise(
    resolve => bot.once('spawn', () => {
      check(resolve)
    })
  )
  const center = bot.entity.position.clone()
  if (!viewer.setVersion(mcVersion)) {
    console.error('Failed to set viewer version')
    return false
  }

  const worldView = new WorldView(bot.world, viewDistance, center)
  viewer.listen(worldView)

  const snap = async (direction) => {
    viewer.camera.position.set(center.x, center.y+10, center.z)

    let x = center.x
    let z = center.z
    switch (direction) {
      case "south":
      default:
        z += 10
        break
      case "north":
        z -= 10
        break
      case "east":
        x += 10
        break
      case "west":
        x -= 10
        break
    }

    viewer.camera.lookAt(new THREE.Vector3(x, center.y+10, z))

    await worldView.init(center)
    await viewer.world.waitForChunksToRender()
    renderer.render(viewer.scene, viewer.camera)
    const imageStream = canvas.createJPEGStream({
      bufsize: 4096,
      quality: 100,
      progressive: false
    })

    const buf = await getBufferFromStream(imageStream)
    await fs.writeFile(`output/${quality}_${direction}.jpg`, buf)
  }
  for (let i = 0; i < directions.length; i++) {
    const direction = directions[i]
    await snap(direction)
    const p = (100*(i+1)/directions.length).toFixed(0)
    bot.chat(
      `Took ${quality} picture of ${direction}; ${p}% Done`
    )
  }
  /*
  bot.on('chat', (username, message) => {
    if (username === 'Player') return;
    console.log({message})
    bot.chat(message)
  })
  */
}

module.exports = { takeScreenshot }
