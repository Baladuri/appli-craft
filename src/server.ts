import express from 'express';
import cors from 'cors';
import * as fs from 'fs';
import * as path from 'path';
import { runApplication } from './index';
import { OrchestratorConfig } from './core/types';

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

app.post('/analyze', async (req, res) => {
  const { cvText, jobDescription } = req.body;

  if (!cvText || !jobDescription) {
    return res.status(400).json({ error: 'cvText and jobDescription are required' });
  }

  try {
    // Create temp CV file
    const tempCvPath = path.join(__dirname, '../data/web-cv.md');
    // Ensure data directory exists
    if (!fs.existsSync(path.dirname(tempCvPath))) {
      fs.mkdirSync(path.dirname(tempCvPath), { recursive: true });
    }
    fs.writeFileSync(tempCvPath, cvText);

    const orchConfig: OrchestratorConfig = {
      company: 'Web-Company',
      role: 'Web-Role',
      jobDescription: jobDescription,
      baseCvPath: tempCvPath
    };

    const outputDir = await runApplication(orchConfig);

    const gapAnalysisPath = path.join(outputDir, 'gap-analysis.json');
    const jobScorePath = path.join(outputDir, 'job-score.json');

    const gapAnalysis = JSON.parse(fs.readFileSync(gapAnalysisPath, 'utf-8'));
    const jobScore = JSON.parse(fs.readFileSync(jobScorePath, 'utf-8'));

    res.json({ gapAnalysis, jobScore });
  } catch (error: any) {
    console.error('Analysis failed:', error);
    res.status(500).json({ error: 'Analysis failed: ' + error.message });
  }
});

app.listen(port, () => {
  console.log(`🚀 Backend server running at http://localhost:${port}`);
});
