import crypto from "crypto";
import { ExtractedFeatures, CallGraphNode, CodeChunk } from "./types.js";

export type { CodeChunk };

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

                const uniqueKey = `${file.filePath}::${func.name}::${func.startLine}::${func.endLine}`;
                chunks.push({
                    id: crypto.createHash('md5').update(uniqueKey).digest('hex'),
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