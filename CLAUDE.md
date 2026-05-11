# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Start backend (Express, port 3000, with debug/inspect)
npm run server

# Start frontend (Angular dev server)
cd frontend && npm start

# Build backend TypeScript
npm run build

# Run single-job pipeline from CLI
npm run dev
```

## Project Overview

AppliCraft is a professional ATS-optimization platform. It analyzes a candidate's CV against a job description, calculates a "hard coverage" score, identifies terminology gaps for ATS filters, and generates tailored application materials (CV, cover letter, interview prep).

## Architecture

### Multi-Agent Pipeline (src/index.ts)

The main orchestrator runs agents **sequentially** — each step waits for the previous to finish. The pipeline is split into two phases:

**Phase 1 — Analysis** (`runApplication`):
1. **Researcher Agent** (src/agents/researcher.agent.ts) — Extracts company/role and generates a company brief from the JD.
2. **Analyst Agent** (src/agents/analyst.agent.ts) — Extracts candidate skills (from CV) and required skills (from JD) using LLM + in-memory hash caching per unique CV/JD.
3. **Gap Engine** (inline in src/index.ts) — Hybrid matching: exact normalized match first, then semantic LLM match for remaining. Each required skill is matched independently.
4. **Scoring** (src/core/scoring.ts) — Calculates `hardCoverage` (0-1) from matched skill weights, maps to apply/maybe/skip.
5. **ATS Analyzer** (src/core/ats-analyzer.ts) — Verbatim keyword matching for terminology gaps (term matches semantically but uses different wording in CV). Returns safe/termGaps/genuineGaps with LLM placement suggestions.

**Phase 2 — Materials** (`runMaterials`, on-demand via session):
1. **Writer Agent** (src/agents/writer.agent.ts) — Generates tailored CV and cover letter.
2. **Interviewer Agent** (src/agents/interviewer.agent.ts) — Generates interview prep (technical questions, behavioral, gap handling, questions to ask).

All agents extend `BaseAgent` and receive an `LLMClient` interface. Concrete implementations are `ClaudeClient` (src/core/claude-client.ts) wrapping the Anthropic SDK and `DeepSeekClient` (src/clients/DeepSeekClient.ts). The active client is selected via the `createLLMClient()` factory based on the `LLM_PROVIDER` env var.

### Express Server (src/server.ts)

Routes:
- `POST /cv` — Save CV text
- `POST /cv/upload` — Upload PDF/DOCX file (extracts text via pdf-parse/mammoth)
- `GET /cv` — Retrieve saved CV
- `POST /fetch-jd` — Fetch job description from URL (uses Mozilla Readability). Classifies portal as allowed/blocked/unknown.
- `POST /analyze` — Run Phase 1 pipeline (single job). Returns summary + sessionId.
- `POST /analyze/batch` — Run Phase 1 for multiple jobs (max 10). Returns rankings.
- `POST /generate-materials` — Run Phase 2 pipeline for a session.

Sessions are stored in-memory (Map<string, AnalysisSession>). CV is persisted to files in `data/`.

### Frontend (Angular 21, standalone components)

- **AppComponent** → **JobAnalysisComponent** — Notion-inspired two-zone UI with sidebar job queue (status dots) and main content area.
- **State**: CV input/upload, job queue with sequential processing, results display (summary, skills, ATS report, materials generation).
- **ApiService** — HTTP client to all backend endpoints.
- **Models** (src/app/models.ts) — `JobQueueItem` is the unified state object for each job in the queue, with typed statuses and result fields.

### Data Flow

1. User uploads CV (text or PDF/DOCX) → saved to `data/candidate-cv.md`
2. User adds jobs (URL or raw text) → queued in frontend
3. "Analyze All" processes jobs sequentially:
   - If URL: fetch via `POST /fetch-jd` (portal classification, Readability extraction)
   - Analyze via `POST /analyze` → backend runs Phase 1 → returns decision/summary/ATS report
4. User can generate materials per job → `POST /generate-materials` → Phase 2

### Key Files

| Path | Purpose |
|---|---|
| src/index.ts | Orchestrator, CLI entry, ranking aggregation |
| src/server.ts | Express API endpoints |
| src/core/types.ts | Shared TypeScript interfaces (PipelineResult, ATSReport, GapAnalysis, etc.) |
| src/core/matcher.ts | Hybrid match (normalized + semantic LLM) |
| src/core/scoring.ts | Score calculation and decision mapping |
| src/core/ats-analyzer.ts | Verbatim ATS keyword matching |
| src/core/claude-client.ts | Anthropic SDK wrapper (text + JSON generation, mock mode) |
| src/clients/DeepSeekClient.ts | DeepSeek LLM client (OpenAI-compatible API) |
| src/clients/DeepSeekVisionClient.ts | DeepSeek vision-capable client variant |
| src/config/index.ts | .env-based configuration |
| frontend/src/app/job-analysis/job-analysis.component.ts | Main UI component (queue state, sequential processing, all interactions) |
| specs/ | Feature and security specs driving implementation |
| .claude/skills/ | Project-local Claude Code skills |

### Caching

- **CV skills**: Extracted once per unique MD5 hash of CV content. In-memory `candidateCache` Map.
- **JD skills**: Extracted once per unique MD5 hash of JD content. In-memory `jdCache` Map.
- These caches are in the AnalystAgent and reset when the process restarts.

## Rules

### Never do
- Never run LLM calls in parallel — always sequential, always await
- Never add Angular Material — use plain CSS only
- Never use ng-deep or ViewEncapsulation.None
- Never add npm packages without explicitly being asked
- Never touch backend files when fixing frontend bugs
- Never touch frontend files when fixing backend bugs
- Never write console.logs in committed code
- Never use `any` type in TypeScript unless absolutely unavoidable
  and commented with reason
- Never modify CLAUDE.md without being explicitly asked to

### Always do
- Run `npx tsc --noEmit` after any TypeScript change
- Keep backend and frontend concerns strictly separated
- Use the existing ClaudeClient — never instantiate Anthropic SDK directly
- Commit only when TypeScript compiles clean

### Known limitations (intentional)
- Sessions are in-memory — lost on server restart. 
  This is intentional for now, not a bug to fix.
- CV stored to disk at data/candidate-cv.md — 
  single user local tool, this is correct.
- Multi-model support via `LLM_PROVIDER` env var (`claude` or `deepseek`).
  DeepSeek uses the Anthropic-compatible endpoint at `https://api.deepseek.com/anthropic`.
  Default is `claude` if the var is unset.
- Rate limiting is active on all endpoints: 30 req/min for `/cv` and `/fetch-jd`,
  5 req/min for `/analyze`, `/analyze/batch`, and `/generate-materials`.