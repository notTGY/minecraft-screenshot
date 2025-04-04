const fs = require('fs').promises
const { OpenAI } = require('openai')
require('dotenv').config()

const DEBUG = process.env.DEBUG

async function captionImage(imagePath, prompt) {
  const client = new OpenAI({
    baseURL: "https://router.huggingface.co/hf-inference/v1",
    apiKey: process.env.HF_API_TOKEN,
  })

  try {
    const imageData = await fs.readFile(imagePath)
    const base64Image = Buffer.from(imageData).toString('base64')
    
    const stream = await client.chat.completions.create({
      model: "Qwen/Qwen2.5-VL-7B-Instruct",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
              }
            },
          ],
        },
      ],
      max_tokens: 100,
      temperature: 0.5,
      stream: true,
    })

    let caption = ""
    for await (const chunk of stream) {
      if (chunk.choices && chunk.choices.length > 0) {
        const newContent = chunk.choices[0].delta.content || ''
        caption += newContent
        if (DEBUG) {
          process.stdout.write(newContent)
        }
      }
    }
    if (DEBUG) {
      console.log('\nFull Caption:', caption)
    }
    return caption
  } catch (error) {
    console.error('Error:', error.message)
    if (error.response) {
      console.error('API Response:', error.response.data)
    }
    throw error
  }
}

async function captionAi(imagePath) {
  const prompt = "Write a brief, creative description of this Minecraft screenshot in 2-3 sentences, capturing its visual elements, terrain features, and atmosphere in a natural, engaging way, as if for a casual Telegram post, without including hashtags, seed numbers, or extra commentary."

  try {
    const caption = await captionImage(imagePath, prompt)
    if (DEBUG) {
      console.log('Success! Final caption:', caption);
    }
    return caption
  } catch (error) {
    console.error('Failed to process image:', error.message);
  }
}

module.exports = { captionAi }
