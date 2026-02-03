import MiniSearch from 'minisearch';
import { IndexedChunk } from './types.js';

export type { IndexedChunk };

let searchIndex: MiniSearch<IndexedChunk> | null = null;
let documentStore: Map<string, IndexedChunk> = new Map();

export function buildKeywordIndex(chunks: Array<IndexedChunk>) {
  documentStore.clear();
  chunks.forEach(chunk => documentStore.set(chunk.id, chunk));

  searchIndex = new MiniSearch<IndexedChunk>({
    fields: ['text', 'filePath', 'functionName'],
    storeFields: ['id', 'filePath', 'functionName', 'startLine', 'endLine'],
    idField: 'id',
  });
  searchIndex.addAll(chunks);
  console.log(`📚 Built keyword index with ${chunks.length} documents`);
}

export function bm25Search(query: string, k = 10): Array<IndexedChunk & { score: number }> {
  if (!searchIndex) return [];
  
  const results = searchIndex.search(query, { 
    prefix: true,
    fuzzy: 0.2,
    boost: { functionName: 2, filePath: 1.5 }
  });
  
  return results.slice(0, k).map(result => ({
    ...documentStore.get(result.id)!,
    score: result.score
  })).filter(r => r.id); // Filter out any undefined
}

export function getDocumentById(id: string): IndexedChunk | undefined {
  return documentStore.get(id);
}