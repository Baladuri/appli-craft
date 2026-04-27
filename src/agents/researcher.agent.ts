import { BaseAgent } from './base-agent';
import { LLMClient } from '../clients/LLMClient';
import { ApplicationContext, AgentOutput } from '../core/types';

export interface ResearcherOutput {
  company: string;
  role: string;
  brief: string;
}

export class ResearcherAgent extends BaseAgent {
  constructor(llm: LLMClient) {
    super("Researcher", llm);
  }

  async execute(context: ApplicationContext): Promise<AgentOutput<ResearcherOutput>> {
    try {
      // Step 1 — Extract company and role as structured data
      const metaPrompt = `You are a job description parser.

Extract the company name and job title from this job description.

Job Description:
${context.jobDescription}

Rules:
- "company": the name of the hiring company only, no extra words
- "role": the exact job title only, no extra words
- If you cannot determine either with confidence use "Unknown"
- Do not include punctuation or special characters

Respond ONLY with valid JSON:
{
  "company": "string",
  "role": "string"
}`;

      const meta = await this.llm.generateJSON<{ 
        company: string; 
        role: string 
      }>(metaPrompt);

      const company = meta.company || 'Unknown';
      const role = meta.role || 'Unknown';

      // Step 2 — Generate company brief
      const briefPrompt = `You are a job application researcher.

Company: ${company}
Role: ${role}

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

      const brief = await this.llm.generateText(briefPrompt);

      return {
        agentName: this.agentName,
        success: true,
        data: { company, role, brief }
      };
    } catch (error: any) {
      return {
        agentName: this.agentName,
        success: false,
        data: { company: 'Unknown', role: 'Unknown', brief: '' },
        error: error?.message || 'Unknown error'
      };
    }
  }
}
