import { BaseAgent } from './base-agent';
import { LLMClient } from '../clients/LLMClient';
import { ApplicationContext, AgentOutput, GapAnalysis } from '../core/types';

export class InterviewerAgent extends BaseAgent {
  constructor(llm: LLMClient) {
    super("Interviewer", llm);
  }

  async execute(
    context: ApplicationContext,
    companyBrief: string,
    gapAnalysis: GapAnalysis,
    tailoredCv: string,
    coverLetter: string
  ): Promise<AgentOutput<string>> {
    try {
      const prompt = `You are a senior technical interviewer preparing
a candidate for a specific interview.

Company Brief:
${companyBrief}

Gap Analysis:
${JSON.stringify(gapAnalysis, null, 2)}

Tailored CV:
${tailoredCv}

Cover Letter:
${coverLetter}

Generate interview preparation in Markdown with exactly these sections:

## Likely Technical Questions
5 technical questions this company will probably ask based on their
stack and requirements. For each add a "Talking point:" line with a
specific answer angle using the candidate's real experience.

## Likely Behavioral Questions
5 behavioral questions based on the role's leadership and process
expectations. For each add a "Talking point:" referencing specific
experience from the CV.

## Questions About CV Gaps
3 questions the interviewer might ask about weak spots from the gap
analysis. For each add a "How to handle:" with an honest strategy.

## Questions to Ask Them
2 smart questions the candidate should ask that show genuine interest
in this company specifically.

Output only the Markdown. No preamble.`;

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
