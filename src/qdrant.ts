import { QdrantClient } from "@qdrant/js-client-rest";
import dotenv from "dotenv";
dotenv.config();

if (!process.env.QDRANT_URL || !process.env.QDRANT_API_KEY) {
  throw new Error("QDRANT_URL and QDRANT_API_KEY must be configured");
}

export const qdrant = new QdrantClient({
  url:  process.env.QDRANT_URL || 'undefined',
  apiKey: process.env.QDRANT_API_KEY || 'undefined',
});

export const COLLECTION = "docs";
export const VECTOR_SIZE = 384; // all-MiniLM-L6-v2 output size