import OpenAI from 'openai';
import { config } from '../config/index';

const DEEPSEEK_VL2_MODEL = 'deepseek-vl2';

export class DeepSeekVisionClient {
  private client: OpenAI;
  private mockMode: boolean;

  constructor() {
    this.client = new OpenAI({
      apiKey: config.deepseekApiKey,
      baseURL: 'https://api.deepseek.com',
    });
    this.mockMode = config.mockMode;
  }

  async extractTextFromImage(base64Image: string): Promise<string> {
    if (this.mockMode) {
      return 'MOCK_EXTRACTED_TEXT';
    }

    try {
      const response = await this.client.chat.completions.create({
        model: DEEPSEEK_VL2_MODEL,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: `data:image/png;base64,${base64Image}` },
              },
              {
                type: 'text',
                text: 'Extract all text from this image. Return only the extracted text, no commentary.',
              },
            ],
          },
        ],
        max_tokens: 4096,
        temperature: 0,
      });

      return response.choices[0]?.message?.content ?? '';
    } catch (error: any) {
      throw new Error(`DeepSeek VL2 API error: ${error.message}`);
    }
  }
}
