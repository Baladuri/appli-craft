import { GapAnalysis } from './types';
import { LLMClient } from '../clients/LLMClient';

export interface ATSSkillResult {
  skill: string;
  requirement: string;
}

export interface ATSReport {
  safe: ATSSkillResult[];           // exact term found in CV
  termGaps: ATSSkillResult[];       // semantically matched but not verbatim
  genuineGaps: ATSSkillResult[];    // not matched at all
  suggestions: string;              // LLM placement advice for termGaps
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function termExistsInCV(term: string, cvText: string): boolean {
  // Check exact case-insensitive match as whole word
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`\\b${escaped}\\b`, 'i');
  return regex.test(cvText);
}

export async function analyzeATS(
  gapAnalysis: GapAnalysis,
  cvText: string,
  llmClient: LLMClient
): Promise<ATSReport> {

  const safe: ATSSkillResult[] = [];
  const termGaps: ATSSkillResult[] = [];
  const genuineGaps: ATSSkillResult[] = [];

  const normalizedCv = cvText.toLowerCase();

  for (const skill of gapAnalysis.requiredSkills) {
    // Check if candidate has any skill that normalizes similarly
    const jdNorm = normalize(skill.name);
    const hasSemanticMatch = gapAnalysis.candidateSkills.some(
      c => normalize(c.name) === jdNorm ||
           normalizedCv.includes(skill.name.toLowerCase())
    );

    const hasVerbatimMatch = termExistsInCV(skill.name, cvText);

    if (hasVerbatimMatch) {
      safe.push({ skill: skill.name, requirement: skill.requirement });
    } else if (hasSemanticMatch) {
      termGaps.push({ skill: skill.name, requirement: skill.requirement });
    } else {
      genuineGaps.push({ skill: skill.name, requirement: skill.requirement });
    }
  }

  // Only call LLM if there are terminology gaps
  let suggestions = '';
  if (termGaps.length > 0) {
    const prompt = `You are an ATS optimization advisor.

The candidate's CV matches these skills semantically but does not
use the exact terminology from the job description.

Skills with terminology gaps:
${termGaps.map(t => `- "${t.skill}" (${t.requirement})`).join('\n')}

CV excerpt (first 2000 chars):
${cvText.substring(0, 2000)}

For each skill, give one specific, concise suggestion on where
and how to naturally add the exact term to the CV.
Be direct. Maximum 2 sentences per skill.
No bullet points. No preamble.`;

    try {
      suggestions = await llmClient.generateText(prompt);
    } catch {
      suggestions = 'Could not generate suggestions at this time.';
    }
  }

  return { safe, termGaps, genuineGaps, suggestions };
}
