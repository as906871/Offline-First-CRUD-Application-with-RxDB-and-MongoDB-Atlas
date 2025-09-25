import dotenv from "dotenv";

const result = dotenv.config();

import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";

const app = express();
app.use(cors());
app.use(express.json());

if (!process.env.MONGO_URI) {
  process.exit(1);
}

if (!process.env.DB_NAME) {
  process.exit(1);
}

const PORT = process.env.PORT || 3001;

const mongo = new MongoClient(process.env.MONGO_URI);
let db;

const sseConnections = new Map();

async function init() {
  try {
    console.log("🔄 Connecting to MongoDB...");
    await mongo.connect();
    db = mongo.db(process.env.DB_NAME);

    const collections = await db.listCollections().toArray();

    try {
      await db.collection("businesses").createIndex({ updatedAt: 1, id: 1 });
      await db.collection("articles").createIndex({ updatedAt: 1, id: 1 });
      await db.collection("articles").createIndex({ business_id: 1 });
      console.log("📊 Indexes created successfully");
    } catch (indexError) {
      console.log("ℹ️  Indexes may already exist:", indexError.message);
    }

    app.post("/:collection/push", async (req, res) => {
      try {
        const collectionName = req.params.collection;
        const rows = req.body;

        if (!rows || rows.length === 0) {
          return res.json([]);
        }

        const collection = db.collection(collectionName);
        const bulkOps = [];

        for (let row of rows) {
          try {
            const doc = row.newDocumentState || row;

            if (doc._deleted) {
              bulkOps.push({
                deleteOne: { filter: { id: doc.id } },
              });
              continue;
            }

            if (!doc.updatedAt) {
              doc.updatedAt = new Date().toISOString();
            }

            bulkOps.push({
              replaceOne: {
                filter: { id: doc.id },
                replacement: doc,
                upsert: true,
              },
            });
          } catch (docError) {
            console.error("❌ Error processing document:", docError);
            throw docError;
          }
        }

        if (bulkOps.length > 0) {
          const result = await collection.bulkWrite(bulkOps);
        }

        notifyClients(collectionName);

        res.json([]); 
      } catch (error) {
        console.error("❌ Push error:", error);
        res.status(500).json({ error: error.message });
      }
    });

    app.get("/:collection/pull", async (req, res) => {
      try {
        const collectionName = req.params.collection;
        const { updatedAt = "", id = "", batchSize = 50 } = req.query;

        const collection = db.collection(collectionName);

        const totalCount = await collection.countDocuments();

        let query = {};
        if (updatedAt) {
          query.updatedAt = { $gt: updatedAt };
        }

        const docs = await collection
          .find(query)
          .sort({ updatedAt: 1, id: 1 })
          .limit(Number(batchSize))
          .toArray();

        const cleanDocs = docs.map((doc) => {
          const { _id, ...cleanDoc } = doc;
          return cleanDoc;
        });

        const checkpoint =
          cleanDocs.length > 0
            ? {
                updatedAt: cleanDocs[cleanDocs.length - 1].updatedAt,
                id: cleanDocs[cleanDocs.length - 1].id,
              }
            : { updatedAt: updatedAt || "", id: id || "" };

        res.json({
          documents: cleanDocs,
          checkpoint: checkpoint,
        });
      } catch (error) {
        console.error("❌ Pull error:", error);
        res.status(500).json({ error: error.message });
      }
    });

    app.get("/:collection/pullStream", (req, res) => {
      const collectionName = req.params.collection;

      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Cache-Control",
      });

      res.write('data: {"type": "connected"}\n\n');

      if (!sseConnections.has(collectionName)) {
        sseConnections.set(collectionName, new Set());
      }
      sseConnections.get(collectionName).add(res);

      req.on("close", () => {
        if (sseConnections.has(collectionName)) {
          sseConnections.get(collectionName).delete(res);
        }
      });
    });

    app.get("/debug/collections", async (req, res) => {
      try {
        const collections = await db.listCollections().toArray();
        const result = {};

        for (const collection of collections) {
          const count = await db.collection(collection.name).countDocuments();
          const sampleDocs = await db
            .collection(collection.name)
            .find()
            .limit(3)
            .toArray();
          result[collection.name] = { count, sampleDocs };
        }

        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get("/health", async (req, res) => {
      try {
        await db.admin().ping();
        res.json({
          status: "ok",
          timestamp: new Date().toISOString(),
          database: process.env.DB_NAME,
          mongodb: "connected",
        });
      } catch (error) {
        res.status(500).json({
          status: "error",
          error: error.message,
        });
      }
    });

    app.listen(PORT, () => {
      console.log(`\n🚀 Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("❌ Server initialization error:", error);
    process.exit(1);
  }
}

function notifyClients(collectionName) {
  if (sseConnections.has(collectionName)) {
    const connections = sseConnections.get(collectionName);
    const message = JSON.stringify({
      type: "change",
      collection: collectionName,
      timestamp: new Date().toISOString(),
    });

    connections.forEach((res) => {
      try {
        res.write(`data: ${message}\n\n`);
      } catch (error) {
        connections.delete(res);
      }
    });
  }
}

process.on("SIGINT", async () => {
  console.log("\n🛑 Shutting down...");
  await mongo.close();
  process.exit(0);
});

init().catch(console.error);
