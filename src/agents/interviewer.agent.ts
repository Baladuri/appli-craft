import { BaseAgent } from './base-agent';
import { FileSystemManager } from '../core/fs-manager';
import { ClaudeClient } from '../core/claude-client';
import { ApplicationContext, AgentOutput } from '../core/types';

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
    const fileName = "interview-prep.md";
    const content = `# Interview Prep (MOCK) for ${context.role}\n\n1. Tell me about yourself and your experience with ${context.role}.\n2. Why are you interested in joining ${context.company}?\n3. Describe a technical challenge you solved using TypeScript.\n4. How do you handle feedback during code reviews?`;

    const filePath = this.writeOutput(fileName, content, outputDir);

    return {
      agentName: this.agentName,
      outputFile: filePath,
      success: true
    };
  }
}
