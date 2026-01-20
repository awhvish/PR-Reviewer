import OpenAI from "openai";
import { LLMProvider, ChatMessage, ChatOptions, ChatResponse } from "./provider.js";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("Missing OPENAI_API_KEY environment variable");
}

export class OpenAIProvider extends LLMProvider {
  private client: OpenAI;

  constructor() {
    super();
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });
  }

  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<ChatResponse> {
    const response = await this.client.chat.completions.create({
      model: options.model || "gpt-4o",
      messages,
      max_tokens: options.maxTokens || 1000,
      temperature: options.temperature || 0.1,
    });

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
    const response = await this.client.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });

    return response.data[0].embedding;
  }
}

// Export singleton instance
export const openaiProvider = new OpenAIProvider();