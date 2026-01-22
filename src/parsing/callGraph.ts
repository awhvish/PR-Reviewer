import path from "path";
import { ExtractedFeatures, FunctionInfo } from "./treeSitter";

export interface CallGraphNode {
    id: string; // ID for function
    calls: string[]; // List of IDs this function calls
    calledBy: string[]; // List of IDs that call this function
}

export class CallGraphBuilder {
    private nodes = new Map<string, CallGraphNode>();
    private fileIndex = new Map<string, ExtractedFeatures>(); 

    public build(features: ExtractedFeatures[]) {
        features.forEach(f => this.fileIndex.set(f.filePath, f));

        features.forEach(file => {
            file.functions.forEach(func => {
                const id = this.getId(file.filePath, func.name);
                this.nodes.set(id, { id, calls: [], calledBy: [] });
            });
        });

        features.forEach(file => {
            file.functions.forEach(func => {
                const callerId = this.getId(file.filePath, func.name);
                
                func.calls.forEach(callName => {
                    const targetId = this.resolveCall(callName, file);
                    if (targetId) {
                        this.link(callerId, targetId);
                    }
                });
            });
        });

        return this.nodes;
    }

private resolveCall(callName: string, currentFile: ExtractedFeatures): string | null {
        // 1. Local Definition (Highest Priority)
        // If the function is defined in the same file, link to it immediately.
        const isLocal = currentFile.functions.find(f => f.name === callName);
        if (isLocal) return this.getId(currentFile.filePath, callName);

        // 2. Import Resolution (The missing piece)
        // We look for an import that brings in 'callName'
        const matchedImport = currentFile.imports.find(imp => {
            // Case A: Named import (import { login } from './auth')
            if (imp.symbols.includes(callName)) return true;
            
            // Case B: Default import (import login from './auth')
            // Note: In the parser, we'd need to capture the local name. 
            // For now, we assume the module name matches the function if symbols are empty.
            if (imp.isDefault && path.basename(imp.module) === callName) return true;
            
            return false;
        });

        if (matchedImport) {
            // We found where it comes from (e.g., "./utils"), now find the actual file ID
            const resolvedPath = this.resolvePath(currentFile.filePath, matchedImport.module);
            
            if (resolvedPath) {
                // Look up the file in our index
                const targetFile = this.fileIndex.get(resolvedPath);
                if (targetFile) {
                    // Check if that file actually has the function
                    const targetFunc = targetFile.functions.find(f => f.name === callName);
                    if (targetFunc) return this.getId(targetFile.filePath, callName);
                }
            }
        }

        // 3. Global Fallback (Last Resort)
        // If imports fail (maybe it's a global like 'console.log' or we missed the import),
        // try to find *any* file that exports this function.
        for (const [path, feature] of this.fileIndex.entries()) {
            if (path === currentFile.filePath) continue;
            const match = feature.functions.find(f => f.name === callName);
            if (match) return this.getId(path, callName);
        }

        return null;
    }

    /**
     * Helper: Turns "./utils" inside "/src/auth.ts" into "/src/utils.ts"
     */
    private resolvePath(currentFilePath: string, importPath: string): string | null {
        // Ignore external libraries (react, lodash, etc.)
        if (!importPath.startsWith('.')) return null;

        const dir = path.dirname(currentFilePath);
        const absolutePath = path.resolve(dir, importPath);

        // We need to guess the extension (.ts, .js, .tsx) because imports don't have them
        const extensions = ['.ts', '.js', '.tsx', '.jsx', '.py'];
        
        // Check exact match first
        if (this.fileIndex.has(absolutePath)) return absolutePath;

        // Check extensions
        for (const ext of extensions) {
            const withExt = `${absolutePath}${ext}`;
            if (this.fileIndex.has(withExt)) return withExt;
        }

        // Check index files (folder/index.ts)
        for (const ext of extensions) {
            const indexFile = path.join(absolutePath, `index${ext}`);
            if (this.fileIndex.has(indexFile)) return indexFile;
        }

        return null;
    }

    private link(callerId: string, targetId: string) {
        const caller = this.nodes.get(callerId);
        const target = this.nodes.get(targetId);

        if (caller && target) {
            if (!caller.calls.includes(targetId)) caller.calls.push(targetId);
            if (!target.calledBy.includes(callerId)) target.calledBy.push(callerId);
        }
    }

    private getId(filePath: string, funcName: string) {
        return `${filePath}::${funcName}`;
    }
}