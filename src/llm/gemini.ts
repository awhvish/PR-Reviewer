import { GoogleGenerativeAI } from "@google/generative-ai";
import { LLMProvider } from "./provider.js";
import { ChatMessage, ChatOptions, ChatResponse } from "./types.js";
import { costTracker } from "./costTracker.js";
import { loggers } from "../utils/logger.js";

const log = loggers.llm;

export class GeminiProvider extends LLMProvider {
  private _client: GoogleGenerativeAI | null = null;

  constructor() {
    super();
  }

  /**
   * Lazy initialization of Gemini client
   */
  private getClient(): GoogleGenerativeAI {
    if (!this._client) {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("Missing GEMINI_API_KEY environment variable");
      }
      
      this._client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }
    return this._client;
  }

  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<ChatResponse> {
    const client = this.getClient();
    const modelName = options.model || "gemini-2.0-flash";
    const startTime = Date.now();

    log.info({ model: modelName, messageCount: messages.length }, 'Starting Gemini chat completion');

    const model = client.getGenerativeModel({ model: modelName });

    // Convert messages to Gemini format
    const systemMessage = messages.find(m => m.role === 'system');
    const chatMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));

    // Build the prompt with system instruction
    const chat = model.startChat({
      history: chatMessages.slice(0, -1) as any,
      generationConfig: {
        maxOutputTokens: options.maxTokens || 1000,
        temperature: options.temperature || 0.1,
      },
      systemInstruction: systemMessage?.content,
    });

    const lastMessage = chatMessages[chatMessages.length - 1];
    const result = await chat.sendMessage(lastMessage.parts[0].text);
    const response = result.response;

    const latency = Date.now() - startTime;

    // Estimate tokens (Gemini doesn't always return usage)
    const promptTokens = messages.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0);
    const completionTokens = Math.ceil((response.text()?.length || 0) / 4);

    // Track costs (Gemini Pro is much cheaper)
    costTracker.record(
      modelName,
      promptTokens,
      completionTokens,
      'gemini-chat'
    );

    log.info({
      model: modelName,
      latencyMs: latency,
      promptTokens,
      completionTokens,
    }, 'Gemini chat completion finished');

    return {
      content: response.text() || "No response generated.",
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
    };
  }

  async embed(text: string): Promise<number[]> {
    const client = this.getClient();
    const modelName = "text-embedding-004";
    const startTime = Date.now();

    const model = client.getGenerativeModel({ model: modelName });

    const result = await model.embedContent(text);
    const embedding = result.embedding.values;

    const latency = Date.now() - startTime;

    // Track embedding costs (Gemini embeddings are free/very cheap)
    costTracker.record(modelName, text.length / 4, 0, 'gemini-embedding');

    log.debug({ model: modelName, latencyMs: latency, inputLength: text.length }, 'Gemini embedding created');

    return embedding;
  }
}

// Export singleton instance
export const geminiProvider = new GeminiProvider();
