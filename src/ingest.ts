import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { qdrant, COLLECTION, VECTOR_SIZE } from "./qdrant";
import { embedText } from "./embed";

const DOCS_DIR = path.join(__dirname, "../data/docs/cloud");
const CHUNK_SIZE = 500;   // words, not tokens
const OVERLAP = 50;

function chunkText(text: string): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += CHUNK_SIZE - OVERLAP) {
    chunks.push(words.slice(i, i + CHUNK_SIZE).join(" "));
    if (i + CHUNK_SIZE >= words.length) break;
  }
  return chunks;
}

function getAllMarkdownFiles(dir: string): string[] {
  let results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) results = results.concat(getAllMarkdownFiles(fullPath));
    else if (entry.name.endsWith(".md")) results.push(fullPath);
  }
  return results;
}

async function main() {
  await qdrant.recreateCollection(COLLECTION, {
    vectors: { size: VECTOR_SIZE, distance: "Cosine" },
  });

  const files = getAllMarkdownFiles(DOCS_DIR);
  console.log(`Found ${files.length} markdown files`);

  let pointId = 0;
  const points: any[] = [];

  for (const file of files) {
    const raw = fs.readFileSync(file, "utf-8");
    const { content } = matter(raw); // strips frontmatter
    const chunks = chunkText(content);

    for (const chunk of chunks) {
      if (chunk.trim().length < 20) continue; // skip near-empty chunks
      const vector = await embedText(chunk);
      points.push({
        id: pointId++,
        vector,
        payload: {
          text: chunk,
          source_file: path.relative(DOCS_DIR, file),
        },
      });
    }
       console.log(`Processed ${file} → ${chunks.length} chunks`);

    // Upsert in batches to avoid one giant/slow request
    if (points.length >= 50) {
      await qdrant.upsert(COLLECTION, { points });
      console.log(`Upserted ${points.length} points`);
      points.length = 0; // clear array, keep pointId counting up
    }
  }

  // Upsert whatever's left after the loop
  if (points.length > 0) {
    await qdrant.upsert(COLLECTION, { points });
    console.log(`Upserted final ${points.length} points`);
  }

  console.log(`Done. Total points ingested: ${pointId}`);
}

main().catch((err) => {
  console.error("Ingestion failed:", err);
  process.exit(1);
});