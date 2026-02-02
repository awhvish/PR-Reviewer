import path from "path";
import { ExtractedFeatures, CallGraphNode } from "./types";

export type { CallGraphNode };

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
        //  Local Definition 
        // If the function is defined in the same file, link to it immediately.
        const isLocal = currentFile.functions.find(f => f.name === callName);
        if (isLocal) return this.getId(currentFile.filePath, callName);

        // We look for an import that brings in 'callName'
        const matchedImport = currentFile.imports.find(imp => {
            // Case A: Named import (import { login } from './auth')
            if (imp.symbols.includes(callName)) return true;
            
            // Case B: Default import (import login from './auth')
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

        // If imports fail (maybe it's a global like 'console.log' or we missed the import)
        // try to find *any* file that exports this function.
        for (const [path, feature] of this.fileIndex.entries()) {
            if (path === currentFile.filePath) continue;
            const match = feature.functions.find(f => f.name === callName);
            if (match) return this.getId(path, callName);
        }

        return null;
    }


    private resolvePath(currentFilePath: string, importPath: string): string | null {
        // Ignore external libraries (react, lodash, etc.)
        if (!importPath.startsWith('.')) return null;

        const dir = path.dirname(currentFilePath);
        const absolutePath = path.resolve(dir, importPath);

        const extensions = ['.ts', '.js', '.tsx', '.jsx', '.py'];
        
        if (this.fileIndex.has(absolutePath)) return absolutePath;

        for (const ext of extensions) {
            const withExt = `${absolutePath}${ext}`;
            if (this.fileIndex.has(withExt)) return withExt;
        }

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