import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI environment variable is not set");

let client;
let clientPromise;

if (process.env.NODE_ENV !== "production") {
  // In dev, reuse connection across hot reloads
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  client = new MongoClient(uri);
  clientPromise = client.connect();
}

export async function getDb() {
  const c  = await clientPromise;
  const db = c.db("cashcanvas");

  // Ensure TTL index on pending_signups so MongoDB auto-removes expired docs.
  // createIndex is a no-op if the index already exists.
  db.collection("pending_signups")
    .createIndex({ otpExpiry: 1 }, { expireAfterSeconds: 0 })
    .catch(() => {}); // non-blocking, non-fatal

  return db;
}
