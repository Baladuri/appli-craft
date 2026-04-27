import express from 'express';
import cors from 'cors';
import * as fs from 'fs';
import * as path from 'path';
import { runApplication, runApplicationBatch, runMaterials } from './index';
import { OrchestratorConfig, GapAnalysis } from './core/types';
import { ClaudeClient } from './core/claude-client';

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

interface AnalysisSession {
  orchConfig: OrchestratorConfig;
  companyBrief: string;
  gapAnalysis: GapAnalysis;
}

const sessions = new Map<string, AnalysisSession>();

const PERSISTENT_CV_PATH = path.join(__dirname, '../data/candidate-cv.md');
const PERSISTENT_CV_HASH_PATH = path.join(__dirname, '../data/candidate-cv.hash');

// ─── Helpers ────────────────────────────────────────────────────────

function stripFrontmatter(text: string): string {
  const lines = text.split('\n');
  if (lines[0]?.trim() !== '---') return text;
  const closingIndex = lines.findIndex(
    (line, i) => i > 0 && line.trim() === '---'
  );
  if (closingIndex === -1) return text;
  return lines.slice(closingIndex + 1).join('\n').trim();
}

// ─── Endpoints ──────────────────────────────────────────────────────

app.post('/cv', (req, res) => {
  const { cvText } = req.body;
  
  if (!cvText) {
    return res.status(400).json({ error: 'cvText is required' });
  }

  // Ensure data directory exists
  if (!fs.existsSync(path.dirname(PERSISTENT_CV_PATH))) {
    fs.mkdirSync(path.dirname(PERSISTENT_CV_PATH), { recursive: true });
  }

  // Write CV and store hash
  const crypto = require('crypto');
  const newHash = crypto.createHash('md5').update(cvText).digest('hex');
  
  fs.writeFileSync(PERSISTENT_CV_PATH, cvText);
  fs.writeFileSync(PERSISTENT_CV_HASH_PATH, newHash);
  
  res.json({ message: 'CV saved successfully' });
});

app.get('/cv', (req, res) => {
  if (fs.existsSync(PERSISTENT_CV_PATH)) {
    const cvText = fs.readFileSync(PERSISTENT_CV_PATH, 'utf-8');
    res.json({ exists: true, cvText });
  } else {
    res.json({ exists: false });
  }
});

app.post('/analyze', async (req, res) => {
  const { jobDescription } = req.body;

  if (!jobDescription) {
    return res.status(400).json({ error: 'jobDescription is required' });
  }

  if (!fs.existsSync(PERSISTENT_CV_PATH)) {
    return res.status(400).json({
      error: 'No CV found. Please upload your CV first via POST /cv'
    });
  }

  try {
    const baseCv = fs.readFileSync(PERSISTENT_CV_PATH, 'utf-8');
    const cleanJD = stripFrontmatter(jobDescription);

    const orchConfig: OrchestratorConfig = {
      company: '',
      role: '',
      jobDescription: cleanJD,
      baseCv
    };

    const result = await runApplication(orchConfig);

    // Generate paragraph summary
    const llmClient = new ClaudeClient();
    const summaryPrompt = `You are a career advisor giving honest direct advice.

Based on this job fit analysis write a 3-4 sentence paragraph
telling the candidate whether to apply and exactly why.

Decision: ${result.decision.applyDecision}
Coverage score: ${result.decision.hardCoverage}

Required skills:
${JSON.stringify(result.gapAnalysis.requiredSkills, null, 2)}

Rules:
- Be direct and specific, name actual skills
- Start with the strongest point in their favour
- Name the specific gap if there is one
- End with a clear recommendation and one specific action
- Do not use bullet points
- Do not mention coverage scores or percentages
- Write as if talking to the candidate directly
- Maximum 4 sentences`;

    const summary = await llmClient.generateText(summaryPrompt);

    // Store session for on-demand material generation
    const sessionId = `session-${Date.now()}`;

    sessions.set(sessionId, {
      orchConfig,
      companyBrief: result.companyBrief,
      gapAnalysis: result.gapAnalysis
    });

    res.json({
      sessionId,
      summary,
      decision: result.decision.applyDecision,
      coverage: result.decision.hardCoverage,
      gapAnalysis: result.gapAnalysis
    });
  } catch (error: any) {
    console.error('Analysis failed:', error);
    res.status(500).json({ error: 'Analysis failed: ' + error.message });
  }
});

