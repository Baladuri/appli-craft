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
    const fileName = "gap-analysis.json";

    const companyBrief = this.fs.readFile(path.join(outputDir, "company-brief.md"));
    const baseCv = this.fs.readFile(context.baseCvPath);

    const prompt = `You are a technical recruiter analyzing a candidate's CV against a job opportunity.

  Company Brief:
  ${companyBrief}

  Candidate CV:
  ${baseCv}

  Analyze the match and respond with ONLY a JSON object. No markdown, no explanation, no code fences. Raw JSON only.

  The JSON must exactly match this structure:
  {
    "matchedSkills": [],
    "missingSkills": [],
    "emphasisPoints": [],
    "overallFit": "strong" | "moderate" | "weak",
    "summary": ""
  }

  Rules:
  - matchedSkills and missingSkills must be specific (e.g. "C# .NET" not just "backend")
  - emphasisPoints must be actionable (e.g. "highlight Oracle-to-PostgreSQL migration experience")
  - overallFit: strong = 80%+ requirements met, moderate = 50-79%, weak = below 50%
  - summary must be 2-3 sentences, honest not promotional
  - Output raw JSON only. Any text outside the JSON will break the pipeline.`;

    const parsed: GapAnalysis = await this.llm.generateJSON<GapAnalysis>(prompt);
    const content = JSON.stringify(parsed, null, 2);

    const filePath = this.writeOutput(fileName, content, outputDir);

    return {
      agentName: this.agentName,
      outputFile: filePath,
      success: true
    };
  }
}
