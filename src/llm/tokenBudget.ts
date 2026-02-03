/**
 * Token Budget Management
 * Prevents runaway costs by truncating inputs to fit within limits
 */

import { loggers } from '../utils/logger.js';

const log = loggers.llm;

// Token limits for different contexts
export const TOKEN_LIMITS = {
    MAX_CONTEXT_TOKENS: 12000,   // Max tokens for RAG context
    MAX_DIFF_TOKENS: 4000,       // Max tokens for diff content
    MAX_TOTAL_INPUT: 16000,      // Max total input tokens
    MAX_OUTPUT_TOKENS: 2000,     // Max output tokens
} as const;

// Approximate chars per token (conservative estimate)
const CHARS_PER_TOKEN = 4;

/**
 * Estimate token count from text
 * Uses simple char-based estimation (production would use tiktoken)
 */
export function estimateTokens(text: string): number {
    return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Truncate text to fit within token budget
 */
export function truncateToTokenBudget(
    text: string,
    maxTokens: number,
    label: string = 'content'
): string {
    const estimatedTokens = estimateTokens(text);
    
    if (estimatedTokens <= maxTokens) {
        return text;
    }

    const maxChars = maxTokens * CHARS_PER_TOKEN;
    const truncated = text.slice(0, maxChars);
    
    // Find last complete line to avoid cutting mid-line
    const lastNewline = truncated.lastIndexOf('\n');
    const cleanTruncated = lastNewline > maxChars * 0.8 
        ? truncated.slice(0, lastNewline) 
        : truncated;

    log.warn({
        label,
        originalTokens: estimatedTokens,
        maxTokens,
        truncatedTo: estimateTokens(cleanTruncated),
    }, `Truncated ${label} to fit token budget`);

    return cleanTruncated + `\n\n... [${label} truncated: ${estimatedTokens - estimateTokens(cleanTruncated)} tokens removed]`;
}

/**
 * Budget allocation for review generation
 */
export function allocateBudget(diffTokens: number, ragTokens: number): {
    allocatedDiff: number;
    allocatedRag: number;
    totalInput: number;
} {
    const systemPromptTokens = 500; // Estimated system prompt size
    const available = TOKEN_LIMITS.MAX_TOTAL_INPUT - systemPromptTokens;
    
    // Priority: diff content > RAG context
    const allocatedDiff = Math.min(diffTokens, TOKEN_LIMITS.MAX_DIFF_TOKENS);
    const remainingForRag = available - allocatedDiff;
    const allocatedRag = Math.min(ragTokens, remainingForRag, TOKEN_LIMITS.MAX_CONTEXT_TOKENS);
    
    return {
        allocatedDiff,
        allocatedRag,
        totalInput: systemPromptTokens + allocatedDiff + allocatedRag,
    };
}

/**
 * Prepare inputs for LLM with proper truncation
 */
export function prepareInputsWithBudget(
    diffContent: string,
    ragContext: string
): { diff: string; rag: string; budget: ReturnType<typeof allocateBudget> } {
    const diffTokens = estimateTokens(diffContent);
    const ragTokens = estimateTokens(ragContext);
    
    const budget = allocateBudget(diffTokens, ragTokens);
    
    const truncatedDiff = truncateToTokenBudget(
        diffContent,
        budget.allocatedDiff,
        'diff'
    );
    
    const truncatedRag = truncateToTokenBudget(
        ragContext,
        budget.allocatedRag,
        'RAG context'
    );

    log.info({
        originalDiffTokens: diffTokens,
        originalRagTokens: ragTokens,
        allocatedDiff: budget.allocatedDiff,
        allocatedRag: budget.allocatedRag,
        totalInput: budget.totalInput,
    }, 'Token budget allocated');

    return {
        diff: truncatedDiff,
        rag: truncatedRag,
        budget,
    };
}
