export interface JobScore {
  jobId: string;
  company: string;
  role: string;
  score: number;
  decision: "apply" | "maybe" | "skip";
}

export function calculateJobScore(
  jobId: string,
  company: string,
  role: string,
  hardCoverage: number
): JobScore {
  const score = parseFloat((hardCoverage * 100).toFixed(2));

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
    company,
    role,
    score,
    decision
  };
}
