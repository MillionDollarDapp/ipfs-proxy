const config = require('../config/config')
const fs = require('fs')

const AWS = require('aws-sdk')
if (config.env === "dev") {
  AWS.config.update(config.aws.dev)
} else {
  AWS.config.update(config.aws.live)
}

const ipfsAPI = require('ipfs-api')
const ipfs = ipfsAPI()

module.exports = {
  getIPFSHash (buf) {
    return new Promise((resolve, reject) => {
      ipfs.files.add(buf, { onlyHash: true }, function (err, files) {
        if (err) reject(err)
        resolve(files[0].hash)
      })
    })
  },

  writeToUploadDir (buf, hash) {
    return new Promise((resolve, reject) => {
      fs.writeFile(config.uploadDir + "/" + hash, buf, function (err) {
        if(err) reject(err)
        resolve()
      });
    })
  },

  addHashToDynamoDb (hash) {
    return new Promise((resolve, reject) => {
      const docClient = new AWS.DynamoDB.DocumentClient()
      const params = {
        TableName: config.dynamoDb.table_name,
        Item: {
          hash: hash,
          uploaded: Math.floor(Date.now() / 1000)
        }
      }

      docClient.put(params, function(err) {
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
          console.log('Successfully uploaded image.')
          resolve()
        })
      })
    })
  }
}