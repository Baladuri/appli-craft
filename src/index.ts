import { config, validateConfig } from './config/index';
import { 
  ApplicationContext,
  OrchestratorConfig,
  PipelineResult,
  ApplicationDecision,
  GapAnalysis,
  ApplicationMaterials
} from './core/types';
import { LLMClient } from './clients/LLMClient';
import { ClaudeClient } from './core/claude-client';
import { ResearcherAgent, ResearcherOutput } from './agents/researcher.agent';
import { AnalystAgent } from './agents/analyst.agent';
import { WriterAgent } from './agents/writer.agent';
import { InterviewerAgent } from './agents/interviewer.agent';
import { normalize, matchSkill } from './core/matcher';
import { calculateJobScore } from './core/scoring';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import matter from 'gray-matter';


  // ─── Logging Helpers ────────────────────────────────────────────────────────

function logStep(agentName: string, success: boolean): void {
  const status = success ? '✅' : '❌';
  console.log(`  ${status} [${agentName}] completed`);
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
export async function runApplication(orchConfig: OrchestratorConfig): Promise<PipelineResult> {
  console.log('\n🚀 Starting AppliCraft Pipeline...');
  console.log(`   Processing job...`);
  console.log('');

  // ── Step 1: Validate Configuration ────────────────────────────────────────
  validateConfig();
  console.log('🔧 Configuration validated.');

  // ── Step 2: Initialize Core Services ──────────────────────────────────────
  const llmClient: LLMClient = new ClaudeClient();

  console.log(`🤖 Services initialized (Mock Mode: ${config.mockMode})`);

  // ── Step 3: Instantiate Agents ───────────────────────────────────────────
  const researcher = new ResearcherAgent(llmClient);
  const analyst = new AnalystAgent(llmClient);

  console.log('🔗 Running pipeline...\n');

  // ── Step 4: Run Stages ──────────────────────────────────────────────────

    // ── Step 6: Sequential Pipeline Execution ─────────────────────────────────

  // Stage 1 — Researcher
  let researcherResult;
  try {
    // Note: We use raw orchConfig values for the initial context
    const initialContext: ApplicationContext = {
      company: orchConfig.company,
      role: orchConfig.role,
      date: new Date().toISOString().split('T')[0],
      jobDescription: orchConfig.jobDescription,
      baseCv: orchConfig.baseCv,
    };

    researcherResult = await researcher.execute(initialContext);
    if (!researcherResult.success) {
      logError(researcherResult.agentName, 'Research', researcherResult.error || 'Unknown error');
    }
    logStep(researcherResult.agentName, researcherResult.success);
  } catch (err: any) {
    logError('Researcher', 'Research', err.message);
  }
  
  const researcherData: ResearcherOutput = researcherResult!.data;
  const companyBrief = researcherData.brief;
  const extractedCompany = researcherData.company;
  const extractedRole = researcherData.role;

  console.log(`  🏢 Company: ${extractedCompany}`);
  console.log(`  💼 Role: ${extractedRole}`);

  // ── Step 5: Setup Output Directory & Final Context ────────────────────────
  const sanitize = (s: string) => s.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);

  const date = new Date().toISOString().split('T')[0];
  const outputDir = path.join(
    config.outputBaseDir,
    `${sanitize(extractedCompany)}-${sanitize(extractedRole)}-${date}`
  );

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`  📂 Rankings directory: ${path.relative(process.cwd(), outputDir)}`);

  const context: ApplicationContext = {
    company: extractedCompany,
    role: extractedRole,
    date,
    jobDescription: orchConfig.jobDescription,
    baseCv: orchConfig.baseCv,
  };

  // Stage 2 — Analyst
  let analystResult;
  try {
    analystResult = await analyst.execute(context);
    if (!analystResult.success) {
      logError(analystResult.agentName, 'Analysis', analystResult.error || 'Unknown error');
    }
    logStep(analystResult.agentName, analystResult.success);
  } catch (err: any) {
    logError('Analyst', 'Analysis', err.message);
  }
  const gapAnalysis = analystResult!.data;

    // ── Layer 2: Gap Engine — Hybrid Matching ─────────────────────────────────
    const gapData = gapAnalysis;

        function getRequirementWeight(requirement: string): number {
          switch (requirement) {
            case 'required': return 1.0;
            case 'implicit': return 0.8;
            case 'preferred': return 0.5;
            default: return 0.8;
          }
        }

        // Filter and deduplicate hard skills
        const uniqueHardSkills = Array.from(
          new Map(
            (gapData.requiredSkills || [])
              .map((s: any) => [normalize(s.name), s])
          ).values()
        );

        const candidateSkills = gapData.candidateSkills || [];

        // Step 1 — Precompute normalized candidate skills once before the loop
        const normalizedCandidates = candidateSkills.map((c: any) => ({
          ...c,
          normalized: normalize(c.name)
        }));


        console.log(`\n  🔍 Gap Engine: Matching ${uniqueHardSkills.length} hard skills...\n`);

        // Step 3 — Run all required skills in parallel
        const matchResults: { score: number, log: string }[] = [];
        for (const required of uniqueHardSkills as any[]) {
          const result = await matchSkill(
            required,
            normalizedCandidates,
            llmClient,
            getRequirementWeight
          );
          matchResults.push(result);
        }

        const totalMatchedScore = matchResults.reduce((sum, r) => sum + r.score, 0);
        matchResults.forEach(r => console.log(r.log));

        const totalPossibleScore = uniqueHardSkills.reduce(
          (sum: number, s: any) => sum + getRequirementWeight(s.requirement),
          0
        );
        const hardCoverage = totalPossibleScore === 0
          ? 0
          : totalMatchedScore / totalPossibleScore;

        // Map to applyDecision
        let applyDecision: "apply" | "maybe" | "skip";
        if (hardCoverage >= 0.8) applyDecision = "apply";
        else if (hardCoverage >= 0.5) applyDecision = "maybe";
        else applyDecision = "skip";

        // Write decision.json
        const rankingDecision = {
          applyDecision,
          hardCoverage: parseFloat(hardCoverage.toFixed(2))
        };
        const decisionWritePath = path.join(outputDir, 'decision.json');
        fs.writeFileSync(decisionWritePath, JSON.stringify(rankingDecision, null, 2));
        console.log(`\n  ⚖️  Decision reached: ${applyDecision} (Coverage: ${rankingDecision.hardCoverage})`);

        // Calculate and write job-score.json
        const jobId = crypto
          .createHash('md5')
          .update(orchConfig.jobDescription)
          .digest('hex')
          .substring(0, 12);

        const jobScore = calculateJobScore(
          jobId,
          extractedCompany,
          extractedRole,
          hardCoverage
        );

        const scorePath = path.join(outputDir, 'job-score.json');
        fs.writeFileSync(scorePath, JSON.stringify(jobScore, null, 2));
        console.log(`  📊 Scoring completed → ${path.relative(process.cwd(), scorePath)}`);

  // ── Step 7: Final Result ──────────────────────────────────────────────────
  const decisionContent: ApplicationDecision = {
    applyDecision,
    hardCoverage: parseFloat(hardCoverage.toFixed(2))
  };

  if (decisionContent.applyDecision === 'skip') {
    console.log('  ⏭  Decision is skip — materials generation skipped');
    return {
      decision: decisionContent,
      gapAnalysis,
      companyBrief,
      summary: '',
      company: extractedCompany,
      role: extractedRole
    };
  }

  return {
    decision: decisionContent,
    gapAnalysis,
    companyBrief,
    summary: '',
    company: extractedCompany,
    role: extractedRole
  };
}

