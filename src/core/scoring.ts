import { GapAnalysis } from './types';

export interface JobScore {
  jobId: string;
  score: number;
  decision: "apply" | "maybe" | "skip";
}

export function calculateJobScore(jobId: string, hardCoverage: number): JobScore {
  const score = parseFloat((hardCoverage * 100).toFixed(2));

  // Decision mapping
  let decision: "apply" | "maybe" | "skip";
  if (score >= 80) {
    decision = "apply";
  } else if (score >= 50) {
    decision = "maybe";
  } else {
    decision = "skip";
  }

  return {
    jobId,
    score,
    decision
  };
}
