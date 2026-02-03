/**
 * Hybrid Retrieval: Combines Vector (semantic) + BM25 (keyword) search
 * Returns formatted context ready for LLM consumption
 */

import { queryRelevantCode } from "./vectorStore.js";
import { bm25Search } from "./bm25.js";
import { RetrievedChunk } from "./types.js";
import { loggers } from "../utils/logger.js";

const log = loggers.rag;

export type { RetrievedChunk };

/**
 * Performs hybrid search and returns formatted RAG context string
 * Ready to be passed directly to generateReview()
 * Falls back to keyword-only if ChromaDB is unavailable
 */
export async function getHybridRagContext(
    query: string,
    vectorK: number = 10,
    keywordK: number = 10
): Promise<string> {
    let vectorResults = { documents: [] as string[], metadatas: [] as any[] };
    let keywordResults: Array<{ id: string; text: string; filePath: string; functionName?: string; startLine?: number; endLine?: number; score: number }> = [];
    let vectorAvailable = true;

    // Try vector search with fallback
    try {
        vectorResults = await queryRelevantCode(query, vectorK);
    } catch (error) {
        vectorAvailable = false;
        log.warn({ error: (error as Error).message }, 'ChromaDB unavailable, falling back to keyword-only search');
    }

    // Keyword search (always works if index exists)
    try {
        keywordResults = bm25Search(query, vectorAvailable ? keywordK : keywordK * 2);
    } catch (error) {
        log.warn({ error: (error as Error).message }, 'Keyword search failed');
    }

    // Merge and deduplicate results
    const mergedChunks = mergeResults(vectorResults, keywordResults);

    // Format as context string for LLM
    const ragContext = mergedChunks
        .map(chunk => {
            const header = [
                `File: ${chunk.filePath}`,
                chunk.functionName ? `Function: ${chunk.functionName}` : null,
                chunk.startLine ? `Lines: ${chunk.startLine}-${chunk.endLine}` : null,
                `Source: ${chunk.source}`
            ].filter(Boolean).join(' | ');

            return `${header}\n${'─'.repeat(40)}\n${chunk.text}`;
        })
        .join('\n\n---\n\n');

    log.info({
        uniqueChunks: mergedChunks.length,
        vectorResults: vectorResults.documents.length,
        keywordResults: keywordResults.length,
        vectorAvailable,
    }, 'Hybrid retrieval completed');

    return ragContext;
}

/**
 * Merge vector and keyword results with deduplication
 * Uses Reciprocal Rank Fusion (RRF) for scoring
 */
function mergeResults(
    vectorResults: { documents: string[]; metadatas: any[] },
    keywordResults: Array<{ id: string; text: string; filePath: string; functionName?: string; startLine?: number; endLine?: number; score: number }>
): RetrievedChunk[] {
    const chunkMap = new Map<string, RetrievedChunk>();
    const k = 60; // RRF constant

    // Add vector results
    vectorResults.documents.forEach((doc, index) => {
        const meta = vectorResults.metadatas[index];
        const id = meta?.id || `vector-${index}`;
        const rrfScore = 1 / (k + index + 1);

        chunkMap.set(id, {
            id,
            text: doc,
            filePath: meta?.filePath || 'unknown',
            functionName: meta?.functionName,
            startLine: meta?.startLine,
            endLine: meta?.endLine,
            source: 'vector',
            score: rrfScore
        });
    });

    // Add/merge keyword results
    keywordResults.forEach((result, index) => {
        const rrfScore = 1 / (k + index + 1);
        
        if (chunkMap.has(result.id)) {
            // Found in both - boost score and mark as 'both'
            const existing = chunkMap.get(result.id)!;
            existing.score = (existing.score || 0) + rrfScore;
            existing.source = 'both';
        } else {
            // Keyword-only result - use data from bm25Search result
            chunkMap.set(result.id, {
                id: result.id,
                text: result.text || '',
                filePath: result.filePath,
                functionName: result.functionName,
                startLine: result.startLine,
                endLine: result.endLine,
                source: 'keyword',
                score: rrfScore
            });
        }
    });

    // Sort by RRF score (higher = more relevant) and filter empty texts
    return Array.from(chunkMap.values())
        .filter(chunk => chunk.text.length > 0)
        .sort((a, b) => (b.score || 0) - (a.score || 0));
}

/**
 * Get raw hybrid results (for debugging/inspection)
 */
export async function getHybridResults(
    query: string,
    vectorK: number = 10,
    keywordK: number = 10
): Promise<RetrievedChunk[]> {
    const [vectorResults, keywordResults] = await Promise.all([
        queryRelevantCode(query, vectorK),
        Promise.resolve(bm25Search(query, keywordK))
    ]);

    return mergeResults(vectorResults, keywordResults);
}