export async function runMaterials(
  orchConfig: OrchestratorConfig,
  companyBrief: string,
  gapAnalysis: GapAnalysis
): Promise<ApplicationMaterials> {
  const llmClient: LLMClient = new ClaudeClient();
  const writer = new WriterAgent(llmClient);
  const interviewer = new InterviewerAgent(llmClient);

  const context: ApplicationContext = {
    company: orchConfig.company,
    role: orchConfig.role,
    date: new Date().toISOString().split('T')[0],
    jobDescription: orchConfig.jobDescription,
    baseCv: orchConfig.baseCv
  };

  console.log('📝 Generating tailored materials...');

  const writerResult = await writer.execute(context, companyBrief, gapAnalysis);
  if (!writerResult.success) {
    throw new Error(`Writer failed: ${writerResult.error}`);
  }
  logStep(writerResult.agentName, writerResult.success);

  const { tailoredCv, coverLetter } = writerResult.data;

  const interviewerResult = await interviewer.execute(
    context,
    companyBrief,
    gapAnalysis,
    tailoredCv,
    coverLetter
  );
  if (!interviewerResult.success) {
    throw new Error(`Interviewer failed: ${interviewerResult.error}`);
  }
  logStep(interviewerResult.agentName, interviewerResult.success);

  return {
    tailoredCv,
    coverLetter,
    interviewPrep: interviewerResult.data
  };
}

  /**
   * Executes the AppliCraft pipeline for multiple jobs sequentially.
   * 
   * @param configs - Array of OrchestratorConfig
   */
export async function runApplicationBatch(
  configs: OrchestratorConfig[]
): Promise<PipelineResult[]> {
  const results: PipelineResult[] = [];

  for (const config of configs) {
    console.log(`\n=== Processing job ${results.length + 1} of ${configs.length} ===`);
    try {
      const result = await runApplication(config);
      results.push(result);
    } catch (err: any) {
      console.error(`  ❌ Failed: ${err.message}`);
      // Push a failed result placeholder so indices stay aligned
        results.push({
          decision: { applyDecision: 'skip', hardCoverage: 0 },
          gapAnalysis: { requiredSkills: [], candidateSkills: [] },
          companyBrief: '',
          summary: '',
          company: '',
          role: ''
        });
    }
    console.log(`=== Done ===\n`);
  }

  generateJobRankings();
  return results;
}

  // ─── Ranking Aggregation ──────────────────────────────────────────────────────

  function generateJobRankings(): void {
    const applicationsDir = config.outputBaseDir;
    if (!fs.existsSync(applicationsDir)) return;

    const map = new Map<string, { jobId: string; company: string; role: string; score: number; decision: string }>();

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
                company: scoreData.company || 'Unknown',
                role: scoreData.role || 'Unknown',
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

  if (require.main === module) {
  const job = matter(fs.readFileSync(config.jobDescriptionPath, 'utf-8'));
  if (!job.data.company || !job.data.role) {
    throw new Error('Missing company or role in job-description frontmatter');
  }

  const cvContent = fs.readFileSync(config.baseCvPath, 'utf-8');

  const orchConfig: OrchestratorConfig = {
    company: job.data.company,
    role: job.data.role,
    jobDescription: job.content.trim(),
    baseCv: cvContent,
  };

  runApplication(orchConfig).then(() => {
    generateJobRankings();
  }).catch((err) => {
    console.error('\n💥 Fatal pipeline error:', err.message);
    process.exit(1);
  });
}
