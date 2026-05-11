import { LLMClient } from '../clients/LLMClient';

export function normalize(skill: string): string {
  return skill.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export async function matchSkill(
  required: { name: string; requirement: string },
  normalizedCandidates: { name: string; normalized: string }[],
  llmClient: LLMClient,
  getRequirementWeight: (requirement: string) => number
): Promise<{ score: number; log: string }> {
  // Step 1 — Calculate weight:
  const weight = getRequirementWeight(required.requirement);

  // Step 2 — Exact match check:
  const exactMatch = normalizedCandidates.find(
    (c) => c.normalized === normalize(required.name)
  );

  if (exactMatch) {
    return {
      score: 1 * weight,
      log: `     ✓ ${required.name} → ${exactMatch.name} (exact, score: ${1 * weight})`
    };
  }

  // Step 3 — Semantic match via single LLM call:
  try {
    const semanticPrompt = `You are a skill matching system.

Required skill: "${required.name}"

Candidate skills:
${normalizedCandidates.map((c, i) => `${i + 1}. ${c.name}`).join('\n')}

Find the single best match from the candidate skills list for the required skill.

Rules:
- "full" → candidate skill directly and fully satisfies the requirement
- "partial" → candidate skill partially covers the requirement
- "none" → no meaningful match exists in the list

A specific tool, library, or product that is a subset or component of a broader technology should be scored as partial, not full. Full match requires the candidate skill to cover the same scope and level as the required skill. When the candidate skill is narrower in scope than the required skill, always return partial.

Be strict but fair. If unsure, return "none".
DO NOT compute scores or make application decisions.

Respond ONLY with valid JSON:
{
  "match": "full" | "partial" | "none",
  "confidence": number between 0 and 1,
  "candidateName": "exact name from the candidate list, or empty string if none"
}`;

    const result = await llmClient.generateJSON<{
      match: string;
      confidence: number;
      candidateName: string;
    }>(semanticPrompt);

    if (result.match === 'full') {
      return {
        score: 1 * weight,
        log: `     ≈ ${required.name} → ${result.candidateName} (semantic full, score: ${1 * weight})`
      };
    } else if (result.match === 'partial') {
      return {
        score: 0.5 * weight,
        log: `     ~ ${required.name} → ${result.candidateName} (semantic partial, score: ${0.5 * weight})`
      };
    } else {
      return {
        score: 0,
        log: `     ✗ ${required.name} → no match (score: 0)`
      };
    }
  } catch (e) {
    return {
      score: 0,
      log: `     ✗ ${required.name} → no match (score: 0)`
    };
  }
}
