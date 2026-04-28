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

// New unified job queue item
export type JobQueueStatus =
  | 'input'        // item added, waiting for user to confirm
  | 'blocked'      // URL from blocked portal, needs manual paste
  | 'queued'       // ready to process, waiting in queue
  | 'fetching'     // fetching URL content
  | 'analyzing'    // running through pipeline
  | 'done'         // analysis complete
  | 'failed';      // something went wrong

export interface JobQueueItem {
  id: string;                          // unique local id
  inputType: 'url' | 'text';          // how the JD arrived
  rawInput: string;                    // original URL or pasted text
  resolvedText: string;               // clean JD text after fetch
  status: JobQueueStatus;
  errorMessage: string | null;

  // Result fields — populated when status === 'done'
  sessionId: string | null;
  company: string | null;
  role: string | null;
  decision: 'apply' | 'maybe' | 'skip' | null;
  coverage: number | null;
  summary: string | null;
  gapAnalysis: GapAnalysis | null;

  // Materials state
  materials: {
    tailoredCv: string;
    coverLetter: string;
    interviewPrep: string;
  } | null;
  generatingMaterials: boolean;
  showSkillDetail: boolean;

  // Inline paste for blocked portals
  manualText: string;
}
