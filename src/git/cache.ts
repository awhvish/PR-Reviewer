import path from "path";
import fs from "fs/promises";

class LRUCache  {
    private baseDir = "tmp/repositories/";
    private maxCacheSize = 5;

    async cleanupCache(): Promise<void> {
        // Ensure base directory exists
        await fs.mkdir(this.baseDir, { recursive: true });
        
        const totalSize = await this.getCacheSize(this.baseDir);
        const limitInBytes = this.maxCacheSize * 1024 * 1024 * 1024; // Convert GB to bytes
        
        if (totalSize >= limitInBytes) {
            console.log(`Cache size (${(totalSize / 1024 / 1024 / 1024).toFixed(2)}GB) exceeded limit (${this.maxCacheSize}GB). Cleaning up...`);
            try {
                await this.evictOldRepos();
            } catch (error) {
                console.error("error in LRUCache cleanup:", error);
            }
        }
    }

    private async evictOldRepos(): Promise<void> {
        try {
            const repos = await this.getReposByAccessTime();
            const reposToDelete = Math.ceil(repos.length * 0.3); // Remove 30% of repos
            
            for (let i = 0; i < reposToDelete && i < repos.length; i++) {
                const repoPath = repos[i].path;
                console.log(`Evicting repository: ${path.basename(repoPath)}`);
                await fs.rm(repoPath, { recursive: true, force: true });
            }
            
            console.log(`Evicted ${reposToDelete} repositories from cache`);
        } catch (error) {
            console.error("Error evicting old repositories:", error);
            throw error;
        }
    }

    private async getCacheSize(dirPath: string): Promise<number> {
        let totalSize = 0;
        
        try {
            const files = await fs.readdir(dirPath);

            for (const file of files) {
                const fullPath = path.join(dirPath, file);
                try {
                    const stats = await fs.stat(fullPath);
                    if (stats.isDirectory()) {
                        totalSize += await this.getCacheSize(fullPath);
                    } else {
                        totalSize += stats.size;
                    }
                } catch (error) {
                    // Skip files that can't be accessed
                    console.warn(`Could not access ${fullPath}:`, error);
                }
            }
        } catch (error) {
            console.error(`Error reading directory ${dirPath}:`, error);
        }

        return totalSize;
    }

    private async getReposByAccessTime(): Promise<{ path: string; accessTime: Date }[]> {
        const repos: { path: string; accessTime: Date }[] = [];
        
        try {
            const entries = await fs.readdir(this.baseDir);
            
            for (const entry of entries) {
                const repoPath = path.join(this.baseDir, entry);
                try {
                    const stats = await fs.stat(repoPath);
                    if (stats.isDirectory()) {
                        repos.push({
                            path: repoPath,
                            accessTime: stats.atime
                        });
                    }
                } catch (error) {
                    console.warn(`Could not access ${repoPath}:`, error);
                }
            }
            
            // Sort by access time (oldest first)
            return repos.sort((a, b) => a.accessTime.getTime() - b.accessTime.getTime());
        } catch (error) {
            console.error("Error getting repositories by access time:", error);
            return [];
        }
    }
}

export const cache = new LRUCache();