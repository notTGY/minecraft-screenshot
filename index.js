const mineflayer = require('mineflayer')
const { mineflayer: mineflayerViewer } = require('prismarine-viewer')

// Server configuration
const host = 'localhost' // Change this if your server is not local
const port = 25565
const username = 'SpawnViewerBot' // Bot's username

// Create bot instance
const bot = mineflayer.createBot({
  host: host,
  port: port,
  username: username
})

// Error handling
bot.on('error', (err) => {
  console.error('Bot encountered an error:', err)
})

// When bot spawns
bot.once('spawn', () => {
  console.log('Bot spawned in the world')
  
  // Start the viewer
  mineflayerViewer(bot, {
    port: 3000, // Web server port for viewing (visit localhost:3000 in browser)
    firstPerson: false, // Third person view
    viewDistance: 16 // Chunk view distance
  })

  // Wait a few seconds for chunks to load
  setTimeout(async () => {
    try {
      // Take screenshot
      const buffer = await bot.viewer.getScreenshot()
      
      // Save screenshot to file
      const fs = require('fs')
      fs.writeFileSync('spawn-screenshot.png', buffer)
      console.log('Screenshot saved as spawn-screenshot.png')
      
      // Close bot after taking screenshot
      bot.quit()
      process.exit(0)
    } catch (err) {
      console.error('Error taking screenshot:', err)
      bot.quit()
      process.exit(1)
    }
  }, 5000) // Wait 5 seconds for world to load
})

// Log when connected
bot.on('login', () => {
  console.log('Bot connected to server')
})

// Handle disconnection
bot.on('end', () => {
  console.log('Bot disconnected from server')
})
