import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export interface Config {
  anthropicApiKey: string;
  githubToken: string;
  githubUsername: string;
  mockMode: boolean;
  model: string;
  outputBaseDir: string;
  baseCvPath: string;
}

export const config: Config = {
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  githubToken: process.env.GITHUB_TOKEN || '',
  githubUsername: process.env.GITHUB_USERNAME || '',
  mockMode: process.env.MOCK_MODE === 'true',
  model: 'claude-sonnet-4-6',
  outputBaseDir: path.resolve('./applications'),
  baseCvPath: path.resolve('./data/base-cv.md'),
};

export function validateConfig() {
  if (!config.mockMode && !config.anthropicApiKey) {
    throw new Error('Anthropic API key is required when not in mock mode');
  }
}