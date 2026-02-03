import { Context } from "probot";
import { ParsedDiff, DiffFile } from "./types.js";

export type { ParsedDiff, DiffFile };

export class DiffParser {
  async parsePRDiff(
    context: Context<"pull_request.opened" | "pull_request.synchronize">,
    owner: string,
    repo: string,
    pullNumber: number
  ): Promise<ParsedDiff> {
    
    // Get the raw diff
    const { data: diffText } = await context.octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: pullNumber,
      headers: {
        accept: "application/vnd.github.v3.diff",
      },
    }) as unknown as { data: string };

    // Get file details
    const { data: files } = await context.octokit.rest.pulls.listFiles({
      owner,
      repo,
      pull_number: pullNumber,
    });

    const parsedFiles: DiffFile[] = files.map(file => ({
      filename: file.filename,
      status: file.status as 'added' | 'removed' | 'modified',
      additions: file.additions,
      deletions: file.deletions,
      patch: file.patch,
    }));

    const totalAdditions = parsedFiles.reduce((sum, file) => sum + file.additions, 0);
    const totalDeletions = parsedFiles.reduce((sum, file) => sum + file.deletions, 0);

    return {
      content: diffText,
      files: parsedFiles,
      additions: totalAdditions,
      deletions: totalDeletions,
    };
  }

  filterSignificantChanges(diff: ParsedDiff): ParsedDiff {
    // Filter out trivial changes (whitespace, comments, etc.)
    const significantFiles = diff.files.filter(file => {
      // Skip if only whitespace changes
      if (file.additions + file.deletions < 3) return false;
      
      // Skip certain file types
      const skipExtensions = ['.md', '.txt', '.json', '.yml', '.yaml'];
      const hasSkippedExt = skipExtensions.some(ext => file.filename.endsWith(ext));
      
      return !hasSkippedExt;
    });

    return {
      ...diff,
      files: significantFiles,
    };
  }
}

export const diffParser = new DiffParser();