import express from 'express';
import cors from 'cors';
import * as fs from 'fs';
import * as path from 'path';
import { runApplication, runApplicationBatch } from './index';
import { OrchestratorConfig } from './core/types';
import { ClaudeClient } from './core/claude-client';

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

const PERSISTENT_CV_PATH = path.join(__dirname, '../data/candidate-cv.md');
const PERSISTENT_CV_HASH_PATH = path.join(__dirname, '../data/candidate-cv.hash');

// ─── Helpers ────────────────────────────────────────────────────────

function extractCompanyFromJD(jd: string): string {
  const lines = jd.split('\n').filter(l => l.trim().length > 0);
  return lines[0]?.trim().substring(0, 50) || 'Unknown-Company';
}

function extractRoleFromJD(jd: string): string {
  const lines = jd.split('\n').filter(l => l.trim().length > 0);
  return lines[1]?.trim().substring(0, 50) || 'Unknown-Role';
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
    return res.status(400).json({ error: 'No CV found. Please upload your CV first via POST /cv' });
  }

  try {
    const company = req.body.company || extractCompanyFromJD(jobDescription);
    const role = req.body.role || extractRoleFromJD(jobDescription);

    const orchConfig: OrchestratorConfig = {
      company,
      role,
      jobDescription: jobDescription,
      baseCvPath: PERSISTENT_CV_PATH
    };

    const outputDir = await runApplication(orchConfig);

    const gapAnalysisPath = path.join(outputDir, 'gap-analysis.json');
    const jobScorePath = path.join(outputDir, 'job-score.json');
    const decisionPath = path.join(outputDir, 'decision.json');

    const gapAnalysis = JSON.parse(fs.readFileSync(gapAnalysisPath, 'utf-8'));
    const jobScore = JSON.parse(fs.readFileSync(jobScorePath, 'utf-8'));
    const decisionData = JSON.parse(fs.readFileSync(decisionPath, 'utf-8'));

    // Generate paragraph summary
    const llmClient = new ClaudeClient();
    const summaryPrompt = `You are a career advisor giving honest, direct advice.

Based on this job fit analysis, write a 3-4 sentence paragraph 
telling the candidate whether to apply and exactly why.

Decision: ${decisionData.applyDecision}
Coverage score: ${decisionData.hardCoverage}

Required skills and match results:
${JSON.stringify(gapAnalysis.requiredSkills, null, 2)}

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

    res.json({ 
      summary,
      decision: decisionData.applyDecision,
      coverage: decisionData.hardCoverage,
      gapAnalysis, 
      jobScore 
    });
  } catch (error: any) {
    console.error('Analysis failed:', error);
    res.status(500).json({ error: 'Analysis failed: ' + error.message });
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
    const configs: OrchestratorConfig[] = jobs.map((job: any) => ({
      company: job.company || extractCompanyFromJD(job.jobDescription),
      role: job.role || extractRoleFromJD(job.jobDescription),
      jobDescription: job.jobDescription,
      baseCvPath: PERSISTENT_CV_PATH
    }));

    await runApplicationBatch(configs);

    // Read rankings file produced by runApplicationBatch
    const rankingsPath = path.join(
      __dirname, 
      '../applications/job-rankings.json'
    );
    
    if (fs.existsSync(rankingsPath)) {
      const rankings = JSON.parse(fs.readFileSync(rankingsPath, 'utf-8'));
      res.json({ rankings });
    } else {
      res.json({ message: 'Batch completed. No rankings file found.' });
    }
  } catch (error: any) {
    console.error('Batch analysis failed:', error);
    res.status(500).json({ error: 'Batch analysis failed: ' + error.message });
  }
});

app.listen(port, () => {
  console.log(`🚀 Backend server running at http://localhost:${port}`);
});
