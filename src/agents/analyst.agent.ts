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
      "matchScore": number,
      "decisionConfidence": number,
      "applyDecision": "apply" | "maybe" | "skip",
      "riskFactors": string[],
      "summary": string
    }

    ---

    Rules for scoring:

    1. matchScore (0–100):
    - 80–100 → strong match (core stack aligns)
    - 50–79 → partial match (transferable skills, some gaps)
    - 0–49 → weak match (core requirements missing)

    2. decisionConfidence (0–100):
    - High (80–100) → clear decision, strong evidence
    - Medium (50–79) → some uncertainty
    - Low (0–49) → unclear or borderline case

    STRICT CONSISTENCY RULES:
    - matchScore is the absolute SOURCE OF TRUTH.
    - If matchScore ≥ 80 → overallFit MUST be "strong" AND applyDecision MUST be "apply".
    - If matchScore 50–79 → overallFit MUST be "moderate" AND applyDecision MUST be "maybe".
    - If matchScore < 50 → overallFit MUST be "weak" AND applyDecision MUST be "skip".
    - NEVER adjust matchScore to justify a decision; the decision must follow the score.
    - decisionConfidence must reflect certainty of the DECISION, not candidate strength.
    - DO NOT give high decisionConfidence if the situation is ambiguous.

    3. matchedSkills:
    - Only skills explicitly present or clearly demonstrated in CV

    4. missingSkills:
    - Must include ONLY critical job requirements missing

    5. emphasisPoints:
    - Concrete instructions for CV/cover letter optimization

    6. riskFactors:
    - Hard blockers or core tech mismatches justify the score/decision.

    7. summary:
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
        matchScore: parsed.matchScore,
        decisionConfidence: parsed.decisionConfidence,
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
