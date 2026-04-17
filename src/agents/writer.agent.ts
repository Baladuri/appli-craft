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
    try {
      const cvFileName = "cv-tailored.md";
      const clFileName = "cover-letter.md";

      const companyBrief = this.fs.readFile(path.join(outputDir, "company-brief.md"));
      const gapAnalysisRaw = this.fs.readFile(path.join(outputDir, "gap-analysis.json"));
      const gapData = JSON.parse(gapAnalysisRaw);
      const applyDecision = gapData.applyDecision || "maybe";
      const baseCv = this.fs.readFile(context.baseCvPath);

      const cvPrompt = `You are an expert CV writer for the role of ${context.role}.

    Original CV:
    ${baseCv}

    Company Brief:
    ${companyBrief}

    Gap Analysis:
    ${gapAnalysisRaw}

    ---

    IMPORTANT:
    Apply Decision: "${applyDecision}"

    ---

    Rewrite the CV tailored for this role.

    Rules:

    GENERAL RULES:
    - Keep all real experience and dates — never fabricate anything
    - Do NOT invent technologies or responsibilities
    - Reorder and emphasize relevant experience
    - Keep structure identical to original CV

    IF applyDecision = "apply":
    - Strongly tailor CV toward job match
    - Emphasize relevant skills and alignment

    IF applyDecision = "maybe":
    - Balanced CV
    - Highlight transferable skills
    - Avoid over-claiming missing stack

    IF applyDecision = "skip":
    - Minimal tailoring only
    - Do NOT aggressively position candidate as strong fit
    - Keep factual and neutral tone

    CONTENT RULES:
    - Use emphasisPoints from gap analysis
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

    IMPORTANT:
    Apply Decision: "${applyDecision}"

    ---

    Write a professional cover letter.

    Rules:

    IF applyDecision = "apply":
    - Confident tone
    - Strong alignment framing
    - Direct and targeted

    IF applyDecision = "maybe":
    - Balanced tone
    - Honest about gaps
    - Emphasize learning + transferability

    IF applyDecision = "skip":
    - Short letter (max 2–3 paragraphs)
    - Honest about mismatch
    - No attempt to over-sell

    GENERAL RULES:
    - Max 4 paragraphs
    - No clichés ("I am excited", "I am passionate")
    - Must reference real company details
    - Must use emphasisPoints naturally
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
