/**
 * Cost Tracking for OpenAI API Calls
 */

import { loggers } from '../utils/logger.js';

const log = loggers.llm;

// Pricing per 1K tokens (as of 2025 - update as needed)
const PRICING = {
    'gpt-4o': {
        input: 0.0025,
        output: 0.01,
    },
    'gpt-4o-mini': {
        input: 0.00015,
        output: 0.0006,
    },
    'gpt-4-turbo': {
        input: 0.01,
        output: 0.03,
    },
    'text-embedding-3-small': {
        input: 0.00002,
        output: 0,
    },
} as const;

type ModelName = keyof typeof PRICING;

interface CostEntry {
    timestamp: Date;
    model: string;
    promptTokens: number;
    completionTokens: number;
    cost: number;
    context?: string;
}

class CostTracker {
    private entries: CostEntry[] = [];
    private sessionStart: Date = new Date();

    /**
     * Record cost for an API call
     */
    record(
        model: string,
        promptTokens: number,
        completionTokens: number,
        context?: string
    ): number {
        const pricing = PRICING[model as ModelName] || PRICING['gpt-4o'];
        
        const cost = (
            (promptTokens * pricing.input) +
            (completionTokens * pricing.output)
        ) / 1000;

        const entry: CostEntry = {
            timestamp: new Date(),
            model,
            promptTokens,
            completionTokens,
            cost,
            context,
        };

        this.entries.push(entry);

        log.info({
            model,
            promptTokens,
            completionTokens,
            cost: `$${cost.toFixed(6)}`,
            totalSessionCost: `$${this.getSessionTotal().toFixed(4)}`,
            context,
        }, 'API call cost recorded');

        return cost;
    }

    /**
     * Get total cost for current session
     */
    getSessionTotal(): number {
        return this.entries.reduce((sum, entry) => sum + entry.cost, 0);
    }

    /**
     * Get cost summary
     */
    getSummary(): {
        sessionTotal: number;
        callCount: number;
        totalTokens: number;
        sessionDuration: number;
        averageCostPerCall: number;
    } {
        const totalTokens = this.entries.reduce(
            (sum, e) => sum + e.promptTokens + e.completionTokens,
            0
        );

        return {
            sessionTotal: this.getSessionTotal(),
            callCount: this.entries.length,
            totalTokens,
            sessionDuration: Date.now() - this.sessionStart.getTime(),
            averageCostPerCall: this.entries.length > 0 
                ? this.getSessionTotal() / this.entries.length 
                : 0,
        };
    }

    /**
     * Get entries from last N minutes
     */
    getRecentEntries(minutes: number = 60): CostEntry[] {
        const cutoff = Date.now() - (minutes * 60 * 1000);
        return this.entries.filter(e => e.timestamp.getTime() > cutoff);
    }

    /**
     * Get cost for last N minutes
     */
    getRecentCost(minutes: number = 60): number {
        return this.getRecentEntries(minutes)
            .reduce((sum, entry) => sum + entry.cost, 0);
    }

    /**
     * Check if we're over budget
     */
    isOverBudget(hourlyLimit: number = 1.0): boolean {
        const hourlySpend = this.getRecentCost(60);
        const isOver = hourlySpend >= hourlyLimit;
        
        if (isOver) {
            log.warn({
                hourlySpend: `$${hourlySpend.toFixed(4)}`,
                hourlyLimit: `$${hourlyLimit.toFixed(2)}`,
            }, 'Hourly cost limit reached');
        }

        return isOver;
    }

    /**
     * Reset session tracking
     */
    reset(): void {
        this.entries = [];
        this.sessionStart = new Date();
        log.info('Cost tracker reset');
    }
}

// Singleton instance
export const costTracker = new CostTracker();
