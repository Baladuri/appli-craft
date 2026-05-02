import express from 'express';
import cors from 'cors';
import * as fs from 'fs';
import * as path from 'path';
import { runApplication, runApplicationBatch, runMaterials } from './index';
import { OrchestratorConfig, GapAnalysis } from './core/types';
import { ClaudeClient } from './core/claude-client';
import multer from 'multer';
import * as os from 'os';

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

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument'
        + '.wordprocessingml.document'
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and DOCX files are supported'));
    }
  }
});

const PERSISTENT_CV_PATH = path.join(__dirname, '../data/candidate-cv.md');
const PERSISTENT_CV_HASH_PATH = path.join(__dirname, '../data/candidate-cv.hash');

// ─── Portal Config ──────────────────────────────────────────────────

const PORTAL_CONFIG: Record<string, 'allowed' | 'blocked' | 'unknown'> = {
  'linkedin.com': 'blocked',
  'indeed.com': 'blocked',
  'glassdoor.com': 'blocked',
  'xing.com': 'blocked',
  'stepstone.de': 'allowed',
  'arbeitsagentur.de': 'allowed',
  'jobs.lever.co': 'allowed',
  'boards.greenhouse.io': 'allowed',
  'apply.workable.com': 'allowed',
  'jobs.ashbyhq.com': 'allowed',
};

function classifyPortal(url: string): 'allowed' | 'blocked' | 'unknown' {
  try {
    const hostname = new URL(url).hostname.replace('www.', '');
    for (const [domain, status] of Object.entries(PORTAL_CONFIG)) {
      if (hostname === domain || hostname.endsWith('.' + domain)) {
        return status;
      }
    }
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

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

async function fetchAndCleanJD(url: string): Promise<string> {
  const axios = require('axios');
  const { JSDOM } = require('jsdom');
  const { Readability } = require('@mozilla/readability');

  const response = await axios.get(url, {
    timeout: 10000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
    maxRedirects: 5,
  });

  const html = response.data;
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  if (!article || !article.textContent) {
    throw new Error('Could not extract content from page');
  }

  const cleanText = article.textContent
    .replace(/\s+/g, ' ')
    .trim();

  if (cleanText.length < 200) {
    throw new Error('Extracted content too short — page may require login or JavaScript rendering');
  }

  return cleanText;
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

app.post('/cv/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      error: 'No file provided',
      code: 'NO_FILE'
    });
  }

  try {
    let extractedText = '';
    const mimeType = req.file.mimetype;

    if (mimeType === 'application/pdf') {
      const pdfParse = require('pdf-parse');
      const pdfData = await pdfParse(req.file.buffer);
      extractedText = pdfData.text;
    } else {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({
        buffer: req.file.buffer
      });
      extractedText = result.value;
    }

    // Clean up whitespace
    extractedText = extractedText
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    // Check if extraction produced meaningful content
    if (extractedText.length < 300) {
      return res.status(422).json({
        error: 'Could not extract enough text from this file. ' +
               'It may be a scanned PDF. ' +
               'Please paste your CV text instead.',
        code: 'EXTRACTION_TOO_SHORT'
      });
    }

    // Save to persistent storage — same as POST /cv
    if (!fs.existsSync(path.dirname(PERSISTENT_CV_PATH))) {
      fs.mkdirSync(path.dirname(PERSISTENT_CV_PATH), 
        { recursive: true });
    }

    const crypto = require('crypto');
    const newHash = crypto
      .createHash('md5')
      .update(extractedText)
      .digest('hex');

    fs.writeFileSync(PERSISTENT_CV_PATH, extractedText);
    fs.writeFileSync(PERSISTENT_CV_HASH_PATH, newHash);

    res.json({
      message: 'CV uploaded and saved successfully',
      characterCount: extractedText.length
    });

  } catch (error: any) {
    console.error('CV upload failed:', error.message);

    if (error.message?.includes('Only PDF and DOCX')) {
      return res.status(400).json({
        error: 'Only PDF and DOCX files are supported',
        code: 'UNSUPPORTED_FORMAT'
      });
    }

    return res.status(500).json({
      error: 'Failed to process file. ' +
             'Please paste your CV text instead.',
      code: 'PARSE_FAILED'
    });
  }
});

app.get('/cv', (req, res) => {
  if (fs.existsSync(PERSISTENT_CV_PATH)) {
    const cvText = fs.readFileSync(PERSISTENT_CV_PATH, 'utf-8');
    res.json({ exists: true, cvText });
  } else {
    res.json({ exists: false });
  }
});

