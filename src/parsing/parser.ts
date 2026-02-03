import { treeSitterParser, ExtractedFeatures } from "./treeSitter.js";
import { CallGraphBuilder, CallGraphNode } from "./callGraph.js";
import { CodeChunker, CodeChunk } from "./codeChunker.js";

export class RepositoryParser {
    private treeSitter = treeSitterParser;
    private graphBuilder = new CallGraphBuilder();
    private chunker = new CodeChunker();

    /**
     * Full parsing pipeline:
     * 1. Parse all files with TreeSitter → ExtractedFeatures[]
     * 2. Build call graph → Map<string, CallGraphNode>
     * 3. Generate context-enriched chunks → CodeChunk[]
     */

    public async parse(repoPath: string): Promise<CodeChunk[]> {
        console.log(`Starting repository parsing: ${repoPath}`);

        const features = await this.treeSitter.parseRepository(repoPath);
        console.log(`Extracted features from ${features.length} files`);

        const callGraph = this.graphBuilder.build(features);
        console.log(`📊 Built call graph with ${callGraph.size} nodes`);

        const chunks = this.chunker.chunk(features, callGraph);
        console.log(`Pipeline complete: ${chunks.length} chunks ready for embedding`);

        return chunks;
    }

    public async extractFeatures(repoPath: string): Promise<ExtractedFeatures[]> {
        return this.treeSitter.parseRepository(repoPath);
    }

    public buildCallGraph(features: ExtractedFeatures[]): Map<string, CallGraphNode> {
        return this.graphBuilder.build(features);
    }
}

// Export singleton
export const repositoryParser = new RepositoryParser();

