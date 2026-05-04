# AppliCraft

AppliCraft is a professional ATS-optimization and job fit analysis platform. It helps candidates "know before they apply" by providing a deep-dive analysis of how their CV aligns with a specific job description, identifying terminology gaps that might trigger ATS filters, and generating tailored application materials.

## The Problem
Many qualified candidates are rejected by Automated Tracking Systems (ATS) because their CVs use different terminology than the Job Description (JD), or because they lack a few "hard" requirements that aren't immediately obvious. AppliCraft solves this by providing:
- **Honest Feedback**: An AI-driven decision on whether to Apply, Skip, or if you're a "Maybe".
- **ATS Visibility**: Identification of skills you *have* but are described differently in your CV.
- **Material Tailoring**: Automated generation of CVs and Cover Letters that mirror the JD's language.

## How It Works
AppliCraft uses a sequential multi-agent pipeline to process every job:

1.  **Ingestion**: The system accepts a Job URL (fetched via `@mozilla/readability`) or raw text, and a persistent Candidate CV.
2.  **Research**: The **Researcher Agent** extracts the company profile and core role requirements.
3.  **Analysis**: The **Analyst Agent** breaks down the JD into Required, Preferred, and Implicit skills.
4.  **Gap Engine**: A semantic matcher compares the CV against job requirements to calculate a "Hard Coverage" score.
5.  **ATS Audit**: The **ATS Analyzer** performs verbatim keyword matching to ensure your CV uses the exact terminology the ATS expects.
6.  **Synthesis**: The **Writer Agent** and **Interviewer Agent** generate tailored materials and preparation guides on demand.

## Tech Stack
- **Backend**: Node.js, TypeScript, Express.js
- **Frontend**: Angular 17+ (Vanilla CSS)
- **AI**: Anthropic Claude 3.5 Sonnet (Direct via Anthropic SDK)
- **Parsing/IO**: axios, multer, JSDOM, Mozilla Readability, Mammoth (DOCX), PDF-Parse

## Project Structure
```bash
.
├── src/                # Backend source code
│   ├── agents/         # Multi-agent system (Researcher, Analyst, Writer, Interviewer)
│   ├── core/           # Core logic (ATS Analyzer, Matcher, Scoring)
│   ├── index.ts        # Orchestration and pipeline entry points
│   └── server.ts       # Express API handlers and session management
├── frontend/           # Angular application (Notion-inspired UI)
├── data/               # Persistent CV storage and CV/JD hash caching
├── applications/       # Artifacts and job-rankings.json persistence
└── README.md
```

## Installation

### Prerequisites
- Node.js (v18+)
- Angular CLI (`npm install -g @angular/cli`)
- An Anthropic API Key

### Setup
1. Clone the repository
2. Install root (backend) dependencies:
   ```bash
   npm install
   ```
3. Install frontend dependencies:
   ```bash
   cd frontend && npm install
   ```
4. Configure environment:
   Create a `.env` file in the root:
   ```env
   ANTHROPIC_API_KEY=your_key_here
   ```

## Running Locally

1. **Start the Backend**:
   ```bash
   npm run server
   ```
   The server runs on `http://localhost:3000`.

2. **Start the Frontend**:
   ```bash
   cd frontend
   npm start
   ```

## Key Features
- **Sequential Processing**: Jobs are analyzed one at a time to prevent LLM race conditions and allow the UI to show progressive results as each analysis completes.
- **CV Upload**: Accepts PDF and DOCX files. Uses `pdf-parse` for text-based PDFs and `mammoth` for DOCX. Falls back to manual text paste for scanned or complex PDFs.
- **Portal Classifier**: Automatically identifies if a Job URL is fetchable. Pre-classified domains include Allowed (Stepstone, Lever, Greenhouse) and Blocked (LinkedIn, Indeed, Glassdoor).
- **Two-zone UI**: Features a Notion-inspired sidebar for the job queue with real-time status dots, paired with a main content area for detailed analysis results.
- **Terminology Gap Detection**: Specifically warns you if you have a skill but your CV uses different wording (e.g., "NodeJS" vs "Node.js"), ensuring verbatim ATS matches.
- **ATS LLM Suggestions**: When terminology gaps are found, a focused LLM call generates specific placement advice for incorporating each missing exact term into your CV.

## Architecture Decisions
- **Sequential Processing**: Analyzing jobs one by one ensures stability in LLM tokens/rate limits and enables a better user experience with real-time progress updates.
- **CV Hash Caching**: CV skills are extracted once per unique file hash. JD skills are similarly cached. Re-analyzing the same inputs skips the expensive LLM extraction phase.
- **ATS Scope**: Focused exclusively on terminology gaps (verbatim matching). Layout-based placement analysis was dropped to ensure reliability across varied CV formats.
- **Summary Enrichment**: The career advisor prompt receives explicit lists of "Matched" and "Missing" skills rather than raw JSON, enabling the LLM to name specific technologies in its advice.
- **Agent Isolation**: Each agent has a specific scope (extraction vs. synthesis) to prevent hallucination creep and maintain deterministic scoring.