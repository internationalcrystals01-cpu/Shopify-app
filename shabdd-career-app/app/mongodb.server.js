import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error("MONGODB_URI is not defined");
}

let client;

if (process.env.NODE_ENV === "development") {
  if (!global.mongoClient) {
    global.mongoClient = new MongoClient(uri);
  }

  client = global.mongoClient;
} else {
  client = new MongoClient(uri);
}

const db = client.db("career_app");

async function testMongoConnection() {
  try {
    await client.connect();
    await db.command({ ping: 1 });

    console.log("✅ MongoDB connected successfully!");
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error);
  }
}

export { client, db, testMongoConnection };

testMongoConnection();