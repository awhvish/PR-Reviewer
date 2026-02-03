/**
 * Health Check Functions
 */

import { loggers } from '../utils/logger.js';
import { ChromaClient } from 'chromadb';

const log = loggers.health;

export interface HealthCheckResult {
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: {
        chroma: boolean;
        openai: boolean;
        github: boolean;
    };
    details: {
        chroma?: string;
        openai?: string;
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
    const [chromaResult, openaiResult, githubResult] = await Promise.all([
        checkChromaHealth(),
        checkOpenAIHealth(),
        checkGitHubHealth(),
    ]);

    const checks = {
        chroma: chromaResult.healthy,
        openai: openaiResult.healthy,
        github: githubResult.healthy,
    };

    const details = {
        chroma: chromaResult.message,
        openai: openaiResult.message,
        github: githubResult.message,
    };

    // Determine overall status
    const allHealthy = Object.values(checks).every(Boolean);
    const allUnhealthy = Object.values(checks).every(v => !v);
    
    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (allHealthy) {
        status = 'healthy';
    } else if (allUnhealthy) {
        status = 'unhealthy';
    } else {
        status = 'degraded';
    }

    const result: HealthCheckResult = {
        status,
        checks,
        details,
        timestamp: new Date().toISOString(),
        uptime: Date.now() - startTime,
    };

    log.info({
        status,
        checks,
    }, 'Health check completed');

    return result;
}
