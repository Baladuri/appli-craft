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
        }>(cvPrompt, 0);

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

Extraction rule — include ONLY if ALL of these are true:

1. A specific proper name appears explicitly in the JD
   text — a named technology, tool, framework, database,
   programming language, cloud service, or
   industry-standard methodology with a recognized
   proper name (e.g. "MySQL", "Docker", "Kubernetes",
   "Scrum", "OAuth")

2. The proper name appears verbatim or as a known
   canonical alias in the JD text — do not infer,
   derive, or paraphrase a skill name from a
   responsibility description

Canonical name rule: use the shortest widely-recognized
name for each tool, technology, methodology, or platform.
Remove vendor prefixes unless they are the distinguishing
part of the name.

Technical examples:
- "Microsoft .NET" → ".NET"
- "Microsoft SQL Server" → "MS SQL Server"
- "Google Kubernetes Engine" → "Kubernetes"
- "Amazon S3" → "S3"
- "Apache Kafka" → "Kafka"

Non-technical examples:
- "Google Analytics 4" → "Google Analytics"
- "Salesforce CRM" → "Salesforce"
- "SAP Financial Accounting" → "SAP"
- "Epic Systems EHR" → "Epic"
- "HubSpot Marketing Hub" → "HubSpot"

Exception: keep vendor prefix when it distinguishes
between competing products of the same category.
- "MS SQL" and "MySQL" both need their prefix
  to be unambiguous
- "Google Analytics" and "Adobe Analytics" both
  need their prefix to be unambiguous

3. If a phrase describes what someone will DO rather
   than what technology they need to KNOW, and no
   proper technology name is explicitly stated in that
   phrase, do not extract anything from it

Examples of what to extract:
- "Good knowledge of MySQL and MS SQL" → MySQL, MS SQL
- "Experience with Docker and Kubernetes" → Docker, Kubernetes
- "TypeScript / Node.js / Next.js" → TypeScript, Node.js, Next.js

Examples of what NOT to extract:
- "Planning and implementing complex interfaces" → nothing
  (no proper technology name stated)
- "Strong understanding of software architecture" → nothing
  (abstract concept, no proper name)
- "Experience in fast-paced environments" → nothing
  (behavioral, no proper name)
- "Solid understanding of scalability" → nothing
  (abstract concept)

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

        const result = await this.llm.generateJSON<{ requiredSkills: any[] }>(jdPrompt, 0);
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