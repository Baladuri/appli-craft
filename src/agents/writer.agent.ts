import { BaseAgent } from './base-agent';
import { LLMClient } from '../clients/LLMClient';
import { ApplicationContext, AgentOutput, GapAnalysis } from '../core/types';

export class WriterAgent extends BaseAgent {
  constructor(llm: LLMClient) {
    super("Writer", llm);
  }

  async execute(
    context: ApplicationContext,
    companyBrief: string,
    gapAnalysis: GapAnalysis
  ): Promise<AgentOutput<{ tailoredCv: string; coverLetter: string }>> {
    try {
      const gapAnalysisRaw = JSON.stringify(gapAnalysis, null, 2);

      const cvPrompt = `You are an expert CV writer for the role of ${context.role}.

Original CV:
${context.baseCv}

Company Brief:
${companyBrief}

Gap Analysis:
${gapAnalysisRaw}

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

      const tailoredCv = await this.llm.generateText(cvPrompt);

      const clPrompt = `You are an expert cover letter writer for the role of ${context.role}.

Candidate CV:
${context.baseCv}

Company Brief:
${companyBrief}

Gap Analysis:
${gapAnalysisRaw}

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

      const coverLetter = await this.llm.generateText(clPrompt);

      return {
        agentName: this.agentName,
        success: true,
        data: { tailoredCv, coverLetter }
      };
    } catch (error: any) {
      return {
        agentName: this.agentName,
        success: false,
        data: { tailoredCv: '', coverLetter: '' },
        error: error?.message || 'Unknown error'
      };
    }
  }
}
