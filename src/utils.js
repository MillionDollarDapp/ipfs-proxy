const config = require('../config/config')
const fs = require('fs')
const execFile = require('child_process').execFile

const AWS = require('aws-sdk')
if (config.env === "dev") {
  AWS.config.update(config.aws.dev)
} else {
  AWS.config.update(config.aws.live)
}

const ddb = new AWS.DynamoDB(config.dynamoDb.all)

const ipfsAPI = require('ipfs-api')
const ipfs = ipfsAPI()

const utils = {
  getIPFSHash (name) {
    return new Promise((resolve, reject) => {
      let path = `${config.uploadDir}/${name}`

      fs.readFile(path, (err, data) => {
        if (err) reject(err)
        ipfs.files.add(data, { onlyHash: true }, function (err, files) {
          if (err) reject(err)
          resolve(files[0].hash)
        })
      })
    })
  },

  storeFile (buf) {
    return new Promise((resolve, reject) => {
      let name = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15) + Date.now().toString()
      let path = `${config.uploadDir}/${name}`
      fs.writeFile(path, buf, function (err) {
        if(err) reject(err)
        resolve(name)
      })
    })
  },

  renameImage (name, hash) {
    return new Promise((resolve, reject) => {
      let src = `${config.uploadDir}/${name}`
      let dst = `${config.uploadDir}/${hash}`
      execFile('mv', [src, dst], (err, stdout, stderr) => {
        if (err) reject(stderr)
        resolve()
      })
    })
  },

  addHashToDynamoDb (hash) {
    return new Promise((resolve, reject) => {
      const params = {
        TableName: config.dynamoDb.table_name,
        Item: {
          hash: {'S': hash},
          uploaded: {'N': Math.floor(Date.now() / 1000).toString()},
          expired: {'BOOL': false}
        }
      }

      ddb.putItem(params, function(err) {
        if (err) reject(err)
        resolve()
      })
    })
  },

  sendFileToS3 (hash) {
    return new Promise((resolve, reject) => {
      fs.readFile(`${config.uploadDir}/${hash}`, function (err, data) {
        if (err) reject(err)

        let base64data = Buffer.from(data, 'binary')

        let params = {
          Bucket: config.s3.bucket,
          Key: hash,
          Body: base64data,
          ACL: 'public-read'
        }

        let s3config = config.s3.all
        if (config.env === "dev") s3config.endpoint = config.s3.dev.endpoint

        let s3 = new AWS.S3(s3config);
        s3.putObject(params, function (err) {
          if (err) reject(err)
          resolve()
        })
      })
    })
  }
}

module.exports = { utils: utils }