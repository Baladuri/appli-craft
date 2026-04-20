import { BaseAgent } from './base-agent';
import { FileSystemManager } from '../core/fs-manager';
import { ClaudeClient } from '../core/claude-client';
import { ApplicationContext, AgentOutput } from '../core/types';
import * as path from 'path';

/**
 * InterviewerAgent - Prototype
 * Responsibility: Generates interview preparation questions based on the application context.
 */
export class InterviewerAgent extends BaseAgent {
  constructor(fs: FileSystemManager, llm: ClaudeClient) {
    super("Interviewer", fs, llm);
  }

  /**
   * Stub execution method for Interviewer agent.
   * Generates mock interview prep questions.
   */
  async execute(context: ApplicationContext, outputDir: string): Promise<AgentOutput> {
    try {
      const fileName = "interview-prep.md";

      const companyBrief = this.fs.readFile(path.join(outputDir, "company-brief.md"));
      const gapAnalysisRaw = this.fs.readFile(path.join(outputDir, "gap-analysis.json"));

      const tailoredCv = this.fs.readFile(path.join(outputDir, "cv-tailored.md"));
      const coverLetter = this.fs.readFile(path.join(outputDir, "cover-letter.md"));

      const prompt = `You are a senior technical interviewer preparing a candidate for a specific interview.

      Company Brief:
      ${companyBrief}

      Gap Analysis:
      ${gapAnalysisRaw}

      Tailored CV:
      ${tailoredCv}

      Cover Letter:
      ${coverLetter}

      ---

      Generate interview preparation in Markdown with exactly these sections:

      ## Likely Technical Questions
      5 technical questions this company will probably ask based on their stack and requirements. For each question add a "Talking point:" line with a specific answer angle using the candidate's real experience.

      ## Likely Behavioral Questions
      5 behavioral questions based on the role's leadership and process expectations. For each add a "Talking point:" referencing specific experience from the CV.

      ## Questions About CV Gaps
      3 questions the interviewer might ask about weak spots from the gap analysis. For each add a "How to handle:" with an honest strategy.

      ## Questions to Ask Them
      2 smart questions the candidate should ask that show genuine interest in this company specifically.

      Output only the Markdown. No preamble.`;

      const content = await this.llm.generateText(prompt);
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
