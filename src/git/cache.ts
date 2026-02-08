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
            
            // Clean up empty owner directories
            await this.cleanupEmptyOwnerDirs();
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
            // First level: owner directories
            const owners = await fs.readdir(this.baseDir);
            
            for (const owner of owners) {
                const ownerPath = path.join(this.baseDir, owner);
                try {
                    const ownerStats = await fs.stat(ownerPath);
                    if (!ownerStats.isDirectory()) continue;
                    
                    // Second level: repo directories under each owner
                    const repoNames = await fs.readdir(ownerPath);
                    for (const repoName of repoNames) {
                        const repoPath = path.join(ownerPath, repoName);
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
                } catch (error) {
                    console.warn(`Could not access ${ownerPath}:`, error);
                }
            }
            
            // Sort by access time (oldest first)
            return repos.sort((a, b) => a.accessTime.getTime() - b.accessTime.getTime());
        } catch (error) {
            console.error("Error getting repositories by access time:", error);
            return [];
        }
    }

    /**
     * Clean up empty owner directories after evicting repos
     */
    private async cleanupEmptyOwnerDirs(): Promise<void> {
        try {
            const owners = await fs.readdir(this.baseDir);
            for (const owner of owners) {
                const ownerPath = path.join(this.baseDir, owner);
                try {
                    const stats = await fs.stat(ownerPath);
                    if (stats.isDirectory()) {
                        const contents = await fs.readdir(ownerPath);
                        if (contents.length === 0) {
                            await fs.rmdir(ownerPath);
                            console.log(`Removed empty owner directory: ${owner}`);
                        }
                    }
                } catch (error) {
                    // Ignore errors during cleanup
                }
            }
        } catch (error) {
            // Ignore errors during cleanup
        }
    }
}

export const cache = new LRUCache();