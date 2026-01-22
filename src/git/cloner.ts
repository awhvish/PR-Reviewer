import SimpleGit from "simple-git";
import path from 'path';
import fs from 'fs';
import { cache } from './cache';

export class RepoCloner {
    baseDir = "tmp/repositories/";
    

    async cloneRepository(owner:string, repoName: string, token: string) {
        
        const repoPath = path.join(this.baseDir, owner, repoName);

        try {
            await cache.cleanupCache(); // Fixed: Added missing await
            
            if (await this.exists(repoPath)) {
                console.log(`Repo ${repoName} exists, pulling updates...`)
                const git = SimpleGit(repoPath);
                await git.pull();
                return;
            }
            console.log(`Cloning  ${owner}/${repoName}...`);
            const git = SimpleGit();
            const repoUrl = `https://x-access-token:${token}@github.com/${owner}/${repoName}.git`;
            await git.clone(repoUrl, repoPath);

            return repoPath;

        }  catch (error) {
            console.log(`ERROR: Failed to clone ${owner}/${repoName}: `, error)
            throw error;
        }
    }
    

    private async exists(path: string): Promise<boolean> {
        try {
            await fs.promises.access(path, fs.constants.F_OK);
            return true;
        } catch(error) {
            return false;
        }
    }
}

export const repoCloner = new RepoCloner();