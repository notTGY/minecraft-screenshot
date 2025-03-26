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


const viewDistance = 64 // Number of chunks around the center to render

const whFromQual = (qual) => {
  switch (qual) {
    case '4k':
      return { width: 3840, height: 2160 }
    case '360p':
      return { width: 640, height: 360 }
    default:
      throw new Error(`Unknown quality: ${qual}`)
  }
}

const takeScreenshot = async (mcVersion, qual, dirs) => {
  const { width, height } = whFromQual(qual)
  if (dirs.length === 0) {
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
    if (loadedChunks >= (viewDistance * 2 + 1) * (viewDistance * 2 + 1) || loadedChunks == prevLoaded) {
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

  const snap = async (dir) => {
    viewer.camera.position.set(center.x, center.y+10, center.z)

    let x = center.x
    let z = center.z
    switch (dir) {
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
    await fs.writeFile(`output_${qual}_${dir}.jpg`, buf)
  }
  for (const dir of dirs) {
    await snap(dir)
  }
}

module.exports = { takeScreenshot }
