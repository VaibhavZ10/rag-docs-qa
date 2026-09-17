type Document = {
	id: string;
	text: string;
	metadata?: Record<string, unknown>;
};

type Chunk = {
	id: string;
	documentId: string;
	text: string;
	embedding: number[];
	metadata?: Record<string, unknown>;
};

async function ingestDocuments(
	documents: Document[],
	options: { chunkSize?: number; chunkOverlap?: number } = {},
): Promise<Chunk[]> {
	void documents;
	void options;
	throw new Error("Not implemented: document ingestion scaffold");
}

async function loadChunks(): Promise<Chunk[]> {
	throw new Error("Not implemented: vector store loading scaffold");
}
