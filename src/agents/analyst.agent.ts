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
- MUST ONLY include:
  - programming languages (e.g. JavaScript, Ruby)
  - frameworks (e.g. Rails, Spring Boot)
  - libraries (e.g. React, Angular)
  - databases (e.g. PostgreSQL, Redis)
  - infrastructure/tools (e.g. Docker, Kubernetes, GitHub Actions, Heroku)
- DO NOT include:
  - abstract concepts (e.g. "Cloud Infrastructure", "Software Design")
  - soft skills or vague categories (e.g. "CSS", "Frontend development")
  - duplicated/generalized terms (e.g. "CI/CD" if already represented as GitHub Actions or Azure Pipelines unless explicitly required)
- Classify each as:
  - 'hard' → explicitly required, core stack, or repeated emphasis
  - 'soft' → nice-to-have or secondary
  - 'implicit' → ONLY include if explicitly implied in job description text. MUST be technical AND scorable. Avoid broad system-level abstractions.

2. candidateSkills:
- Extract ALL relevant concrete technologies and tools inferred from the CV.
- DO NOT include overly generic entries (e.g. "Full-stack development", "Systems development", "Backend development"). Keep only concrete technologies and tools.
- Assign confidence:
  - 1.0 → explicitly stated or strong evidence
  - 0.7 → inferred with strong confidence
  - 0.4 → weak or indirect signal

---

EXTRACTION GUIDANCE:
- If a skill is implied (e.g. "built scalable APIs") → infer associated concrete technologies if apparent, but DO NOT infer abstract concepts like "API design".
- Every skill must be something that can be directly matched or normalized in the scoring layer.
- Do NOT return empty arrays unless the CV or Job Description is genuinely empty.

RULES:
- ENFORCE NORMALIZATION: every requiredSkill.name must map to a real technology/tool/framework that can exist in candidateSkills OR be reasonably expected to match via synonym mapping.
- Normalize skill names (e.g. "Node.js", "NodeJS" → "Node")
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
