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

export interface JobSkill {
  name: string;
  type: "hard" | "soft" | "implicit";
  requirement: "required" | "preferred" | "implicit";
  evidence: string;
}

export interface GapAnalysis {
  requiredSkills: JobSkill[];
  candidateSkills: { name: string; confidence: number }[];
}

export interface ApplicationDecision {
  applyDecision: "apply" | "maybe" | "skip";
  hardCoverage: number;
}

export interface SemanticMatch {
  match: "full" | "partial" | "none";
  confidence: number;
}

export interface OrchestratorConfig {
  jobDescription: string;
  company: string;
  role: string;
  baseCvPath: string;
}