// Persistence layer backed by MongoDB.
//
// Same three-function contract as notesRepository.js: findAll, findById,
// create, all async, same note shape ({ id, title, body }).
//
// Connection uses mongodb://mongo:27017 as specified.

const { MongoClient } = require("mongodb");

const CONNECTION_STRING = process.env.MONGO_URL || "mongodb://mongo:27017";
const DB_NAME = process.env.MONGO_DB || "notes_db";
const COLLECTION_NAME = process.env.MONGO_COLLECTION || "notes";

let client;
let collection;

async function connect() {
  if (client) return;

  client = new MongoClient(CONNECTION_STRING, {
    connectTimeoutMS: 5000,
    serverSelectionTimeoutMS: 5000,
  });

  await client.connect();
  const db = client.db(DB_NAME);
  collection = db.collection(COLLECTION_NAME);

  await collection.createIndex({ id: 1 }, { unique: true });

  const count = await collection.countDocuments();
  if (count === 0) {
    await collection.insertMany([
      { id: 1, title: "Welcome", body: "This note is read from MongoDB, not hardcoded." },
      { id: 2, title: "Second note", body: "Stores notes in a MongoDB database running in its own container." },
    ]);
  }
}

async function findAll() {
  await connect();
  return collection.find({}).sort({ id: 1 }).toArray();
}

async function findById(id) {
  await connect();
  return collection.findOne({ id: Number(id) }) ?? null;
}

async function create(title, body) {
  await connect();
  const docs = await collection.find({}).sort({ id: -1 }).limit(1).toArray();
  const nextId = docs.length > 0 ? docs[0].id + 1 : 1;
  const note = { id: nextId, title, body };
  await collection.insertOne(note);
  return note;
}

module.exports = { findAll, findById, create };
