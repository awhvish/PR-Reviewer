export interface IndexedChunk {
    id: string;
    text: string;
    filePath: string;
    functionName?: string;
    startLine?: number;
    endLine?: number;
}

export interface RetrievedChunk extends IndexedChunk {
    source: 'vector' | 'keyword' | 'both';
    score?: number;
}

export interface VectorQueryResult {
    documents: string[];
    metadatas: Record<string, any>[];
}