app.post('/fetch-jd', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({
      error: 'url is required',
      code: 'MISSING_URL'
    });
  }

  // Validate URL format
  try {
    new URL(url);
  } catch {
    return res.status(400).json({
      error: 'Invalid URL format',
      code: 'INVALID_URL'
    });
  }

  // Classify portal
  const portalStatus = classifyPortal(url);

  if (portalStatus === 'blocked') {
    return res.status(403).json({
      error: 'This job portal does not allow automated fetching. Please paste the job description text directly.',
      code: 'PORTAL_BLOCKED'
    });
  }

  try {
    const cleanText = await fetchAndCleanJD(url);

    res.json({
      jobDescription: cleanText,
      source: url,
      portalStatus
    });

  } catch (error: any) {
    if (error.response?.status === 403 || error.response?.status === 401) {
      return res.status(403).json({
        error: 'This page requires login or blocks automated access. Please paste the job description text directly.',
        code: 'ACCESS_DENIED'
      });
    }

    if (error.response?.status === 404) {
      return res.status(404).json({
        error: 'Job listing not found. It may have expired or been removed.',
        code: 'NOT_FOUND'
      });
    }

    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return res.status(408).json({
        error: 'The page took too long to respond. Please paste the job description text directly.',
        code: 'TIMEOUT'
      });
    }

    if (error.message?.includes('too short') || error.message?.includes('Could not extract')) {
      return res.status(422).json({
        error: 'Could not extract job content from this page. Please paste the job description text directly.',
        code: 'EXTRACTION_FAILED'
      });
    }

    console.error('Fetch JD failed:', error.message, error.response?.status, error.code);
    return res.status(500).json({
      error: 'Failed to fetch job description. Please paste the text directly.',
      code: 'FETCH_FAILED'
    });
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
    const summaryPrompt = `You are a career advisor giving honest 
direct advice.

Based on this job fit analysis write a 3-4 sentence paragraph
telling the candidate whether to apply and exactly why.

Decision: ${result.decision.applyDecision}
Coverage: ${result.decision.hardCoverage}

Matched skills:
${result.gapAnalysis.requiredSkills
  .filter((s: any) => {
    const norm = (t: string) => t.toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    return result.gapAnalysis.candidateSkills
      .some((c: any) => norm(c.name) === norm(s.name));
  })
  .map((s: any) => `- ${s.name} (${s.requirement})`)
  .join('\n')}

Missing skills:
${result.gapAnalysis.requiredSkills
  .filter((s: any) => {
    const norm = (t: string) => t.toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    return !result.gapAnalysis.candidateSkills
      .some((c: any) => norm(c.name) === norm(s.name));
  })
  .map((s: any) => `- ${s.name} (${s.requirement})`)
  .join('\n')}

Rules:
- Be direct and specific, name actual skills
- Start with strongest matched skills
- Name the most critical missing skill if any
- End with clear recommendation and one action
- No bullet points, no percentages, max 4 sentences`;

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
      gapAnalysis: result.gapAnalysis,
      atsReport: result.atsReport
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
        const summaryPrompt = `You are a career advisor giving honest 
direct advice.

Based on this job fit analysis write a 3-4 sentence paragraph
telling the candidate whether to apply and exactly why.

Decision: ${result.decision.applyDecision}
Coverage: ${result.decision.hardCoverage}

Matched skills:
${result.gapAnalysis.requiredSkills
  .filter((s: any) => {
    const norm = (t: string) => t.toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    return result.gapAnalysis.candidateSkills
      .some((c: any) => norm(c.name) === norm(s.name));
  })
  .map((s: any) => `- ${s.name} (${s.requirement})`)
  .join('\n')}

Missing skills:
${result.gapAnalysis.requiredSkills
  .filter((s: any) => {
    const norm = (t: string) => t.toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    return !result.gapAnalysis.candidateSkills
      .some((c: any) => norm(c.name) === norm(s.name));
  })
  .map((s: any) => `- ${s.name} (${s.requirement})`)
  .join('\n')}

Rules:
- Be direct and specific, name actual skills
- Start with strongest matched skills
- Name the most critical missing skill if any
- End with clear recommendation and one action
- No bullet points, no percentages, max 4 sentences`;

        const summary = await llmClient.generateText(summaryPrompt);

        return {
          sessionId,
          company: result.company,
          role: result.role,
          decision: result.decision.applyDecision,
          coverage: result.decision.hardCoverage,
          gapAnalysis: result.gapAnalysis,
          summary,
          atsReport: result.atsReport
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
