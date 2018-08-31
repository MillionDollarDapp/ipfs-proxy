'use strict'

const { getIPFSHash, writeToUploadDir, addHashToDynamoDb, sendFileToS3 } = require('./utils')
const express = require('express')
const cors = require('cors')
const multer  = require('multer')
const fileType = require('file-type')

const app = express()

app.use(cors())

app.get('/', function (req, res) {
    res.sendStatus(404)
})

app.get('/ping', function (req, res) {
  res.send('pong')
});

var storage = multer.memoryStorage()

var upload = multer({
  storage: storage,
  limits:{
    fileSize: 1024* 1024 * 1024 // 1 MB
  }
})

app.post('/upload', upload.single('image'), async function (req, res) {
  let mimeType = fileType(req.file.buffer)
  if (mimeType.mime !== 'image/jpeg' && mimeType.mime !== 'image/png') {
    res.sendStatus(403)
  } else {
    try {
      let hash = await getIPFSHash(req.file.buffer)
      await writeToUploadDir(req.file.buffer, hash) // To add it later to ipfs
      await addHashToDynamoDb(hash)
      await sendFileToS3(hash)
      res.json({ hash: hash })
    } catch (e) {
      console.error(e)
      res.sendStatus(503)
    }
  }
})

app.listen(3000, function () {
  console.log('Listening on port 3000.')
})
