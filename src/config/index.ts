import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export interface Config {
  anthropicApiKey: string;
  deepseekApiKey: string;
  llmProvider: 'claude' | 'deepseek';
  githubToken: string;
  githubUsername: string;
  mockMode: boolean;
  model: string;
  outputBaseDir: string;
  baseCvPath: string;
  jobDescriptionPath: string;
}

export const config: Config = {
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  deepseekApiKey: process.env.DEEPSEEK_API_KEY || '',
  llmProvider: (process.env.LLM_PROVIDER || 'claude') as 'claude' | 'deepseek',
  githubToken: process.env.GITHUB_TOKEN || '',
  githubUsername: process.env.GITHUB_USERNAME || '',
  mockMode: process.env.MOCK_MODE === 'true',
  model: 'claude-haiku-4-5',
  outputBaseDir: path.resolve('./applications'),
  baseCvPath: path.resolve('./data/base-cv.md'),
  jobDescriptionPath: path.resolve('./data/job-description.md'),
};

export function validateConfig() {
  if (config.llmProvider !== 'claude' && config.llmProvider !== 'deepseek') {
    throw new Error(`Unknown LLM_PROVIDER: ${config.llmProvider}. Must be claude or deepseek`);
  }
  if (config.mockMode) return;
  if (config.llmProvider === 'claude' && !config.anthropicApiKey) {
    throw new Error('Anthropic API key is required when not in mock mode');
  }
  if (config.llmProvider === 'deepseek' && !config.deepseekApiKey) {
    throw new Error('DEEPSEEK_API_KEY is required when LLM_PROVIDER=deepseek');
  }
}