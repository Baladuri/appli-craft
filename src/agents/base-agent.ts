import { LLMClient } from '../clients/LLMClient';
import { ApplicationContext, AgentOutput } from '../core/types';

export abstract class BaseAgent {
  public agentName: string;
  protected llm: LLMClient;

  constructor(agentName: string, llm: LLMClient) {
    this.agentName = agentName;
    this.llm = llm;
  }

  abstract execute(context: ApplicationContext, ...args: any[]): 
    Promise<AgentOutput<any>>;
}
