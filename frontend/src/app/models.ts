export interface JobSkill {
  name: string;
  requirement: "required" | "preferred" | "implicit";
  evidence: string;
}

export interface CandidateSkill {
  name: string;
  confidence: number;
}

export interface GapAnalysis {
  requiredSkills: JobSkill[];
  candidateSkills: CandidateSkill[];
}

export interface JobScore {
  decision: "apply" | "maybe" | "skip";
  score: number;
}

export interface BatchRanking {
  jobId: string;
  company: string;
  role: string;
  score: number;
  decision: "apply" | "maybe" | "skip";
}
