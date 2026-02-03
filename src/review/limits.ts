/**
 * PR Size Limits and Validation
 */

import { loggers } from '../utils/logger.js';
import { ParsedDiff } from './types.js';

const log = loggers.review;

export interface PRLimits {
    maxFiles: number;
    maxAdditions: number;
    maxDeletions: number;
    maxTotalChanges: number;
}

export const DEFAULT_LIMITS: PRLimits = {
    maxFiles: 50,
    maxAdditions: 2000,
    maxDeletions: 1500,
    maxTotalChanges: 3000,
};

export interface LimitCheckResult {
    passed: boolean;
    reason?: string;
    details: {
        files: number;
        additions: number;
        deletions: number;
        totalChanges: number;
    };
    limits: PRLimits;
}

/**
 * Check if PR is within acceptable size limits
 */
export function checkPRLimits(
    diff: ParsedDiff,
    limits: PRLimits = DEFAULT_LIMITS
): LimitCheckResult {
    const details = {
        files: diff.files.length,
        additions: diff.additions,
        deletions: diff.deletions,
        totalChanges: diff.additions + diff.deletions,
    };

    const violations: string[] = [];

    if (details.files > limits.maxFiles) {
        violations.push(`Too many files: ${details.files}/${limits.maxFiles}`);
    }

    if (details.additions > limits.maxAdditions) {
        violations.push(`Too many additions: ${details.additions}/${limits.maxAdditions}`);
    }

    if (details.deletions > limits.maxDeletions) {
        violations.push(`Too many deletions: ${details.deletions}/${limits.maxDeletions}`);
    }

    if (details.totalChanges > limits.maxTotalChanges) {
        violations.push(`Too many total changes: ${details.totalChanges}/${limits.maxTotalChanges}`);
    }

    const passed = violations.length === 0;
    const reason = passed ? undefined : violations.join('; ');

    if (!passed) {
        log.warn({
            violations,
            details,
            limits,
        }, 'PR exceeds size limits');
    }

    return { passed, reason, details, limits };
}

/**
 * Generate a user-friendly message for oversized PRs
 */
export function getOversizedPRMessage(result: LimitCheckResult): string {
    const { details, limits } = result;

    return `## ⚠️ PR Too Large for Detailed Review

This pull request exceeds the recommended size limits for automated review:

| Metric | Current | Limit |
|--------|---------|-------|
| Files changed | ${details.files} | ${limits.maxFiles} |
| Additions | ${details.additions} | ${limits.maxAdditions} |
| Deletions | ${details.deletions} | ${limits.maxDeletions} |
| Total changes | ${details.totalChanges} | ${limits.maxTotalChanges} |

### Recommendations

1. **Break into smaller PRs** - Smaller PRs are easier to review and less likely to introduce bugs
2. **Separate refactoring** - If this includes refactoring, consider splitting it out
3. **Feature flags** - Use feature flags to merge incrementally

---
*This is an automated message. The review was skipped to prevent token limit issues.*`;
}

/**
 * Check if PR should be skipped entirely (extremely large)
 */
export function shouldSkipReview(diff: ParsedDiff): boolean {
    // Skip if extremely large (2x normal limits)
    const extremeLimits: PRLimits = {
        maxFiles: DEFAULT_LIMITS.maxFiles * 2,
        maxAdditions: DEFAULT_LIMITS.maxAdditions * 2,
        maxDeletions: DEFAULT_LIMITS.maxDeletions * 2,
        maxTotalChanges: DEFAULT_LIMITS.maxTotalChanges * 2,
    };

    const result = checkPRLimits(diff, extremeLimits);
    return !result.passed;
}
