import { BaseAgent } from './base-agent';
import { FileSystemManager } from '../core/fs-manager';
import { ClaudeClient } from '../core/claude-client';
import { ApplicationContext, AgentOutput } from '../core/types';
import * as path from 'path';

/**
 * WriterAgent - Prototype
 * Responsibility: Generates tailored CVs and cover letters based on analysis.
 */
export class WriterAgent extends BaseAgent {
  constructor(fs: FileSystemManager, llm: ClaudeClient) {
    super("Writer", fs, llm);
  }

  /**
   * Stub execution method for Writer agent.
   * Generates mock tailored CV and cover letter files.
   */
  async execute(context: ApplicationContext, outputDir: string): Promise<AgentOutput> {
    const cvFileName = "cv-tailored.md";
    const clFileName = "cover-letter.md";

    const companyBrief = this.fs.readFile(path.join(outputDir, "company-brief.md"));
    const gapAnalysis = this.fs.readFile(path.join(outputDir, "gap-analysis.json"));
    const baseCv = this.fs.readFile(context.baseCvPath);

    const cvPrompt = `You are an expert CV writer specializing in the tech job market.

  Original CV:
  ${baseCv}

  Company Brief:
  ${companyBrief}

  Gap Analysis:
  ${gapAnalysis}

  Rewrite the CV tailored for this specific role. Rules:
  - Keep all real experience and dates — never fabricate anything
  - Reorder bullet points so the most relevant experience appears first
  - Adjust the profile/summary section to directly address this role
  - Use the emphasisPoints from the gap analysis to decide what to highlight
  - Keep the same sections as the original CV
  - Be factual, precise, no fluff
  - Output clean Markdown only. No commentary.`;

    const cvContent = await this.llm.generateText(cvPrompt);
    const cvPath = this.writeOutput(cvFileName, cvContent, outputDir);

    const clPrompt = `You are an expert cover letter writer for the tech job market.

  Candidate CV:
  ${baseCv}

  Company Brief:
  ${companyBrief}

  Gap Analysis:
  ${gapAnalysis}

  Write a professional cover letter in English. Rules:
  - Max 4 paragraphs: hook, relevant experience, why this company specifically, close
  - Opening must NOT start with "I am excited" or "I am writing to apply"
  - Reference specific details from the company brief to show research
  - Address the emphasisPoints naturally — do not list them
  - Tone: confident, direct, professional — not American-hype
  - End with a concrete call to action
  - Output the letter only. No subject line, no commentary.`;

    const clContent = await this.llm.generateText(clPrompt);
    const clPath = this.writeOutput(clFileName, clContent, outputDir);

    return {
      agentName: this.agentName,
      outputFile: cvPath,
      success: true
    };
  }
}
