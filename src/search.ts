import { qdrant, COLLECTION } from "./qdrant";
import { embedText } from "./embed";

interface SearchResult {
  text: string;
  source_file: string;
  score: number;
}

export async function searchDocs(query: string, topK = 5): Promise<SearchResult[]> {
  const vector = await embedText(query);

  // Vector search
  const vectorResults = await qdrant.query(COLLECTION, {
    query: vector,
    limit: topK * 2, // pull extra, we'll re-rank
    with_payload: true,
  });

  // Simple keyword boost: does the chunk text contain query words?
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);

  const rescored = vectorResults.points.map((r: any) => {
    const text = (r.payload?.text || "").toLowerCase();
    const keywordHits = queryWords.filter(w => text.includes(w)).length;
    const keywordBoost = keywordHits / Math.max(queryWords.length, 1);
    // Weighted merge: mostly vector score, small keyword boost
    const combinedScore = r.score * 0.85 + keywordBoost * 0.15;
    return {
      text: r.payload?.text,
      source_file: r.payload?.source_file,
      score: combinedScore,
    };
  });

  return rescored
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}