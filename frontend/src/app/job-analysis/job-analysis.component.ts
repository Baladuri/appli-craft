import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../api.service';
import { JobSkill, CandidateSkill, BatchRanking, BatchJobResult } from '../models';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-job-analysis',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './job-analysis.component.html',
  styleUrl: './job-analysis.component.css'
})
export class JobAnalysisComponent implements OnInit {

  // ── Shared state ──────────────────────────────────────────────────
  cvText: string = '';
  cvSaved: boolean = false;
  loading: boolean = false;
  error: string | null = null;
  mode: 'single' | 'batch' = 'single';

  // ── Single analysis state ─────────────────────────────────────────
  jobDescription: string = '';
  summary: string = '';
  decision: string = '';
  coverage: number = 0;
  sessionId: string = '';
  showSkillDetail: boolean = false;
  candidateSkills: CandidateSkill[] = [];
  jobSkills: JobSkill[] = [];
  generatingMaterials: boolean = false;
  materials: {
    tailoredCv: string;
    coverLetter: string;
    interviewPrep: string;
  } | null = null;

  // ── Batch analysis state ──────────────────────────────────────────
  batchInput: string = '';
  batchResults: BatchRanking[] = [];
  batchJobs: BatchJobResult[] = [];

  constructor(
    private apiService: ApiService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {}

  // ── Shared methods ────────────────────────────────────────────────

  setMode(mode: 'single' | 'batch'): void {
    this.mode = mode;
    this.error = null;
  }

  onSaveCV(): void {
    if (!this.cvText) return;
    this.apiService.saveCV(this.cvText).subscribe({
      next: () => {
        this.cvSaved = true;
        this.cdr.detectChanges();
      },
      error: () => {
        this.error = 'Failed to save CV';
        this.cdr.detectChanges();
      }
    });
  }

  // ── Single analysis methods ───────────────────────────────────────

  onAnalyze(): void {
    if (!this.jobDescription) {
      this.error = 'Please provide a Job Description';
      return;
    }
    this.loading = true;
    this.error = null;
    this.summary = '';
    this.materials = null;
    this.sessionId = '';

    this.apiService.analyze(this.jobDescription).subscribe({
      next: (res) => {
        this.sessionId = res.sessionId;
        this.summary = res.summary;
        this.decision = res.decision;
        this.coverage = res.coverage;
        this.candidateSkills = res.gapAnalysis.candidateSkills;
        this.jobSkills = res.gapAnalysis.requiredSkills;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error = err.error?.error ||
          'Analysis failed. Please ensure you saved your CV first.';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  onGenerateMaterials(): void {
    if (!this.sessionId) return;
    this.generatingMaterials = true;
    this.error = null;

    this.apiService.generateMaterials(this.sessionId).subscribe({
      next: (res) => {
        this.materials = res;
        this.generatingMaterials = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.error = 'Failed to generate materials. Please try again.';
        this.generatingMaterials = false;
        this.cdr.detectChanges();
      }
    });
  }

  downloadFile(content: string, filename: string): void {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  toggleSkillDetail(): void {
    this.showSkillDetail = !this.showSkillDetail;
  }

  deleteCandidateSkill(index: number): void {
    this.candidateSkills.splice(index, 1);
  }

  deleteJobSkill(index: number): void {
    this.jobSkills.splice(index, 1);
  }

  // ── Batch analysis methods ────────────────────────────────────────

  onAnalyzeBatch(): void {
    if (!this.batchInput.trim()) {
      this.error = 'Please paste at least one job description';
      return;
    }

    const separator = '===';
    
    const stripFrontmatter = (text: string): string => {
      const lines = text.split('\n');
      if (lines[0].trim() !== '---') return text;
      const closingIndex = lines.findIndex(
        (line, i) => i > 0 && line.trim() === '---'
      );
      if (closingIndex === -1) return text;
      return lines.slice(closingIndex + 1).join('\n').trim();
    };

    const jobs = this.batchInput
      .split(separator)
      .map(jd => jd.trim())
      .filter(jd => jd.length > 0)
      .map(jd => ({ jobDescription: stripFrontmatter(jd) }))
      .filter(jd => jd.jobDescription.length > 0);

    if (jobs.length === 0) {
      this.error = 'No valid job descriptions found';
      return;
    }

    if (jobs.length > 10) {
      this.error = 'Maximum 10 jobs per batch';
      return;
    }

    this.loading = true;
    this.error = null;
    this.batchResults = [];

    this.apiService.analyzeBatch(jobs).subscribe({
      next: (res) => {
        this.batchJobs = ((res.jobs || []) as any[])
          .map((job: any) => ({
            sessionId: job.sessionId,
            company: job.company,
            role: job.role,
            decision: job.decision,
            coverage: job.coverage,
            gapAnalysis: job.gapAnalysis,
            summary: job.summary,
            materials: null,
            generatingMaterials: false,
            showSkillDetail: false
          }))
          .sort((a: BatchJobResult, b: BatchJobResult) =>
            b.coverage - a.coverage
          );

        this.batchResults = res.rankings || [];
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error = err.error?.error ||
          'Batch analysis failed. Please ensure you saved your CV first.';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  getDecisionClass(decision: string): string {
    return decision;
  }

  formatJobId(jobId: string): string {
    return jobId
      .split('-')
      .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  toggleBatchSkillDetail(job: BatchJobResult): void {
    job.showSkillDetail = !job.showSkillDetail;
  }

  onGenerateBatchMaterials(job: BatchJobResult): void {
    if (!job.sessionId) return;
    job.generatingMaterials = true;
    this.error = null;

    this.apiService.generateMaterials(job.sessionId).subscribe({
      next: (res) => {
        job.materials = res;
        job.generatingMaterials = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.error = 'Failed to generate materials. Please try again.';
        job.generatingMaterials = false;
        this.cdr.detectChanges();
      }
    });
  }
}
