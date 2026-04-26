export interface JobSkill {
  name: string;
  type: "hard" | "soft" | "implicit";
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
