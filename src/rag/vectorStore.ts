import { ChromaClient, ChromaError } from "chromadb";
import { OpenAI } from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { CodeChunk } from "../parsing/types.js";
import { loggers } from "../utils/logger.js";

const log = loggers.rag;

const chromaUrl = process.env.CHROMADB_URL || "http://localhost:8000";
const client = new ChromaClient({ path: chromaUrl });

// Determine which provider to use
const useGemini = !!process.env.GEMINI_API_KEY;
const providerName = useGemini ? "Gemini" : "OpenAI";

// OpenAI client (fallback)
const openai = process.env.OPENAI_API_KEY 
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null;

// Gemini client (preferred)
const gemini = process.env.GEMINI_API_KEY 
    ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    : null;

const generateEmbedding = async (text: string): Promise<number[]> => {
    if (useGemini && gemini) {
        const model = gemini.getGenerativeModel({ model: "embedding-001" });
        const result = await model.embedContent(text);
        return result.embedding.values;
    } else if (openai) {
        const response = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: text,
        });
        return response.data[0].embedding;
    } else {
        throw new Error("No embedding provider configured. Set GEMINI_API_KEY or OPENAI_API_KEY");
    }
};

let isConnected = false;

/**
 * Initialize and verify the vector store connection
 */
const initVectorStore = async (): Promise<void> => {
    try {
        log.info({ url: chromaUrl, embeddingProvider: providerName }, "Connecting to ChromaDB...");
        
        // Test connection with heartbeat
        const heartbeat = await client.heartbeat();
        
        if (heartbeat) {
            isConnected = true;
            log.info({ heartbeat }, "ChromaDB connection established");
            
            // Ensure our collection exists
            await client.getOrCreateCollection({ 
                name: "pr-reviews"
            });
            log.info("Collection 'pr-reviews' ready");
        } else {
            throw new Error("ChromaDB heartbeat failed");
        }
    } catch (error) {
        isConnected = false;
        const message = error instanceof Error ? error.message : "Unknown error";
        log.error({ error: message, url: chromaUrl }, "Failed to connect to ChromaDB");
        throw error;
    }
};

/**
 * Check if vector store is connected
 */
const isVectorStoreConnected = (): boolean => isConnected;

const storeDocuments = async (documents: Array<CodeChunk>): Promise<void> => {
    try {
        const collection = await client.getOrCreateCollection({ 
            name: "pr-reviews"
        });

        const texts = documents.map(doc => doc.text);
        const metadatas = documents.map(doc => ({
            id: doc.id,
            filePath: doc.filePath,
            startLine: doc.startLine,
            endLine: doc.endLine,
            context: doc.context,
            functionName: doc.metadata.functionName,
            callCount: doc.metadata.callCount,
            incomingCount: doc.metadata.incomingCount
        }));
        const ids = documents.map(doc => doc.id);
        
        // Generate embeddings for all documents
        log.info({ count: texts.length }, "Generating embeddings...");
        const embeddings = await Promise.all(texts.map(text => generateEmbedding(text)));

        await collection.add({
            documents: texts,
            metadatas: metadatas,
            ids: ids,
            embeddings: embeddings
        });

        log.info({ count: documents.length }, "Successfully stored documents in ChromaDB");
    } catch (error) {
        if (error instanceof ChromaError) {
            log.error({ error: error.message }, "Chroma-specific error during document storage");
        } else {
            log.error({ error: (error as Error).message }, "General error during document storage");
        }
        throw error;
    }
}

const queryRelevantCode = async (queryText: string, nResults: number = 10): Promise<{
    documents: string[];
    metadatas: any[];
}> => {
    try {
        const collection = await client.getOrCreateCollection({ 
            name: "pr-reviews"
        });
        
        // Generate embedding for query
        const queryEmbedding = await generateEmbedding(queryText);
        
        const results = await collection.query({
            queryEmbeddings: [queryEmbedding],
            nResults,
        });
        if (!results || !results.documents) {
            return { documents: [], metadatas: [] };
        }
        return {
            documents: results.documents?.[0]?.filter((doc): doc is string => doc !== null) || [],
            metadatas: results.metadatas?.[0] || [],
        };
    } catch (error) {
        log.error({ error: (error as Error).message }, "Error querying ChromaDB");
        return { documents: [], metadatas: [] };
    }
};

export { storeDocuments, queryRelevantCode, initVectorStore, isVectorStoreConnected };
