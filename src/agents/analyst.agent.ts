import { BaseAgent } from './base-agent';
import { FileSystemManager } from '../core/fs-manager';
import { ClaudeClient } from '../core/claude-client';
import { ApplicationContext, AgentOutput, GapAnalysis } from '../core/types';
import * as path from 'path';

/**
 * AnalystAgent - Prototype
 * Responsibility: Performs gap analysis between a candidate's CV and the job description.
 */
export class AnalystAgent extends BaseAgent {
  constructor(fs: FileSystemManager, llm: ClaudeClient) {
    super("Analyst", fs, llm);
  }

  /**
   * Stub execution method for Analyst agent.
   * Generates a mock gap analysis JSON file.
   */
  async execute(context: ApplicationContext, outputDir: string): Promise<AgentOutput> {
    try {
      const fileName = "gap-analysis.json";

      const companyBrief = this.fs.readFile(path.join(outputDir, "company-brief.md"));
      const baseCv = this.fs.readFile(context.baseCvPath);
      const jobDescription = context.jobDescription;

      const prompt = `You are an information extraction system.

Your job is to extract structured data from:
- a job description
- a candidate CV

Job Description:
${jobDescription}

Candidate CV:
${baseCv}

DO NOT evaluate.
DO NOT score.
DO NOT give opinions.
DO NOT decide fit.

---

Extract the following:

1. requiredSkills:
- INCLUDE ONLY:
  - concrete, specific, named skills
  - technologies, tools, frameworks, platforms
  - items that can be directly matched with candidateSkills using string normalization
- EXCLUDE:
  - abstract concepts (e.g., "Scalable systems design", "Database scaling")
  - broad domains (e.g., "Cloud Infrastructure", "System architecture")
  - derived capabilities (e.g., "Containerization", "Infrastructure automation")
  - behaviors / soft skills (e.g., "Teamwork", "Communication", "Code review")
  - anything that cannot be matched deterministically via string comparison
- Classify ONLY by job-context importance:
  - 'hard' → explicitly required OR clearly central in JD
  - 'implicit' → supporting tools or less emphasized skills
  - DO NOT extract soft skills.
- CRITICAL RULES:
  - If a skill cannot be matched deterministically later → DO NOT INCLUDE IT.
  - Prefer missing a skill over including an abstract one.
  - Keep output strictly actionable for 1:1 simple string matching.

2. candidateSkills:
- Extract ALL relevant concrete technologies and tools inferred from the CV.
- DO NOT list overly generic entries (e.g. "Systems development").
- Assign confidence:
  - 1.0 → explicitly stated or strong evidence
  - 0.7 → inferred with strong confidence
  - 0.4 → weak or indirect signal

---

EXTRACTION GUIDANCE:
- Quality > Quantity. Extraction must be strict and minimal.
- DO NOT infer too much or expand into abstract concepts.
- DO NOT list everything mentioned, only decision-relevant, concrete skills.
- Every skill must be something that can be directly matched or normalized in the scoring layer.
- Do NOT return empty arrays unless the JD or CV is genuinely empty.

RULES:
- NORMALIZE naming: prefer canonical names (e.g. "Node.js" → "Node.js", "CI/CD pipelines" → "CI/CD"). Normalize obvious variants to one name but do NOT over-merge unrelated terms.
- ENFORCE NORMALIZATION: every requiredSkill.name must logically map to a real technology/tool/framework that exists in candidateSkills or synonym mapping.
- Do NOT invent skills
- Do NOT compare CV vs JD
- Do NOT calculate match
- Do NOT include explanations

---

EXAMPLE:
Job: "Experience with Node.js and Docker"
CV: "Built backend services using Node.js and containerized apps"

Output:
{
  "requiredSkills": [
    { "name": "Node.js", "type": "hard" },
    { "name": "Docker", "type": "hard" }
  ],
  "candidateSkills": [
    { "name": "Node.js", "confidence": 1.0 },
    { "name": "Docker", "confidence": 0.7 },
    { "name": "Backend development", "confidence": 0.7 },
    { "name": "Containerization", "confidence": 1.0 }
  ]
}

---

Output ONLY valid JSON in this format:

{
  "requiredSkills": [
    { "name": "string", "type": "hard" | "soft" | "implicit" }
  ],
  "candidateSkills": [
    { "name": "string", "confidence": number }
  ]
}
`;

      const parsed: GapAnalysis = await this.llm.generateJSON<GapAnalysis>(prompt);
      const content = JSON.stringify(parsed, null, 2);

      const filePath = this.writeOutput(fileName, content, outputDir);

      return {
        agentName: this.agentName,
        outputFile: filePath,
        success: true
      };
    } catch (error: any) {
      return {
        agentName: this.agentName,
        outputFile: "",
        success: false,
        error: error?.message || "Unknown error occurred"
      };
    }
  }
}
