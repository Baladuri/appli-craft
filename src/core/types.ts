export interface ApplicationContext {
  company: string;
  role: string;
  date: string;
  jobDescription: string;
  baseCv: string;
}

export interface AgentOutput<T = string> {
  agentName: string;
  success: boolean;
  data: T;
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

export interface ApplicationMaterials {
  tailoredCv: string;
  coverLetter: string;
  interviewPrep: string;
}

export interface PipelineResult {
  decision: ApplicationDecision;
  gapAnalysis: GapAnalysis;
  companyBrief: string;
  summary: string;
}

export interface SemanticMatch {
  match: "full" | "partial" | "none";
  confidence: number;
}

export interface OrchestratorConfig {
  jobDescription: string;
  company: string;
  role: string;
  baseCv: string;
}