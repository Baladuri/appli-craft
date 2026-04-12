import { BaseAgent } from './base-agent';
import { FileSystemManager } from '../core/fs-manager';
import { ClaudeClient } from '../core/claude-client';
import { ApplicationContext, AgentOutput } from '../core/types';

/**
 * ResearcherAgent - Prototype
 * Responsibility: Researches the company and role to provide context for other agents.
 */
export class ResearcherAgent extends BaseAgent {
  constructor(fs: FileSystemManager, llm: ClaudeClient) {
    super("Researcher", fs, llm);
  }

  /**
   * Stub execution method for Researcher agent.
   * Generates a mock company brief based on the application context.
   */
  async execute(context: ApplicationContext, outputDir: string): Promise<AgentOutput> {
    const fileName = "company-brief.md";
    const content = `# MOCK COMPANY BRIEF for ${context.company}\n\n## Role: ${context.role}\n\nThis is a mock research brief generated for the role of ${context.role} at ${context.company}.`;

    const filePath = this.writeOutput(fileName, content, outputDir);

    return {
      agentName: this.agentName,
      outputFile: filePath,
      success: true
    };
  }
}
