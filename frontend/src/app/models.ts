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

export interface BatchJobResult {
  sessionId: string;
  company: string;
  role: string;
  decision: "apply" | "maybe" | "skip";
  coverage: number;
  gapAnalysis: GapAnalysis;
  summary: string;
  materials: {
    tailoredCv: string;
    coverLetter: string;
    interviewPrep: string;
  } | null;
  generatingMaterials: boolean;
  showSkillDetail: boolean;
}
