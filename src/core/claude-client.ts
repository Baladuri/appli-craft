import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config/index';
import { LLMClient } from '../clients/LLMClient';

/**
 * A thin wrapper around the Anthropic Claude API.
 * Supports a mock mode for testing purposes.
 */
export class ClaudeClient implements LLMClient {
  private client: Anthropic;
  private mockMode: boolean;

  constructor() {
    this.client = new Anthropic({
      apiKey: config.anthropicApiKey,
    });
    this.mockMode = config.mockMode;
  }

  /**
   * Generates a text response from Claude based on the provided prompt.
   * @param prompt - The user prompt to send to Claude.
   * @returns The text content of Claude's response.
   * @throws Error if the API call fails or an unexpected response type is received.
   */
  async generateText(prompt: string, temperature?: number): Promise<string> {
    if (this.mockMode) {
      return "MOCK_RESPONSE";
    }

    try {
      const response = await this.client.messages.create({
        model: config.model,
        max_tokens: 4096,
        temperature: temperature ?? 0,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = response.content[0];
      if (content.type === 'text') {
        return content.text;
      }
      throw new Error("Unexpected response type from Claude");
    } catch (error: any) {
      throw new Error(`Claude API error: ${error.message}`);
    }
  }

  /**
   * Generates a JSON response from Claude and parses it into the specified type.
   * Uses structured prompting to enforce JSON output.
   * @param prompt - The user prompt to send to Claude.
   * @returns The parsed JSON object of type T.
   * @throws Error if the API call fails or if the response is not valid JSON.
   */
  async generateJSON<T>(prompt: string, temperature?: number): Promise<T> {
    if (this.mockMode) {
      if (prompt.includes('information extraction system')) {
        return {
          requiredSkills: [
            { name: "Node.js", type: "hard", evidence: "Must have experience with Node.js" },
            { name: "TypeScript", type: "hard", evidence: "Knowledge of TypeScript is preferred" },
            { name: "React", type: "hard", evidence: "React is essential" },
            { name: "Python", type: "soft", evidence: "Ideally with Python" }
          ],
          candidateSkills: [
            { name: "Node.js", confidence: 1.0 },
            { name: "TypeScript", confidence: 0.9 },
            { name: "React", confidence: 0.8 },
            { name: "AWS", confidence: 0.7 }
          ]
        } as unknown as T;
      }
      if (prompt.includes('semantic skill comparison')) {
        return {
          match: "none",
          confidence: 0
        } as unknown as T;
      }
      return {} as T;
    }

    const jsonPrompt = `${prompt}\n\nIMPORTANT: Respond ONLY with valid JSON. Do not include any explanations, markdown code blocks, or preamble.`;

    try {
      const responseText = await this.generateText(jsonPrompt, temperature);
      // Attempt to find the first '{' and last '}' to handle potential markdown wrappers if Claude ignores instructions
      const cleanResponse = responseText.substring(
          responseText.indexOf('{'),
          responseText.lastIndexOf('}') + 1
      );

      return JSON.parse(cleanResponse || responseText) as T;
    } catch (error: any) {
      if (error instanceof SyntaxError || error.message.includes('JSON')) {
        throw new Error("Invalid JSON response from Claude");
      }
      throw error;
    }
  }
}
