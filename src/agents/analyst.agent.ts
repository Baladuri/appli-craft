import { BaseAgent } from './base-agent';
import { FileSystemManager } from '../core/fs-manager';
import { ClaudeClient } from '../core/claude-client';
import { ApplicationContext, AgentOutput, GapAnalysis, JobSkill } from '../core/types';
import * as path from 'path';

/**
 * AnalystAgent - Prototype
 * Responsibility: Performs gap analysis between a candidate's CV and the job description.
 */
export class AnalystAgent extends BaseAgent {
  constructor(fs: FileSystemManager, llm: ClaudeClient) {
    super("Analyst", fs, llm);
  }

  /**
   * Hardened execution method for Analyst agent.
   * Extracts skills and performs deterministic classification in code.
   */
  async execute(context: ApplicationContext, outputDir: string): Promise<AgentOutput> {
    try {
      const fileName = "gap-analysis.json";
      const baseCv = this.fs.readFile(context.baseCvPath);
      const jobDescription = context.jobDescription;

      const prompt = `You are an information extraction system.

Your job is to extract technical skills from a job description and a candidate's CV as structured data.

Job Description:
${jobDescription}

Candidate CV:
${baseCv}

---

### INSTRUCTIONS FOR REQUIRED SKILLS EXTRACTION

Extract ONLY concrete technical skills, tools, frameworks, and technologies from the Job Description.

For each skill, you MUST provide:
1. "name": The canonical name of the technology.
2. "type": One of "hard" | "soft" | "implicit".
3. "evidence": The SMALLEST meaningful phrase from the text that directly contains the skill.

### EXCLUSION RULES:
- DO NOT extract abstract concepts (e.g., "Scalable systems design").
- DO NOT extract soft skills or behaviors (e.g., "Teamwork", "Communication").
- DO NOT extract responsibility-based phrases (e.g., "Agile environment").

---

### INSTRUCTIONS FOR CANDIDATE SKILLS EXTRACTION

Extract all relevant concrete technologies and tools from the CV.
Assign confidence (1.0 for explicit, 0.7 for inferred, 0.4 for weak signal).

---

Output ONLY valid JSON in this format:

{
  "requiredSkills": [
    { "name": "string", "type": "hard" | "soft" | "implicit", "evidence": "string" }
  ],
  "candidateSkills": [
    { "name": "string", "confidence": number }
  ]
}
`;

      const rawResult = await this.llm.generateJSON<any>(prompt);
      
      // Post-process to add deterministic 'requirement' level
      const requiredSkills: JobSkill[] = (rawResult.requiredSkills || []).map((raw: any) => {
        return {
          name: raw.name,
          type: raw.type,
          evidence: raw.evidence || "",
          requirement: this.classifyRequirement(raw.evidence || "")
        };
      });

      const parsed: GapAnalysis = {
        requiredSkills,
        candidateSkills: rawResult.candidateSkills || []
      };

      const content = JSON.stringify(parsed, null, 2);
      const filePath = this.writeOutput(fileName, content, outputDir);

      return {
        agentName: this.agentName,
        outputFile: filePath,
        success: true
      };
    } catch (error: any) {
      return {
        agentName: this.agentName,
        outputFile: "",
        success: false,
        error: error?.message || "Unknown error occurred"
      };
    }
  }

  /**
   * Deterministically classifies a skill's requirement level based on evidence text.
   */
  private classifyRequirement(evidence: string): "required" | "preferred" | "implicit" {
    const e = evidence.toLowerCase();
    
    // 1. REQUIRED (checked first)
    const requiredKeywords = ["must", "required", "essential", "minimum", "strong knowledge", "very good knowledge"];
    if (requiredKeywords.some(k => e.includes(k))) {
      return "required";
    }

    // 2. GOOD KNOWLEDGE (Conditional Required)
    // Classify as required UNLESS it contains preference markers
    const goodKnowledgeMarkers = ["good knowledge of", "good knowledge"];
    const preferredExclusions = ["preferred", "ideally", "nice to have", "bonus"];
    if (goodKnowledgeMarkers.some(k => e.includes(k)) && !preferredExclusions.some(k => e.includes(k))) {
      return "required";
    }

    // 3. PREFERRED (checked third)
    const preferredKeywords = ["preferred", "ideally", "nice to have", "bonus", "advantage", "plus"];
    if (preferredKeywords.some(k => e.includes(k))) {
      return "preferred";
    }

    // 3. IMPLICIT (default fallback)
    return "implicit";
  }
}
