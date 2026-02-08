import OpenAI from "openai";
import { LLMProvider } from "./provider.js";
import { ChatMessage, ChatOptions, ChatResponse } from "./types.js";
import { costTracker } from "./costTracker.js";
import { loggers } from "../utils/logger.js";

const log = loggers.llm;

export class OpenAIProvider extends LLMProvider {
  private _client: OpenAI | null = null;

  constructor() {
    super();
  }

  /**
   * Lazy initialization of OpenAI client
   * Only throws if API key is missing when client is actually needed
   */
  private getClient(): OpenAI {
    if (!this._client) {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error("Missing OPENAI_API_KEY environment variable");
      }
      
      this._client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
    return this._client;
  }

  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<ChatResponse> {
    const client = this.getClient();
    const model = options.model || "gpt-4o";
    const startTime = Date.now();

    log.info({ model, messageCount: messages.length }, 'Starting chat completion');

    const response = await client.chat.completions.create({
      model,
      messages,
      max_tokens: options.maxTokens || 1000,
      temperature: options.temperature || 0.1,
    });

    const latency = Date.now() - startTime;

    // Track costs
    if (response.usage) {
      costTracker.record(
        model,
        response.usage.prompt_tokens,
        response.usage.completion_tokens,
        'chat'
      );
    }

    log.info({
      model,
      latencyMs: latency,
      promptTokens: response.usage?.prompt_tokens,
      completionTokens: response.usage?.completion_tokens,
    }, 'Chat completion finished');

    return {
      content: response.choices[0].message?.content || "No response generated.",
      usage: response.usage ? {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
      } : undefined,
    };
  }

  async embed(text: string): Promise<number[]> {
    const client = this.getClient();
    const model = "text-embedding-3-small";
    const startTime = Date.now();

    const response = await client.embeddings.create({
      model,
      input: text,
    });

    const latency = Date.now() - startTime;

    // Track embedding costs
    costTracker.record(model, text.length / 4, 0, 'embedding');

    log.debug({ model, latencyMs: latency, inputLength: text.length }, 'Embedding created');

    return response.data[0].embedding;
  }
}

// Export singleton instance
export const openaiProvider = new OpenAIProvider();