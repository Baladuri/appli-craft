export interface ApplicationContext {
  company: string;
  role: string;
  date: string;
  outputDir: string;
  jobDescription: string;
}

export interface AgentOutput {
  agentName: string;
  outputFile: string;
  success: boolean;
  error?: string;
}

export interface GitHubRepo {
  name: string;
  description: string | null;
  language: string | null;
  stars: number;
  url: string;
  topics: string[];
}

export interface GapAnalysis {
  matchedSkills: string[];
  missingSkills: string[];
  emphasisPoints: string[];
  overallFit: 'strong' | 'moderate' | 'weak';
  summary: string;
}

export interface OrchestratorConfig {
  jobDescription: string;
  company: string;
  role: string;
  baseCvPath: string;
}