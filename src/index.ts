import { config, validateConfig } from './config/index';
import { ApplicationContext, OrchestratorConfig } from './core/types';
import { FileSystemManager } from './core/fs-manager';
import { ClaudeClient } from './core/claude-client';
import { GitHubClient } from './core/github-client';
import { ResearcherAgent } from './agents/researcher.agent';
import { AnalystAgent } from './agents/analyst.agent';
import { WriterAgent } from './agents/writer.agent';
import { InterviewerAgent } from './agents/interviewer.agent';
import { calculateJobScore } from './core/scoring';
import * as path from 'path';
import * as fs from 'fs';
import matter from 'gray-matter';

// ─── Scoring Helpers ────────────────────────────────────────────────────────
function normalize(skill: string): string {
  return skill.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// ─── Logging Helpers ────────────────────────────────────────────────────────

function logStep(agentName: string, outputFile: string, success: boolean): void {
  const status = success ? '✅' : '❌';
  const shortPath = path.relative(process.cwd(), outputFile);
  console.log(`  ${status} [${agentName}] completed → ${shortPath}`);
}

function logError(agentName: string, stage: string, message: string): never {
  const errMsg = `[PIPELINE ERROR] Stage: ${stage} | Agent: ${agentName} | ${message}`;
  console.error(`\n  ❌ ${errMsg}\n`);
  throw new Error(errMsg);
}

// ─── Orchestrator ────────────────────────────────────────────────────────────

/**
 * Main orchestration function. Runs the full AppliCraft agent pipeline sequentially:
 * Researcher → Analyst → Writer → Interviewer
 *
 * All inter-agent communication is strictly file-based — no in-memory state
 * is shared between agents after each step.
 *
 * @param orchConfig - Configuration containing job description, company, and role
 */
export async function runApplication(orchConfig: OrchestratorConfig): Promise<void> {
  console.log('\n🚀 Starting AppliCraft Pipeline...');
  console.log(`   Company : ${orchConfig.company}`);
  console.log(`   Role    : ${orchConfig.role}`);
  console.log('');

  // ── Step 1: Validate Configuration ────────────────────────────────────────
  validateConfig();
  console.log('🔧 Configuration validated.');

  // ── Step 2: Initialize Core Services ──────────────────────────────────────
  const fsManager = new FileSystemManager(config.outputBaseDir);
  const llmClient = new ClaudeClient();
  const githubClient = new GitHubClient();

  console.log(`🤖 Services initialized (Mock Mode: ${config.mockMode})`);

  // ── Step 3: Create Application Run Folder ─────────────────────────────────
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  // createApplicationFolder builds: <outputBaseDir>/applications/<company-role-date>/
  // We pass path.dirname(config.outputBaseDir) to avoid double-nesting since
  // config.outputBaseDir already IS the "applications" base directory.
  const outputDir = fsManager.createApplicationFolder(
    path.dirname(config.outputBaseDir),
    orchConfig.company,
    orchConfig.role,
    date
  );

  console.log(`📂 Output directory: ${path.relative(process.cwd(), outputDir)}\n`);

  // ── Step 4: Build ApplicationContext ──────────────────────────────────────
  const context: ApplicationContext = {
    company: orchConfig.company,
    role: orchConfig.role,
    date,
    jobDescription: orchConfig.jobDescription,
    outputDir,
    baseCvPath: orchConfig.baseCvPath,
  };

  // ── Step 5: Instantiate All Agents ────────────────────────────────────────
  const researcher = new ResearcherAgent(fsManager, llmClient);
  const analyst = new AnalystAgent(fsManager, llmClient);
  const writer = new WriterAgent(fsManager, llmClient);
  const interviewer = new InterviewerAgent(fsManager, llmClient);

  console.log('🔗 Running pipeline...\n');

  // ── Step 6: Sequential Pipeline Execution ─────────────────────────────────

  // Stage 1 — Researcher
  let researchResult;
  try {
    researchResult = await researcher.execute(context, outputDir);
    if (!researchResult.success) {
      logError(researchResult.agentName, 'Research', researchResult.error || 'Unknown error');
    }
    logStep(researchResult.agentName, researchResult.outputFile, researchResult.success);
  } catch (err: any) {
    logError('Researcher', 'Research', err.message);
  }

  // Integrity check: ensure company-brief.md was produced before proceeding
  const companyBriefPath = path.join(outputDir, 'company-brief.md');
  if (!fsManager.fileExists(companyBriefPath)) {
    logError('Researcher', 'Research', 'company-brief.md was not produced.');
  }

  // Stage 2 — Analyst
  let analystResult;
  try {
    analystResult = await analyst.execute(context, outputDir);
    if (!analystResult.success) {
      logError(analystResult.agentName, 'Analysis', analystResult.error || 'Unknown error');
    }
    logStep(analystResult.agentName, analystResult.outputFile, analystResult.success);

    // ── Layer 2: Gap Engine — Hybrid Matching ─────────────────────────────────
    const gapAnalysisPath = analystResult.outputFile;
    if (fs.existsSync(gapAnalysisPath)) {
      const gapData = JSON.parse(fs.readFileSync(gapAnalysisPath, 'utf-8'));

      // Filter and deduplicate hard skills
      const hardSkills = (gapData.requiredSkills || []).filter((s: any) => s.type === 'hard');
      const uniqueHardSkills = Array.from(
        new Map(hardSkills.map((s: any) => [normalize(s.name), s])).values()
      );

      const candidateSkills = (gapData.candidateSkills || []).filter((c: any) => c.confidence >= 0.6);
      let totalMatchedScore = 0;

      console.log(`\n  🔍 Gap Engine: Matching ${uniqueHardSkills.length} hard skills...\n`);

      for (const required of uniqueHardSkills as any[]) {
        // Step A — Fast path: exact normalized match
        const exactMatch = candidateSkills.find((c: any) =>
          normalize(c.name) === normalize(required.name)
        );

        if (exactMatch) {
          totalMatchedScore += 1;
          console.log(`     ✓ ${required.name} → ${exactMatch.name} (exact, score: 1)`);
          continue;
        }

        // Step B — Semantic path: pairwise LLM comparison
        let bestMatch: { match: string; confidence: number; candidateName: string } = {
          match: "none", confidence: 0, candidateName: ""
        };

        for (const candidate of candidateSkills as any[]) {
          try {
            const semanticPrompt = `You are a semantic skill comparison system.

Compare these two skills and determine if the candidate skill satisfies the required skill.

Required skill: "${required.name}"
Candidate skill: "${candidate.name}"

Rules:
- "full" → the candidate skill fully satisfies the requirement (e.g. same technology, direct equivalent)
- "partial" → the candidate skill partially covers the requirement (e.g. related framework, overlapping domain)
- "none" → no meaningful relationship
- Be strict but fair. If unsure, return "none".
- DO NOT compute scores, coverage, or make application decisions.

Respond ONLY with valid JSON:
{
  "match": "full" | "partial" | "none",
  "confidence": number between 0 and 1
}`;

            const result = await llmClient.generateJSON<{ match: string; confidence: number }>(semanticPrompt);

            if (result.confidence > bestMatch.confidence && result.match !== "none") {
              bestMatch = {
                match: result.match,
                confidence: result.confidence,
                candidateName: candidate.name
              };
            }
          } catch (e) {
            // Skip failed comparisons silently
          }
        }

        // Score the best semantic match
        if (bestMatch.match === "full") {
          totalMatchedScore += 1;
          console.log(`     ≈ ${required.name} → ${bestMatch.candidateName} (semantic full, score: 1)`);
        } else if (bestMatch.match === "partial") {
          totalMatchedScore += 0.5;
          console.log(`     ~ ${required.name} → ${bestMatch.candidateName} (semantic partial, score: 0.5)`);
        } else {
          console.log(`     ✗ ${required.name} → no match (score: 0)`);
        }
      }

      const hardCoverage = uniqueHardSkills.length === 0 ? 0 : totalMatchedScore / uniqueHardSkills.length;

      // Map to applyDecision
      let applyDecision: "apply" | "maybe" | "skip";
      if (hardCoverage >= 0.8) applyDecision = "apply";
      else if (hardCoverage >= 0.5) applyDecision = "maybe";
      else applyDecision = "skip";

      // Write decision.json
      const decisionContent = {
        applyDecision,
        hardCoverage: parseFloat(hardCoverage.toFixed(2))
      };
      const decisionWritePath = path.join(outputDir, 'decision.json');
      fs.writeFileSync(decisionWritePath, JSON.stringify(decisionContent, null, 2));
      console.log(`\n  ⚖️  Decision reached: ${applyDecision} (Coverage: ${decisionContent.hardCoverage})`);

      // Calculate and write job-score.json
      const jobId = `${context.company}-${context.role}`.toLowerCase().replace(/\s+/g, '-');
      const jobScore = calculateJobScore(jobId, hardCoverage);

      const scorePath = path.join(outputDir, 'job-score.json');
      fs.writeFileSync(scorePath, JSON.stringify(jobScore, null, 2));
      console.log(`  📊 Scoring completed → ${path.relative(process.cwd(), scorePath)}`);
    }
  } catch (err: any) {
    logError('Analyst', 'Analysis', err.message);
  }

  // ── Step 6.5: Execution Control ───────────────────────────────────────────
  let skipDownstream = false;
  const decisionPath = path.join(outputDir, 'decision.json');
  if (fs.existsSync(decisionPath)) {
    const decisionData = JSON.parse(fs.readFileSync(decisionPath, 'utf-8'));
    if (decisionData.applyDecision === 'skip') {
      console.log('  ⏭  Skipping Writer & Interviewer (decision = skip)');
      skipDownstream = true;
    }
  }

  if (!skipDownstream) {
    // Stage 3 — Writer
    let writerResult;
    try {
      writerResult = await writer.execute(context, outputDir);
      if (!writerResult.success) {
        logError(writerResult.agentName, 'Writing', writerResult.error || 'Unknown error');
      }
      logStep(writerResult.agentName, writerResult.outputFile, writerResult.success);
    } catch (err: any) {
      logError('Writer', 'Writing', err.message);
    }

    // Stage 4 — Interviewer
    let interviewResult;
    try {
      interviewResult = await interviewer.execute(context, outputDir);
      if (!interviewResult.success) {
        logError(interviewResult.agentName, 'Interview Prep', interviewResult.error || 'Unknown error');
      }
      logStep(interviewResult.agentName, interviewResult.outputFile, interviewResult.success);
    } catch (err: any) {
      logError('Interviewer', 'Interview Prep', err.message);
    }
  }

  // ── Step 7: Summary ───────────────────────────────────────────────────────
  console.log('\n✨ Pipeline completed successfully!');
  console.log(`📁 All outputs saved to: ${path.relative(process.cwd(), outputDir)}\n`);

  // List all generated files for visibility
  const generatedFiles = fs.readdirSync(outputDir);
  generatedFiles.forEach(f => console.log(`   → ${f}`));
  console.log('');
}

/**
 * Executes the AppliCraft pipeline for multiple jobs sequentially.
 * 
 * @param configs - Array of OrchestratorConfig
 */
export async function runApplicationBatch(configs: OrchestratorConfig[]): Promise<void> {
  for (const config of configs) {
    console.log(`\n=== Processing ${config.company} - ${config.role} ===`);
    try {
      await runApplication(config);
    } catch (err: any) {
      console.error(`  ❌ Failed processing ${config.company}: ${err.message}`);
      // We continue to the next job in the batch even if one fails
    }
    console.log(`=== Done ===\n`);
  }
  generateJobRankings();
}

// ─── Ranking Aggregation ──────────────────────────────────────────────────────

function generateJobRankings(): void {
  const applicationsDir = config.outputBaseDir;
  if (!fs.existsSync(applicationsDir)) return;

  const map = new Map<string, { jobId: string; score: number; decision: string }>();

  const entries = fs.readdirSync(applicationsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const scorePath = path.join(applicationsDir, entry.name, 'job-score.json');
      if (fs.existsSync(scorePath)) {
        try {
          const scoreData = JSON.parse(fs.readFileSync(scorePath, 'utf-8'));
          if (scoreData.jobId && typeof scoreData.score === 'number' && scoreData.decision) {
            map.set(scoreData.jobId, {
              jobId: scoreData.jobId,
              score: scoreData.score,
              decision: scoreData.decision
            });
          }
        } catch (e) {
          // ignore parsing errors
        }
      }
    }
  }

  const rankings = Array.from(map.values());
  rankings.sort((a, b) => b.score - a.score);

  const rankingsPath = path.join(applicationsDir, 'job-rankings.json');
  fs.writeFileSync(rankingsPath, JSON.stringify(rankings, null, 2));
  console.log(`  🏆 Rankings updated → ${path.relative(process.cwd(), rankingsPath)}`);
}

// ─── CLI Entry Point ─────────────────────────────────────────────────────────

const job = matter(fs.readFileSync(config.jobDescriptionPath, 'utf-8'));
if (!job.data.company || !job.data.role) {
  throw new Error('Missing company or role in job-description frontmatter');
}
const orchConfig: OrchestratorConfig = {
  company: job.data.company,
  role: job.data.role,
  jobDescription: job.content.trim(),
  baseCvPath: config.baseCvPath,
};

runApplication(orchConfig).then(() => {
  generateJobRankings();
}).catch((err) => {
  console.error('\n💥 Fatal pipeline error:', err.message);
  process.exit(1);
});
