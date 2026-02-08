import Parser from "tree-sitter";
import fs from "fs";
import path from "path";
import { Query } from "tree-sitter";
import { ImportInfo, FunctionInfo, ExtractedFeatures } from "./types.js";

export type { ImportInfo, FunctionInfo, ExtractedFeatures };

export class TreeSitterParser {
     private GRAMMAR_MAP: Record<string, string> = {
          ".js": "tree-sitter-javascript",
          ".jsx": "tree-sitter-javascript",
          ".py": "tree-sitter-python",
          ".ts": "tree-sitter-typescript",
          ".tsx": "tree-sitter-typescript",
     };

     private loadedLanguages: Record<string, any> = {};

     private async getAllFiles(dirPath: string, arrayOfFiles: string[] = []): Promise<string[]> {
          const files = fs.readdirSync(dirPath);

          for (const file of files) {
               const fullPath = path.join(dirPath, file);
               if (fs.statSync(fullPath).isDirectory()) {
                    if (file !== "node_modules" && file !== ".git") {
                         await this.getAllFiles(fullPath, arrayOfFiles);
                    }
               } else {
                    arrayOfFiles.push(fullPath);
               }
          }
          return arrayOfFiles;
     }

     private async getLanguage(moduleName: string, ext: string) {
          const cacheKey = `${moduleName}-${ext}`;
          if (!this.loadedLanguages[cacheKey]) {
               const mod = await import(moduleName);
               
               // tree-sitter-typescript exports { typescript, tsx } directly
               if (moduleName === 'tree-sitter-typescript') {
                    if (ext === '.tsx') {
                         this.loadedLanguages[cacheKey] = mod.tsx;
                    } else {
                         this.loadedLanguages[cacheKey] = mod.typescript;
                    }
               } else {
                    // Other grammars export default
                    this.loadedLanguages[cacheKey] = mod.default || mod;
               }
          }
          return this.loadedLanguages[cacheKey];
     }

     parseRepository = async (repoPath: string): Promise<ExtractedFeatures[]> => {
          const treeSitterParser = new Parser();
          const files = await this.getAllFiles(repoPath);
          const allFeatures: ExtractedFeatures[] = [];

          for (const filePath of files) {
               const ext = path.extname(filePath);
               const grammarModule = this.GRAMMAR_MAP[ext];

               if (!grammarModule) continue;

               try {
                    const language = await this.getLanguage(grammarModule, ext);
                    treeSitterParser.setLanguage(language);

                    const sourceCode = fs.readFileSync(filePath, "utf8");
                    const tree = treeSitterParser.parse(sourceCode);

                    const features = this.extractFeatures(
                         tree.rootNode,
                         grammarModule,
                         language,
                         filePath
                    );
                    
                    allFeatures.push(features);
                    console.log(`✅ Parsed ${path.basename(filePath)}`);
               } catch (err: any) {
                    const errorMsg = err.message || String(err);
                    console.error(`Failed to parse ${path.relative(repoPath, filePath)}: ${errorMsg}`);
               }
          }

          return allFeatures;
     };

     private extractFeatures(rootNode: any, langModuleName: string, langGrammar: any, filePath: string): ExtractedFeatures {
          const queryMap: Record<string, string> = {
               "tree-sitter-javascript": `
                    (function_declaration name: (identifier) @def.name) @def.block
                    (method_definition name: (property_identifier) @def.name) @def.block
                    (arrow_function) @def.block
                    (variable_declarator name: (identifier) @def.name value: (function_expression)) @def.block
                    (variable_declarator name: (identifier) @def.name value: (arrow_function)) @def.block
                    
                    (call_expression function: (identifier) @call.name)
                    (call_expression function: (member_expression property: (property_identifier) @call.name))
                    
                    ;; Capture imports
                    (import_statement source: (string) @import.src) @import.block
               `,
               "tree-sitter-typescript": `
                    (function_declaration name: (identifier) @def.name) @def.block
                    (method_definition name: (property_identifier) @def.name) @def.block
                    
                    (call_expression function: (identifier) @call.name)
                    (call_expression function: (member_expression property: (property_identifier) @call.name))

                    ;; Capture imports
                    (import_statement source: (string) @import.src) @import.block
               `,
               "tree-sitter-python": `
                    (function_definition name: (identifier) @def.name) @def.block
                    (class_definition name: (identifier) @def.name) @def.block
                    
                    (call function: (identifier) @call.name)
                    (call function: (attribute attribute: (identifier) @call.name))

                    ;; Capture imports
                    (import_from_statement module_name: (dotted_name) @import.src) @import.block
                    (import_statement name: (dotted_name) @import.src) @import.block
               `,
          };

          const queryString = queryMap[langModuleName];
          if (!queryString) {
               return { filePath, language: "unknown", functions: [], imports: [] };
          }

          const query = new Query(langGrammar, queryString);
          const captures = query.captures(rootNode);

          const functions: FunctionInfo[] = [];
          const imports: ImportInfo[] = [];
          const functionCalls = new Map<string, string[]>();
          
          let currentScope: string | null = null;

          for (const cap of captures) {
               const text = cap.node.text;

               // --- Function Definitions ---
               if (cap.name === "def.name") {
                    currentScope = text; 
               } 
               else if (cap.name === "def.block" && currentScope) {
                    // We found the full code block for the name we just saw
                    functions.push({
                         name: currentScope,
                         filePath,
                         startLine: cap.node.startPosition.row + 1,
                         endLine: cap.node.endPosition.row + 1,
                         code: text,
                         calls: [] 
                    });
                    functionCalls.set(currentScope, []);
                    currentScope = null; // Reset
               }
               // --- Function Calls ---
               else if (cap.name === "call.name" && currentScope) {
                    // Only track calls if we are INSIDE a function
                    const calls = functionCalls.get(currentScope) || [];
                    calls.push(text);
                    functionCalls.set(currentScope, calls);
               }
               else if (cap.name === "import.src") {
                    const cleanPath = text.replace(/['"]/g, ""); 
                    
                    const parentText = cap.node.parent?.text || "";
                    const isDefault = !parentText.includes("{");
                    const symbols: string[] = [];

                    if (!isDefault) {
                         const match = parentText.match(/\{([^}]+)\}/);
                         if (match) {
                              match[1].split(',').forEach(s => symbols.push(s.trim()));
                         }
                    }

                    imports.push({
                         module: cleanPath,
                         symbols,
                         isDefault
                    });
               }
          }

          // Hydrate functions with their collected calls
          functions.forEach(f => {
               f.calls = [...new Set(functionCalls.get(f.name) || [])];
          });

          return {
               filePath,
               language: path.extname(filePath).substring(1),
               functions,
               imports 
          };
     }
}

export const treeSitterParser = new TreeSitterParser();