export interface ImportInfo {
    module: string;
    symbols: string[];
    isDefault: boolean;
}

export interface FunctionInfo {
    name: string;
    filePath: string;
    startLine: number;
    endLine: number;
    code: string;
    calls: string[];
}

export interface ExtractedFeatures {
    filePath: string;
    language: string;
    functions: FunctionInfo[];
    imports: ImportInfo[];
}

export interface CallGraphNode {
    id: string;
    calls: string[];
    calledBy: string[];
}

export interface CodeChunk {
    id: string;
    text: string;
    context: string;
    filePath: string;
    startLine: number;
    endLine: number;
    metadata: {
        functionName: string;
        callCount: number;
        incomingCount: number;
    };
}
