import { BaseAgent } from './base-agent';
import { FileSystemManager } from '../core/fs-manager';
import { ClaudeClient } from '../core/claude-client';
import { ApplicationContext, AgentOutput, GapAnalysis } from '../core/types';

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
    
    const mockAnalysis: GapAnalysis = {
      matchedSkills: ["TypeScript", "Node.js"],
      missingSkills: ["AWS Lambda", "PostgreSQL"],
      emphasisPoints: ["Focus on scalable architecture and async patterns"],
      overallFit: "moderate",
      summary: "MOCK GAP ANALYSIS: The candidate has strong core skills but lacks specific cloud and DB experience listed in the JD."
    };

    const content = JSON.stringify(mockAnalysis, null, 2);
    const filePath = this.writeOutput(fileName, content, outputDir);

    return {
      agentName: this.agentName,
      outputFile: filePath,
      success: true
    };
  }
}
