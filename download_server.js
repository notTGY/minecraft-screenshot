const https = require('https');
const fs = require('fs');


const downloadFile = (url, outputFile) => new Promise((resolve, reject) => {
  https.get(url, (response) => {
    if (response.statusCode !== 200) {
      console.error(`Failed to download file. Status code: ${response.statusCode}`)
      return
    }

    const fileStream = fs.createWriteStream(outputFile)
    response.pipe(fileStream)

    fileStream.on('finish', () => {
      fileStream.close()
      console.log(`Successfully downloaded ${outputFile}`)
      resolve()
    })

    response.on('error', (err) => {
      fs.unlink(outputFile, () => {})
      console.error('Error during download:', err.message)
      reject()
    })
  }).on('error', (err) => {
    console.error('Error making request:', err.message);
    reject()
  })
})

const loadJson = (filePath) => {
  try {
    const jsonData = fs.readFileSync(filePath, 'utf8')
    const obj = JSON.parse(jsonData)
    return obj
  } catch(e) {
    console.error('Error loading version manifest:', error.message)
    if (error.code === 'ENOENT') {
      console.error(`File not found: ${filePath}`)
    } else if (error instanceof SyntaxError) {
      console.error('Invalid JSON format in file')
    }
    return null
  }
}

const downloadManifest = () => {
  const url = 'https://launchermeta.mojang.com/mc/game/version_manifest.json'
  const outputFile = 'version_manifest.json'
  return downloadFile(url, outputFile)
}
const downloadVersionInfo = (mcVersion) => {
  const manifest = loadJson('version_manifest.json')
  const url = manifest.versions.find(v => v.id == mcVersion).url
  const outputFile = `manifest_${mcVersion}.json`
  return downloadFile(url, outputFile)
}

const downloadServer = async (mcVersion) => {
  await downloadManifest()
  await downloadVersionInfo(mcVersion)
  console.log('hi')
  process.exit(1)
}
module.exports = { downloadServer }
