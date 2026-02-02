export interface ParsedDiff {
    content: string;
    files: DiffFile[];
    additions: number;
    deletions: number;
}

export interface DiffFile {
    filename: string;
    status: 'added' | 'removed' | 'modified';
    additions: number;
    deletions: number;
    patch?: string;
}

export interface ReviewComment {
    message: string;
    confidence: number;
    severity: 'critical' | 'warning' | 'suggestion';
    line?: number;
    filename?: string;
}

export interface GeneratedReview {
    summary: string;
    comments: ReviewComment[];
    overallRating: 'approve' | 'request_changes' | 'comment';
}
