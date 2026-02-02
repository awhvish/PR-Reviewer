import { ChromaClient, ChromaError } from "chromadb";
import { CodeChunk } from "../parsing/types";


const client = new ChromaClient();

const initializeChroma = async (): Promise<any> => {
    try {
        const collections = await client.getOrCreateCollection({
            name: "pr-reviews"
        });
        return collections;
    }
    catch (error) {
        if (error instanceof ChromaError) {
            console.error("Chroma-specific error during initialization:", error.message);
        } else {
            console.error("General error during Chroma initialization:", (error as Error).message);
        }
    }
}


const storeDocuments = async (documents: Array<CodeChunk>): Promise<void> => {
    try {
        const collection = await client.getOrCreateCollection({ name: "pr-reviews" });

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

        await collection.add({
            documents: texts,
            metadatas: metadatas,
            ids: ids
        });

        console.log(`Successfully stored ${documents.length} documents in ChromaDB.`);
    } catch (error) {
        if (error instanceof ChromaError) {
            console.error("Chroma-specific error during document storage:", error.message);
        } else {
            console.error("General error during document storage:", (error as Error).message);
        }
    }
}

// Add to /home/awhvish/Desktop/PR-Reviewer/src/rag/vectorStore.ts

const queryRelevantCode = async (queryText: string, nResults: number = 10): Promise<{
    documents: string[];
    metadatas: any[];
}> => {
    try {
        const collection = await client.getOrCreateCollection({ name: "pr-reviews" });
        
        const results = await collection.query({
            queryTexts: [queryText],
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
        console.error("Error querying ChromaDB:", (error as Error).message);
        return { documents: [], metadatas: [] };
    }
};

export { storeDocuments, queryRelevantCode };

