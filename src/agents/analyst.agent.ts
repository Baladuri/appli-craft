import { BaseAgent } from './base-agent';
import { FileSystemManager } from '../core/fs-manager';
import { LLMClient } from '../clients/LLMClient';
import { ApplicationContext, AgentOutput, GapAnalysis, JobSkill } from '../core/types';
import * as path from 'path';

/**
 * AnalystAgent - Prototype
 * Responsibility: Performs gap analysis between a candidate's CV and the job description.
 */
export class AnalystAgent extends BaseAgent {
  constructor(fs: FileSystemManager, llm: LLMClient) {
    super("Analyst", fs, llm);
  }

  /**
   * Hardened execution method for Analyst agent.
   * Extracts skills and performs classification via the LLM prompt.
   */
  async execute(context: ApplicationContext, outputDir: string): Promise<AgentOutput> {
    try {
      const fileName = "gap-analysis.json";
      const baseCv = this.fs.readFile(context.baseCvPath);
      const jobDescription = context.jobDescription;

      const prompt = `You are an information extraction system.

Your job is to extract technical skills from a job description and a candidate's CV as structured data.

Job Description:
${jobDescription}

Candidate CV:
${baseCv}

---

### INSTRUCTIONS FOR REQUIRED SKILLS EXTRACTION

Extract ONLY concrete technical skills, tools, frameworks, and technologies from the Job Description.

For each skill, you MUST provide:
1. "name": The canonical name of the technology.
2. "type": One of "hard" | "soft" | "implicit".
3. "evidence": The SMALLEST meaningful phrase from the text that directly contains the skill.
4. "requirement": The requirement level assigned using these strict rules based on the exact language used in the JD:
   - "required" → assign this when the JD uses any of these words or phrases near the skill: "required", "must have", "must", "minimum", "essential", "you have", "you bring", "strong experience with", "solid understanding of"
   - "preferred" → assign this when the JD uses any of these words or phrases near the skill: "preferred", "nice to have", "ideally", "bonus", "plus", "advantageous", "experience with is a plus"
   - "implicit" → assign this only when the skill is mentioned as part of the tech stack listing with no qualifying language, or when none of the above signals are present

### EXCLUSION RULES:
- DO NOT extract abstract concepts (e.g., "Scalable systems design").
- DO NOT extract soft skills or behaviors (e.g., "Teamwork", "Communication").
- DO NOT extract responsibility-based phrases (e.g., "Agile environment").

---

### INSTRUCTIONS FOR CANDIDATE SKILLS EXTRACTION

Extract all relevant concrete technologies and tools from the CV.
Assign confidence (1.0 for explicit, 0.7 for inferred, 0.4 for weak signal).

---

Output ONLY valid JSON in this format:

{
  "requiredSkills": [
    { "name": "string", "type": "hard" | "soft" | "implicit", "evidence": "string", "requirement": "required" | "preferred" | "implicit" }
  ],
  "candidateSkills": [
    { "name": "string", "confidence": number }
  ]
}
`;

      const rawResult = await this.llm.generateJSON<any>(prompt);
      
      const parsed: GapAnalysis = {
        requiredSkills: rawResult.requiredSkills || [],
        candidateSkills: rawResult.candidateSkills || []
      };

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
