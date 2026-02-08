/**
 * Health Check Functions
 */

import { loggers } from '../utils/logger.js';
import { ChromaClient } from 'chromadb';

const log = loggers.health;

export interface HealthCheckResult {
    status: 'healthy' | 'degraded' | 'unhealthy';
    llmProvider: 'gemini' | 'openai' | 'none';
    checks: {
        chroma: boolean;
        openai: boolean;
        gemini: boolean;
        github: boolean;
    };
    details: {
        chroma?: string;
        openai?: string;
        gemini?: string;
        github?: string;
    };
    timestamp: string;
    uptime: number;
}

const startTime = Date.now();

/**
 * Check ChromaDB health
 */
export async function checkChromaHealth(): Promise<{ healthy: boolean; message: string }> {
    try {
        const client = new ChromaClient();
        
        // Try to heartbeat the server
        const heartbeat = await client.heartbeat();
        
        if (heartbeat) {
            return { healthy: true, message: 'ChromaDB is responding' };
        }
        
        return { healthy: false, message: 'ChromaDB heartbeat failed' };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        log.warn({ error: message }, 'ChromaDB health check failed');
        return { healthy: false, message: `ChromaDB unavailable: ${message}` };
    }
}

/**
 * Check OpenAI API health (lightweight check)
 */
export async function checkOpenAIHealth(): Promise<{ healthy: boolean; message: string }> {
    try {
        const apiKey = process.env.OPENAI_API_KEY;
        
        if (!apiKey) {
            return { healthy: false, message: 'OPENAI_API_KEY not configured' };
        }

        // Just check if key format is valid (don't make API call to save costs)
        if (apiKey.startsWith('sk-') && apiKey.length > 20) {
            return { healthy: true, message: 'OpenAI API key configured' };
        }

        return { healthy: false, message: 'Invalid OpenAI API key format' };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return { healthy: false, message: `OpenAI check failed: ${message}` };
    }
}

/**
 * Check Gemini API health (lightweight check)
 */
export async function checkGeminiHealth(): Promise<{ healthy: boolean; message: string }> {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        
        if (!apiKey) {
            return { healthy: false, message: 'GEMINI_API_KEY not configured' };
        }

        // Just check if key exists and has reasonable length
        if (apiKey.length > 20) {
            return { healthy: true, message: 'Gemini API key configured (ACTIVE)' };
        }

        return { healthy: false, message: 'Invalid Gemini API key format' };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return { healthy: false, message: `Gemini check failed: ${message}` };
    }
}

/**
 * Check GitHub App configuration
 */
export async function checkGitHubHealth(): Promise<{ healthy: boolean; message: string }> {
    try {
        const appId = process.env.APP_ID;
        const privateKey = process.env.PRIVATE_KEY;

        if (!appId) {
            return { healthy: false, message: 'APP_ID not configured' };
        }

        if (!privateKey) {
            return { healthy: false, message: 'PRIVATE_KEY not configured' };
        }

        return { healthy: true, message: 'GitHub App configured' };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return { healthy: false, message: `GitHub check failed: ${message}` };
    }
}

/**
 * Run all health checks
 */
export async function runHealthChecks(): Promise<HealthCheckResult> {
    const [chromaResult, openaiResult, geminiResult, githubResult] = await Promise.all([
        checkChromaHealth(),
        checkOpenAIHealth(),
        checkGeminiHealth(),
        checkGitHubHealth(),
    ]);

    const checks = {
        chroma: chromaResult.healthy,
        openai: openaiResult.healthy,
        gemini: geminiResult.healthy,
        github: githubResult.healthy,
    };

    const details = {
        chroma: chromaResult.message,
        openai: openaiResult.message,
        gemini: geminiResult.message,
        github: githubResult.message,
    };

    // Determine which LLM provider is active (Gemini takes priority)
    let llmProvider: 'gemini' | 'openai' | 'none' = 'none';
    if (geminiResult.healthy) {
        llmProvider = 'gemini';
    } else if (openaiResult.healthy) {
        llmProvider = 'openai';
    }

    // Determine overall status (need at least one LLM + GitHub)
    const hasLLM = checks.gemini || checks.openai;
    const coreHealthy = hasLLM && checks.github;
    const allHealthy = coreHealthy && checks.chroma;
    
    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (allHealthy) {
        status = 'healthy';
    } else if (coreHealthy) {
        status = 'degraded'; // ChromaDB down but can still work
    } else {
        status = 'unhealthy';
    }

    const result: HealthCheckResult = {
        status,
        llmProvider,
        checks,
        details,
        timestamp: new Date().toISOString(),
        uptime: Date.now() - startTime,
    };

    log.info({
        status,
        llmProvider,
        checks,
    }, 'Health check completed');

    return result;
}
