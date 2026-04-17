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

      const prompt = `You are a technical recruiter and job fit evaluator.

    Your task is to analyze a candidate CV against a job description and produce a structured evaluation used for downstream decision making.

    ---

    Company Brief:
    ${companyBrief}

    Candidate CV:
    ${baseCv}

    Job Description:
    ${jobDescription}

    ---

    Return ONLY a raw JSON object. No markdown, no explanation.

    The JSON must match exactly:

    {
      "matchedSkills": string[],
      "missingSkills": string[],
      "emphasisPoints": string[],
      "overallFit": "strong" | "moderate" | "weak",

      "skillMatchScore": number, 
      "riskFactors": string[],

      "applyDecision": "apply" | "maybe" | "skip",
      "confidenceScore": number,

      "summary": string
    }

    ---

    Rules:

    1. matchedSkills:
    - Only skills explicitly present or clearly demonstrated in CV

    2. missingSkills:
    - Must include ONLY critical job requirements missing

    3. emphasisPoints:
    - Concrete instructions for CV/cover letter optimization

    4. overallFit:
    - strong = ≥ 75% alignment
    - moderate = 45–74%
    - weak = < 45%

    5. skillMatchScore:
    - 0–100 based ONLY on technical + role alignment

    6. riskFactors:
    - Hard blockers or serious mismatches (e.g. missing core tech stack)

    7. applyDecision:
    - "apply" → strong fit + no critical blockers
    - "maybe" → some gaps but transferable
    - "skip" → core mismatch or missing primary stack

    8. confidenceScore:
    - 0–100 how confident you are in this evaluation

    9. summary:
    - 2–3 sentences, honest and non-promotional

    ---

    Hard rule:
    Do NOT optimize candidate chances artificially.
    Be strictly honest and conservative in scoring.`;

      const parsed: GapAnalysis = await this.llm.generateJSON<GapAnalysis>(prompt);
      const content = JSON.stringify(parsed, null, 2);

      const filePath = this.writeOutput(fileName, content, outputDir);

      // Persist the key decision metrics to a separate file for easier downstream access
      const decision = {
        applyDecision: parsed.applyDecision,
        confidenceScore: parsed.confidenceScore,
        skillMatchScore: parsed.skillMatchScore,
        riskFactors: parsed.riskFactors || []
      };
      this.writeOutput("decision.json", JSON.stringify(decision, null, 2), outputDir);

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
