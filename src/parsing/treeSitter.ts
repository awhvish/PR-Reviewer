import Parser from "tree-sitter"; 
import fs from "fs";
import path from "path";

export class TreeSitterParser {
     private GRAMMAR_MAP: Record<string, string> = {
          ".js": "tree-sitter-javascript",
          ".go": "tree-sitter-go",
          ".py": "tree-sitter-python",
          ".ts": "tree-sitter-typescript",
          ".java": "tree-sitter-java",
          ".c": "tree-sitter-c",
          ".cpp": "tree-sitter-cpp",
     };

     // Cache the actual language objects, not just names
     private loadedLanguages: Record<string, any> = {};

     private async getAllFiles(dirPath: string, arrayOfFiles: string[] = []): Promise<string[]> {
          const files = fs.readdirSync(dirPath);

          for (const file of files) {
               const fullPath = path.join(dirPath, file);
               if (fs.statSync(fullPath).isDirectory()) {
                    await this.getAllFiles(fullPath, arrayOfFiles);
               } else {
                    arrayOfFiles.push(fullPath);
               }
          }
          return arrayOfFiles;
     }

     private async getLanguage(moduleName: string) {
          if (!this.loadedLanguages[moduleName]) {
               // Dynamically require the module and execute it
               const mod = await import(moduleName);
               this.loadedLanguages[moduleName] = mod.default || mod;
          }
          return this.loadedLanguages[moduleName];
     }

     parseRepository = async (repoPath: string): Promise<void> => {
          const treeSitterParser = new Parser();
          const files = await this.getAllFiles(repoPath);

          for (const filePath of files) {
               const ext = path.extname(filePath);
               const grammarModule = this.GRAMMAR_MAP[ext];

               if (!grammarModule) {
                    // Quietly skip unknown files (READMEs, images, etc)
                    continue;
               }

               try {
                    const language = await this.getLanguage(grammarModule);
                    treeSitterParser.setLanguage(language);

                    const sourceCode = fs.readFileSync(filePath, "utf8");
                    const tree = treeSitterParser.parse(sourceCode);

                    console.log(`✅ Parsed ${path.basename(filePath)} (${grammarModule})`);
                    
                    // Accessing the root node is the first step for Vector DBs
                    
               } catch (err) {
                    console.error(`❌ Error parsing ${filePath}:`, err);
               }
          }
     };
}

export const treeSitterParser = new TreeSitterParser();