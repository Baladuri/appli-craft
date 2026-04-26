import { BaseAgent } from './base-agent';
import { FileSystemManager } from '../core/fs-manager';
import { LLMClient } from '../clients/LLMClient';
import { ApplicationContext, AgentOutput } from '../core/types';
import * as path from 'path';

/**
 * WriterAgent - Prototype
 * Responsibility: Generates tailored CVs and cover letters based on analysis.
 */
export class WriterAgent extends BaseAgent {
  constructor(fs: FileSystemManager, llm: LLMClient) {
    super("Writer", fs, llm);
  }

  /**
   * Stub execution method for Writer agent.
   * Generates mock tailored CV and cover letter files.
   */
  async execute(context: ApplicationContext, outputDir: string): Promise<AgentOutput> {
    try {
      const cvFileName = "cv-tailored.md";
      const clFileName = "cover-letter.md";

      const companyBrief = this.fs.readFile(path.join(outputDir, "company-brief.md"));
      const gapAnalysisRaw = this.fs.readFile(path.join(outputDir, "gap-analysis.json"));

      const baseCv = this.fs.readFile(context.baseCvPath);

      const cvPrompt = `You are an expert CV writer for the role of ${context.role}.

    Original CV:
    ${baseCv}

    Company Brief:
    ${companyBrief}

    Gap Analysis:
    ${gapAnalysisRaw}

    ---

    Rewrite the CV tailored for this role.

    Rules:

    - Keep all real experience and dates — never fabricate anything
    - Do NOT invent technologies or responsibilities
    - Reorder and emphasize relevant experience
    - Keep structure identical to original CV
    - Strongly tailor CV toward job match
    - Emphasize relevant skills and alignment
    - Be precise, technical, and factual
    - No marketing language

    Output: Markdown only`;

      const cvContent = await this.llm.generateText(cvPrompt);
      const cvPath = this.writeOutput(cvFileName, cvContent, outputDir);

      const clPrompt = `You are an expert cover letter writer for the role of ${context.role}.

    Candidate CV:
    ${baseCv}

    Company Brief:
    ${companyBrief}

    Gap Analysis:
    ${gapAnalysisRaw}

    ---

    Write a professional cover letter.

    Rules:

    - Confident tone
    - Strong alignment framing
    - Direct and targeted
    - Max 4 paragraphs
    - No clichés ("I am excited", "I am passionate")
    - Must reference real company details
    - No bullet lists
    - No commentary

    Output only the letter.`;

      const clContent = await this.llm.generateText(clPrompt);
      const clPath = this.writeOutput(clFileName, clContent, outputDir);

      return {
        agentName: this.agentName,
        outputFile: cvPath,
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
