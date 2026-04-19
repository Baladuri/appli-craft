import { GapAnalysis } from './types';

export interface JobScore {
  jobId: string;
  score: number;
  decision: "apply" | "maybe" | "skip";
}

/**
 * Deterministically calculates a job score based on gap analysis metrics.
 * 
 * Formula:
 * score = gap.matchScore - (gap.riskFactors.length * 5) + (gap.decisionConfidence * 0.1)
 * 
 * Clamped between 0 and 100.
 */
export function calculateJobScore(gap: GapAnalysis, jobId: string): JobScore {
  const riskPenalty = gap.riskFactors.length * 5;
  const confidenceBonus = gap.decisionConfidence * 0.1;

  let score = gap.matchScore - riskPenalty + confidenceBonus;

  // Clamp score between 0 and 100
  score = Math.max(0, Math.min(100, score));

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
    score: parseFloat(score.toFixed(2)), // Keep two decimal places for precision
    decision
  };
}
