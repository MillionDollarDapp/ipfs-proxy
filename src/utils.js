const config = require('../config/config')
const fs = require('fs')

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