app.post('/generate-materials', async (req, res) => {
  const { sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId is required' });
  }

  const session = sessions.get(sessionId);
  if (!session) {
    return res.status(404).json({
      error: 'Session not found. Please re-run analysis first.'
    });
  }

  try {
    const materials = await runMaterials(
      session.orchConfig,
      session.companyBrief,
      session.gapAnalysis
    );

    res.json({
      tailoredCv: materials.tailoredCv,
      coverLetter: materials.coverLetter,
      interviewPrep: materials.interviewPrep
    });
  } catch (error: any) {
    console.error('Material generation failed:', error);
    res.status(500).json({
      error: 'Material generation failed: ' + error.message
    });
  }
});

app.post('/analyze/batch', async (req, res) => {
  const { jobs } = req.body;

  if (!jobs || !Array.isArray(jobs) || jobs.length === 0) {
    return res.status(400).json({ error: 'jobs array is required' });
  }

  if (!fs.existsSync(PERSISTENT_CV_PATH)) {
    return res.status(400).json({
      error: 'No CV found. Please upload your CV first via POST /cv'
    });
  }

  if (jobs.length > 10) {
    return res.status(400).json({
      error: 'Maximum 10 jobs per batch'
    });
  }

  try {
    const baseCv = fs.readFileSync(PERSISTENT_CV_PATH, 'utf-8');

    const configs: OrchestratorConfig[] = jobs.map((job: any) => ({
      company: '',
      role: '',
      jobDescription: stripFrontmatter(job.jobDescription),
      baseCv
    }));

    const pipelineResults = await runApplicationBatch(configs);

    // Generate summary and session per job
    const llmClient = new ClaudeClient();

    const enrichedJobs = await Promise.all(
      pipelineResults.map(async (result, index) => {
        const sessionId = `session-${Date.now()}-${index}`;

        const orchConfig = configs[index];

        sessions.set(sessionId, {
          orchConfig,
          companyBrief: result.companyBrief,
          gapAnalysis: result.gapAnalysis
        });

        // Generate summary paragraph
        const summaryPrompt = `You are a career advisor giving honest direct advice.

Based on this job fit analysis write a 3-4 sentence paragraph
telling the candidate whether to apply and exactly why.

Decision: ${result.decision.applyDecision}
Coverage score: ${result.decision.hardCoverage}

Required skills:
${JSON.stringify(result.gapAnalysis.requiredSkills, null, 2)}

Rules:
- Be direct and specific, name actual skills
- Start with the strongest point in their favour
- Name the specific gap if there is one
- End with a clear recommendation and one specific action
- Do not use bullet points
- Do not mention coverage scores or percentages
- Write as if talking to the candidate directly
- Maximum 4 sentences`;

        const summary = await llmClient.generateText(summaryPrompt);

        return {
          sessionId,
          company: result.company,
          role: result.role,
          decision: result.decision.applyDecision,
          coverage: result.decision.hardCoverage,
          gapAnalysis: result.gapAnalysis,
          summary
        };
      })
    );

    // Read rankings file
    const rankingsPath = path.join(
      __dirname,
      '../applications/job-rankings.json'
    );

    const rankings = fs.existsSync(rankingsPath)
      ? JSON.parse(fs.readFileSync(rankingsPath, 'utf-8'))
      : [];

    res.json({
      rankings,
      jobs: enrichedJobs
    });

  } catch (error: any) {
    console.error('Batch analysis failed:', error);
    res.status(500).json({
      error: 'Batch analysis failed: ' + error.message
    });
  }
});

app.listen(port, () => {
  console.log(`🚀 Backend server running at http://localhost:${port}`);
});
