require('dotenv').config()
const TelegramBot = require('node-telegram-bot-api')

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

module.exports = { sendMessage }
