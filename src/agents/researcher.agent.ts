import { BaseAgent } from './base-agent';
import { LLMClient } from '../clients/LLMClient';
import { ApplicationContext, AgentOutput } from '../core/types';

export class ResearcherAgent extends BaseAgent {
  constructor(llm: LLMClient) {
    super("Researcher", llm);
  }

  async execute(context: ApplicationContext): Promise<AgentOutput<string>> {
    try {
      const prompt = `You are a job application researcher. Analyze 
the following job description and extract structured intelligence.

Company: ${context.company}
Role: ${context.role}

Job Description:
${context.jobDescription}

Write a company brief in Markdown with exactly these sections:

## Company Overview
2-3 sentences about what the company does, their market, and scale.
Extract only from the job description — do not invent facts.

## Role Summary
What this role actually does day-to-day based on the posting.
Be specific.

## Tech Stack signals
List every technology, framework, language, or tool mentioned.
Include implicit ones.

## Culture & Process signals
What does the posting reveal about how the team works?

## Key Requirements
The 5 most important requirements ranked by how prominently
they appear in the posting.

## Red flags / gaps to watch
Any requirements that seem non-negotiable but unusual. Be honest.

Output only the Markdown. No preamble, no commentary.`;

      const content = await this.llm.generateText(prompt);

      return {
        agentName: this.agentName,
        success: true,
        data: content
      };
    } catch (error: any) {
      return {
        agentName: this.agentName,
        success: false,
        data: '',
        error: error?.message || 'Unknown error'
      };
    }
  }
}
