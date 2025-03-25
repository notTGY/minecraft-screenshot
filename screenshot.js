require('dotenv').config(); // For environment variables
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

//const K4 = true // use 4K UHD or 360p

const takeScreenshot = async (K4) => {
  // Configuration constants
  const viewDistance = 16 // Number of chunks around the center to render
  const width = K4 ? 3840 : 640     // Screenshot width in pixels
  const height = K4 ? 2160 : 360    // Screenshot height in pixels
  const version = '1.21.4' // Minecraft version (must match the server)

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
  // Wait for the bot to spawn in the world
  await new Promise(resolve => bot.once('spawn', () => {
    check(resolve)
  }))

  // Use the bot's spawn position as the center of the view
  const center = bot.entity.position.clone()

  // Set the viewer's Minecraft version
  if (!viewer.setVersion(version)) {
    console.error('Failed to set viewer version')
    return false
  }

  // Create a WorldView using the bot's world, centered on the bot's position
  const worldView = new WorldView(bot.world, viewDistance, center)
  viewer.listen(worldView)

  // Position the camera 10 blocks above and offset from the center for a good view
  const cameraPos = center.clone().add(new Vec3(0, 10, 0))
  viewer.camera.position.set(cameraPos.x, cameraPos.y, cameraPos.z)

  // Make the camera look at the center (bot's position)
  viewer.camera.lookAt(new THREE.Vector3(center.x-10, center.y+10, center.z))

  // Initialize the WorldView and wait for chunks to load
  await worldView.init(center)
  await viewer.world.waitForChunksToRender()

  // Render the scene
  renderer.render(viewer.scene, viewer.camera)

  // Create a JPEG stream from the canvas
  const imageStream = canvas.createJPEGStream({
    bufsize: 4096,
    quality: 100,
    progressive: false
  })

  const buf = await getBufferFromStream(imageStream)
  await fs.writeFile(K4 ? 'output_4k.jpg' : 'output.jpg', buf)
  //execSync('output.png')

  if (DEBUG) {
    console.log('saved')
  }
  //process.exit(0)
}

module.exports = { takeScreenshot }
