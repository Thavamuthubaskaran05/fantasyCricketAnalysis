// db.js
const { MongoClient, ServerApiVersion } = require("mongodb");

const DB_USER = process.env["DB_USER"];
const DB_PWD = process.env["DB_PWD"];
const DB_URL = process.env["DB_URL"];
const DB_NAME = "task-";

const uri = `mongodb://localhost:27017/`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let db;

async function connectToDatabase() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });

    db = client.db(DB_NAME);

    console.log("Successfully connected to MongoDB!");
  } catch (error) {
    console.error("Failed to connect to MongoDB", error);
    process.exit(1); // Exit the process with failure
  }
}

function getDb() {
  if (!db) {
    throw new Error("Database not initialized. Call connectToDatabase first.");
  }
  return db;
}

module.exports = {
  connectToDatabase,
  getDb,
};
