const dotenv = require("dotenv").config()
const { MongoClient } = require("mongodb")
const client = new MongoClient(process.env.CONNECTIONSTRING)


async function start() {
    await client.connect()
    module.exports = client
    console.log("db conntected")
    const app = require("./server")
}

start();