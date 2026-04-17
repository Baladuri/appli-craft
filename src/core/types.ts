export interface ApplicationContext {
  company: string;
  role: string;
  date: string;
  outputDir: string;
  jobDescription: string;
  baseCvPath: string;
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
  applyDecision: 'apply' | 'maybe' | 'skip';
  confidenceScore: number;
  skillMatchScore: number;
  riskFactors: string[];
  summary: string;
}

export interface OrchestratorConfig {
  jobDescription: string;
  company: string;
  role: string;
  baseCvPath: string;
}