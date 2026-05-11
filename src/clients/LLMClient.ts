export interface LLMClient {
  generateText(prompt: string): Promise<string>;
  generateJSON<T>(prompt: string, temperature?: number): Promise<T>;
}
