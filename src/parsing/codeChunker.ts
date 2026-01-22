import { ExtractedFeatures } from "./treeSitter";
import { CallGraphNode } from "./callGraph";
import crypto from "crypto";

export interface CodeChunk {
    id: string;
    text: string;           // raw code
    context: string;        //Enriched context
    filePath: string;
    startLine: number;
    endLine: number;
    metadata: {
        functionName: string;
        callCount: number;  // How many other functions does this call?
        incomingCount: number; // How many functions call this?
    };
}

export class CodeChunker {
    
    public chunk(features: ExtractedFeatures[], graph: Map<string, CallGraphNode>): CodeChunk[] {
        const chunks: CodeChunk[] = [];

        features.forEach(file => {
            file.functions.forEach(func => {
                const nodeId = `${file.filePath}::${func.name}`;
                const graphNode = graph.get(nodeId);

                // Build "LLM-Ready" Context
                const contextParts = [
                    `File: ${file.filePath}`,
                    `Language: ${file.language}`,
                ];

                if (graphNode) {
                    if (graphNode.calledBy.length > 0) {
                        contextParts.push(`This function is called by: ${graphNode.calledBy.map(id => id.split('::')[1]).join(', ')}`);
                    }
                    if (graphNode.calls.length > 0) {
                        contextParts.push(`This function calls: ${graphNode.calls.map(id => id.split('::')[1]).join(', ')}`);
                    }
                }

                chunks.push({
                    id: crypto.createHash('md5').update(nodeId).digest('hex'),
                    text: func.code,
                    context: contextParts.join('\n'),
                    filePath: file.filePath,
                    startLine: func.startLine,
                    endLine: func.endLine,
                    metadata: {
                        functionName: func.name,
                        callCount: graphNode?.calls.length || 0,
                        incomingCount: graphNode?.calledBy.length || 0
                    }
                });
            });
        });

        console.log(`📦 Generated ${chunks.length} chunks.`);
        return chunks;
    }
}