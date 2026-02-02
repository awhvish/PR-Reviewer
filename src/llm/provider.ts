import { ChatMessage, ChatOptions, ChatResponse } from "./types";

export type { ChatMessage, ChatOptions, ChatResponse };

export abstract class LLMProvider {
  abstract chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse>;
  abstract embed(text: string): Promise<number[]>;
}