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

    // Scoring — Deterministic Layer (Orchestrator Responsibility)
    const gapAnalysisPath = analystResult.outputFile;
    if (fs.existsSync(gapAnalysisPath)) {
      const gapData = JSON.parse(fs.readFileSync(gapAnalysisPath, 'utf-8'));
      const jobId = `${context.company}-${context.role}`.toLowerCase().replace(/\s+/g, '-');
      const jobScore = calculateJobScore(gapData, jobId);
      
      const scorePath = path.join(outputDir, 'job-score.json');
      fs.writeFileSync(scorePath, JSON.stringify(jobScore, null, 2));
      console.log(`  📊 Scoring completed → ${path.relative(process.cwd(), scorePath)}`);
    }
  } catch (err: any) {
    logError('Analyst', 'Analysis', err.message);
  }

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

runApplication(orchConfig).catch((err) => {
  console.error('\n💥 Fatal pipeline error:', err.message);
  process.exit(1);
});
