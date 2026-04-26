import { BaseAgent } from './base-agent';
import { LLMClient } from '../clients/LLMClient';
import { ApplicationContext, AgentOutput, GapAnalysis } from '../core/types';
import * as crypto from 'crypto';

const candidateCache = new Map<string, { name: string; confidence: number }[]>();
const jdCache = new Map<string, any[]>();

export class AnalystAgent extends BaseAgent {
  constructor(llm: LLMClient) {
    super("Analyst", llm);
  }

  async execute(context: ApplicationContext): Promise<AgentOutput<GapAnalysis>> {
    try {
      const baseCv = context.baseCv;
      const jobDescription = context.jobDescription;

      const cvHash = crypto.createHash('md5').update(baseCv).digest('hex');
      const jdHash = crypto.createHash('md5').update(jobDescription).digest('hex');

      // ── Step 1: Candidate skills — cached by CV hash ──────────────────────
      let candidateSkills: { name: string; confidence: number }[];

      if (candidateCache.has(cvHash)) {
        console.log('  ⚡ Candidate skills from cache');
        candidateSkills = candidateCache.get(cvHash)!;
      } else {
        const cvPrompt = `You are a skill extraction system.

Extract ALL concrete technical skills, tools, frameworks, and 
technologies from this CV. Be exhaustive and consistent.

CV:
${baseCv}

Rules:
- Extract every technology explicitly mentioned by name
- Use exact canonical names: "Node.js" not "node", "PostgreSQL" not "postgres"
- Assign confidence: 1.0 if used professionally, 0.7 if mentioned 
  without depth, 0.4 if only briefly referenced
- Do NOT extract soft skills or behaviors
- Do NOT miss anything — be thorough

Output ONLY valid JSON:
{
  "candidateSkills": [
    { "name": "string", "confidence": number }
  ]
}`;

        const result = await this.llm.generateJSON<{
          candidateSkills: { name: string; confidence: number }[]
        }>(cvPrompt);

        candidateSkills = result.candidateSkills || [];
        candidateCache.set(cvHash, candidateSkills);
        console.log(`  📋 Candidate skills extracted: ${candidateSkills.length} skills`);
      }

      // ── Step 2: JD required skills — cached by JD hash ───────────────────
      let requiredSkills: any[];

      if (jdCache.has(jdHash)) {
        console.log('  ⚡ JD skills from cache');
        requiredSkills = jdCache.get(jdHash)!;
      } else {
        const jdPrompt = `You are a skill extraction system.

Extract ONLY concrete technical skills, tools, frameworks, and 
technologies from this job description.

Job Description:
${jobDescription}

For each skill provide:
- "name": exact canonical technology name
- "evidence": smallest phrase from JD containing the skill
- "requirement": classify strictly:
  - "required" → JD uses: "required", "must", "minimum", "essential",
    "you have", "you bring", "strong experience with", 
    "solid understanding of"
  - "preferred" → JD uses: "preferred", "nice to have", "ideally",
    "bonus", "plus", "advantageous"
  - "implicit" → skill in tech stack listing with no qualifying language

Exclusion rules:
- Do NOT extract abstract concepts
- Do NOT extract soft skills or behaviors
- Do NOT extract responsibility phrases
- If two extracted skills refer to the same concept or are commonly 
  written as a combined term, extract them as one skill using the 
  combined form, not as two separate entries

Output ONLY valid JSON:
{
  "requiredSkills": [
    { 
      "name": "string", 
      "evidence": "string", 
      "requirement": "required" | "preferred" | "implicit" 
    }
  ]
}`;

        const result = await this.llm.generateJSON<{ requiredSkills: any[] }>(jdPrompt);
        requiredSkills = result.requiredSkills || [];
        jdCache.set(jdHash, requiredSkills);
        console.log(`  📋 JD skills extracted: ${requiredSkills.length} skills`);
      }

      // ── Step 3: Return combined result in memory ──────────────────────────
      const parsed: GapAnalysis = { requiredSkills, candidateSkills };

      return {
        agentName: this.agentName,
        success: true,
        data: parsed
      };
    } catch (error: any) {
      return {
        agentName: this.agentName,
        success: false,
        data: { requiredSkills: [], candidateSkills: [] },
        error: error?.message || 'Unknown error'
      };
    }
  }
}