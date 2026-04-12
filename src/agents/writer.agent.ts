import { BaseAgent } from './base-agent';
import { FileSystemManager } from '../core/fs-manager';
import { ClaudeClient } from '../core/claude-client';
import { ApplicationContext, AgentOutput } from '../core/types';

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

    const cvContent = `# Tailored CV (MOCK)\n\nName: Candidate\nRole: ${context.role}\nCompany: ${context.company}\n\nSummary: Tailored for ${context.company}'s requirements.`;
    const clContent = `# Cover Letter (MOCK)\n\nDear Hiring Manager at ${context.company},\n\nI am excited to apply for the ${context.role} position.`;

    const cvPath = this.writeOutput(cvFileName, cvContent, outputDir);
    const clPath = this.writeOutput(clFileName, clContent, outputDir);

    return {
      agentName: this.agentName,
      outputFile: cvPath, // Returning CV as primary output, but both are created
      success: true
    };
  }
}
