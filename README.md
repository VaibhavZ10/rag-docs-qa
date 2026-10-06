# RAG Docs Q&A — Hybrid Retrieval Pipeline over Qdrant Documentation

A retrieval-augmented question-answering system that ingests Qdrant's own documentation, indexes it with a hybrid (vector + keyword) search pipeline, and answers natural-language questions grounded in that documentation — with a measured retrieval accuracy, not just a demo that "looks like it works."

Built to understand how RAG systems actually behave under the hood — chunking tradeoffs, retrieval failure modes, and how to evaluate whether a retrieval pipeline is any good — rather than to wrap an existing library.

---

## Why this project exists

Most RAG side-projects stop at "it returns an answer that sounds plausible." That's not evidence the retrieval step is working — an LLM can produce a confident, fluent answer even when the retrieved context is wrong or irrelevant. This project treats retrieval as the thing being tested, not the LLM's fluency. The core deliverable isn't the chat answer — it's the **precision@5 score** in [`eval/results.json`](./eval/results.json), a number that says, concretely, how often the system retrieves the right source document for a given question.

---

## Architecture

```
                ┌─────────────────┐
   docs/*.md ──▶│   Ingestion      │──▶ chunks ──▶ embeddings ──▶ Qdrant
                │  (ingest.ts)     │                              (vector store)
                └─────────────────┘

   User question
        │
        ▼
   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
   │  Embed query │────▶│ Hybrid search │────▶│  LLM (Groq)  │──▶ Answer + sources
   │  (embed.ts)  │     │ (search.ts)   │     │  (server.ts) │
   └──────────────┘     └──────────────┘     └──────────────┘
```

**Flow:**
1. Markdown docs are chunked (word-based sliding window, overlap to preserve context across boundaries) and embedded locally.
2. Embeddings are stored in Qdrant with metadata (source file, chunk index).
3. An incoming question is embedded the same way, then matched against stored vectors (cosine similarity) and re-ranked with a keyword-overlap boost — a hybrid approach that catches exact-match terms (API names, config keys) that pure semantic similarity sometimes misses.
4. The top-5 chunks are passed as context to an LLM, which answers *only* from that context and says so when the context doesn't contain the answer.
5. The response includes both the answer and the source chunks it was grounded in, for traceability.

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Runtime | Node.js + TypeScript | Matches the rest of my backend stack — no context-switching to Python for a retrieval system |
| Embeddings | `@xenova/transformers` (`all-MiniLM-L6-v2`), local | Zero API cost, zero rate limits, runs entirely in-process |
| Vector store | Qdrant (Cloud free tier) | Native hybrid-friendly filtering, generous free tier, first-class Node client |
| LLM | Groq (Llama 3.3 70B) | Free tier, fast inference, no card required |
| API | Express | Simple, well-understood, sufficient for a single-endpoint service |
| Hosting | Render (free tier) | No-card free tier, acceptable cold-start tradeoff for a portfolio project |

**Total infra cost: $0/month.**

---

## Design decisions & known limitations

**Chunking — fixed-size (500 words, 50-word overlap), not semantic or AST-aware.**
This is a deliberate scope cut, not an oversight. Semantic/structure-aware chunking (splitting on markdown headers, code blocks, or sentence boundaries) produces better retrieval quality but adds real complexity. Fixed-size chunking's known failure mode: it can split a concept mid-explanation, hurting retrieval on questions that span a chunk boundary. If I extended this project, this is the first thing I'd fix.

**Hybrid search — weighted merge, not true BM25.**
Combines vector similarity (weight 0.85) with a keyword-overlap ratio (weight 0.15) rather than a proper BM25 implementation. This still meaningfully improves exact-match queries (error codes, function names) over pure vector search, but a production system would use a real sparse-vector/BM25 index (Qdrant supports this natively) rather than a hand-rolled boost.

**Retrieval evaluation — small, hand-written eval set.**
30 question/expected-source pairs, manually written against the ingested docs. This is enough to catch gross retrieval failures and produce a directionally meaningful number, but it's not statistically robust — a production eval set would be 10x+ larger and ideally include multiple valid source files per question.

**No confidence threshold / fallback behavior.**
If retrieval returns weak matches, the system still passes them to the LLM rather than declining to answer. The system prompt asks the LLM to say when context is insufficient, but there's no hard retrieval-score cutoff enforcing that.

---

## Retrieval evaluation methodology

`eval/qa-pairs.json` contains 30 hand-written questions against the ingested Qdrant docs, each paired with the source file that should answer it. `eval/eval.ts` runs each question through the live search pipeline and checks whether the expected source file appears in the top-5 results.

**Result: `<precision@5 score>`** — *(fill in after running `npx tsx src/eval.ts`)*

Full per-question breakdown is written to `eval/results.json`.

---

## Setup

```bash
git clone https://github.com/<your-username>/rag-docs-qa.git
cd rag-docs-qa
npm install
```

Create `.env`:
```
QDRANT_URL=https://xxxxx.cloud.qdrant.io   # or http://localhost:6333 for local dev
QDRANT_API_KEY=your-qdrant-key              # leave blank for local dev
GROQ_API_KEY=your-groq-key
PORT=3000
```

Ingest the docs (populates Qdrant):
```bash
npx tsx src/ingest.ts
```

Start the API:
```bash
npx tsx src/server.ts
```

Query it:
```bash
curl -X POST http://localhost:3000/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "How does Qdrant handle quantization?"}'
```

Run the evaluation:
```bash
npx tsx src/eval.ts
```

---

## Project structure

```
rag-docs-qa/
├── src/
│   ├── qdrant.ts     # Qdrant client + collection config
│   ├── embed.ts       # local embedding pipeline
│   ├── ingest.ts       # chunk + embed + load docs into Qdrant
│   ├── search.ts       # hybrid retrieval logic
│   ├── server.ts        # Express API (/ask endpoint)
│   └── eval.ts           # retrieval evaluation harness
├── data/docs/              # ingested markdown source files
├── eval/
│   ├── qa-pairs.json         # hand-written eval questions
│   └── results.json           # generated eval output
└── README.md
```

---

## What I'd build next with more time

- Structure-aware chunking (split on markdown headers/code fences instead of raw word count)
- Real BM25 sparse-vector index instead of a hand-rolled keyword boost
- Retrieval confidence threshold with an explicit "insufficient context" fallback
- A larger, more adversarial eval set (ambiguous questions, multi-document answers)
- Reranking model as a second-stage filter on top of hybrid search

---

## License / attribution

Source documentation content is copied from [Qdrant's documentation](https://github.com/qdrant/landing_page) for indexing purposes only — check their repository's license before redistributing the raw markdown content itself.