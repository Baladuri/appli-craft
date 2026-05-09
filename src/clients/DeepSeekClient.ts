import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config/index';
import { LLMClient } from './LLMClient';

const DEEPSEEK_MODEL = 'deepseek-v4-flash';

export class DeepSeekClient implements LLMClient {
  private client: Anthropic;
  private mockMode: boolean;

  constructor() {
    this.client = new Anthropic({
      apiKey: config.deepseekApiKey,
      baseURL: 'https://api.deepseek.com/anthropic',
    });
    this.mockMode = config.mockMode;
  }

  async generateText(prompt: string): Promise<string> {
    if (this.mockMode) {
      return 'MOCK_RESPONSE';
    }

    try {
      const response = await this.client.messages.create({
        model: DEEPSEEK_MODEL,
        max_tokens: 4096,
        temperature: 0,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = response.content[0];
      if (content.type === 'text') {
        return content.text;
      }
      throw new Error('Unexpected response type from DeepSeek');
    } catch (error: any) {
      throw new Error(`DeepSeek API error: ${error.message}`);
    }
  }

  async generateJSON<T>(prompt: string): Promise<T> {
    if (this.mockMode) {
      if (prompt.includes('information extraction system')) {
        return {
          requiredSkills: [
            { name: 'Node.js', type: 'hard', evidence: 'Must have experience with Node.js' },
            { name: 'TypeScript', type: 'hard', evidence: 'Knowledge of TypeScript is preferred' },
            { name: 'React', type: 'hard', evidence: 'React is essential' },
            { name: 'Python', type: 'soft', evidence: 'Ideally with Python' },
          ],
          candidateSkills: [
            { name: 'Node.js', confidence: 1.0 },
            { name: 'TypeScript', confidence: 0.9 },
            { name: 'React', confidence: 0.8 },
            { name: 'AWS', confidence: 0.7 },
          ],
        } as unknown as T;
      }
      if (prompt.includes('semantic skill comparison')) {
        return { match: 'none', confidence: 0 } as unknown as T;
      }
      return {} as T;
    }

    const jsonPrompt = `${prompt}\n\nIMPORTANT: Respond ONLY with valid JSON. Do not include any explanations, markdown code blocks, or preamble.`;

    try {
      const responseText = await this.generateText(jsonPrompt);
      const cleanResponse = responseText.substring(
        responseText.indexOf('{'),
        responseText.lastIndexOf('}') + 1
      );

      return JSON.parse(cleanResponse || responseText) as T;
    } catch (error: any) {
      if (error instanceof SyntaxError || error.message.includes('JSON')) {
        throw new Error('Invalid JSON response from DeepSeek');
      }
      throw error;
    }
  }
}
