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
    const prompt = `
    You are a job application researcher. Analyze the following job description and extract structured intelligence.
    Company: ${context.company}
    Role: ${context.role}

    Job Description:
    ${context.jobDescription}

    Write a company brief in Markdown with exactly these sections:

    ## Company Overview
    2-3 sentences about what the company does, their market, and scale. Extract only from the job description — do not invent facts.

    ## Role Summary
    What this role actually does day-to-day based on the posting. Be specific.

    ## Tech Stack signals
    List every technology, framework, language, or tool mentioned. Include implicit ones (e.g. if they mention "bi-weekly releases" and "Azure" infer CI/CD matters).

    ## Culture & Process signals
    What does the posting reveal about how the team works? (agile, flat hierarchy, startup vs enterprise, remote policy etc.)

    ## Key Requirements
    The 5 most important requirements ranked by how prominently they appear in the posting.

    ## Red flags / gaps to watch
    Any requirements that seem non-negotiable but unusual. Be honest.

    Output only the Markdown. No preamble, no commentary.`

    const content = await this.llm.generateText(prompt);
    const fileName = "company-brief.md";
    const filePath = this.writeOutput(fileName, content, outputDir);

    return {
      agentName: this.agentName,
      outputFile: filePath,
      success: true
    };
  }
}
