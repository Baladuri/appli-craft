import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../api.service';
import { JobQueueItem } from '../models';
import { FormsModule } from '@angular/forms';

// Blocked portal domains
const BLOCKED_DOMAINS = [
  'linkedin.com',
  'indeed.com',
  'glassdoor.com',
  'xing.com'
];

@Component({
  selector: 'app-job-analysis',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './job-analysis.component.html',
  styleUrl: './job-analysis.component.css'
})
export class JobAnalysisComponent implements OnInit {

  // ── CV state ──────────────────────────────────────────────────────
  cvText: string = '';
  cvSaved: boolean = false;
  cvUploadError: string | null = null;
  cvUploading: boolean = false;
  showCvPaste: boolean = false;

  // ── Queue state ───────────────────────────────────────────────────
  currentInput: string = '';
  jobs: JobQueueItem[] = [];
  isProcessing: boolean = false;
  error: string | null = null;

  constructor(
    private apiService: ApiService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {}

  // ── CV methods ────────────────────────────────────────────────────

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

  onCVFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument'
        + '.wordprocessingml.document'
    ];

    if (!allowedTypes.includes(file.type)) {
      this.cvUploadError = 
        'Only PDF and DOCX files are supported.';
      return;
    }

    this.cvUploading = true;
    this.cvUploadError = null;

    this.apiService.uploadCV(file).subscribe({
      next: () => {
        this.cvSaved = true;
        this.cvUploading = false;
        this.cvUploadError = null;
        // Reset file input
        input.value = '';
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.cvUploading = false;
        const code = err.error?.code;

        if (code === 'EXTRACTION_TOO_SHORT') {
          this.cvUploadError = err.error?.error;
          this.showCvPaste = true;
        } else if (code === 'UNSUPPORTED_FORMAT') {
          this.cvUploadError = 
            'Only PDF and DOCX files are supported.';
        } else {
          this.cvUploadError = 
            'Failed to process file. ' +
            'Please paste your CV text instead.';
          this.showCvPaste = true;
        }
        this.cdr.detectChanges();
      }
    });
  }

  toggleCvPaste(): void {
    this.showCvPaste = !this.showCvPaste;
  }

  // ── Input helpers ─────────────────────────────────────────────────

  isUrl(text: string): boolean {
    try {
      const url = new URL(text.trim());
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  isBlockedPortal(url: string): boolean {
    try {
      const hostname = new URL(url).hostname.replace('www.', '');
      return BLOCKED_DOMAINS.some(domain =>
        hostname === domain || hostname.endsWith('.' + domain)
      );
    } catch {
      return false;
    }
  }

  generateId(): string {
    return Math.random().toString(36).substring(2, 10);
  }

  // ── Queue management ──────────────────────────────────────────────

  onAddJob(): void {
    const input = this.currentInput.trim();
    if (!input) return;

    const isUrl = this.isUrl(input);
    const isBlocked = isUrl && this.isBlockedPortal(input);

    const item: JobQueueItem = {
      id: this.generateId(),
      inputType: isUrl ? 'url' : 'text',
      rawInput: input,
      resolvedText: isUrl ? '' : input,
      status: isBlocked ? 'blocked' : 'input',
      errorMessage: null,
      sessionId: null,
      company: null,
      role: null,
      decision: null,
      coverage: null,
      summary: null,
      gapAnalysis: null,
      materials: null,
      generatingMaterials: false,
      showSkillDetail: false,
      manualText: ''
    };

    this.jobs.push(item);
    this.currentInput = '';
    this.cdr.detectChanges();
  }

  onAddManualText(job: JobQueueItem): void {
    if (!job.manualText.trim()) return;
    job.resolvedText = job.manualText.trim();
    job.inputType = 'text';
    job.status = 'input';
    this.cdr.detectChanges();
  }

  onRemoveJob(job: JobQueueItem): void {
    this.jobs = this.jobs.filter(j => j.id !== job.id);
    this.cdr.detectChanges();
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.onAddJob();
    }
  }

  get readyJobs(): JobQueueItem[] {
    return this.jobs.filter(j => j.status === 'input');
  }

  get hasResults(): boolean {
    return this.jobs.some(j => j.status === 'done' || j.status === 'failed');
  }

  get doneJobs(): JobQueueItem[] {
    return this.jobs
      .filter(j => j.status === 'done')
      .sort((a, b) => (b.coverage ?? 0) - (a.coverage ?? 0));
  }

  // ── Processing ────────────────────────────────────────────────────

  async onAnalyzeAll(): Promise<void> {
    const toProcess = this.jobs.filter(j => j.status === 'input');
    if (toProcess.length === 0) return;

    this.isProcessing = true;
    this.error = null;

    // Mark all as queued
    toProcess.forEach(j => {
      j.status = 'queued';
    });
    this.cdr.detectChanges();

    // Process sequentially
    for (const job of toProcess) {
      await this.processJob(job);
    }

    this.isProcessing = false;
    this.cdr.detectChanges();
  }

  private async processJob(job: JobQueueItem): Promise<void> {
    try {
      // Step 1 — Fetch URL if needed
      if (job.inputType === 'url' && !job.resolvedText) {
        job.status = 'fetching';
        this.cdr.detectChanges();

        await new Promise<void>((resolve, reject) => {
          this.apiService.fetchJD(job.rawInput).subscribe({
            next: (res) => {
              job.resolvedText = res.jobDescription;
              resolve();
            },
            error: (err) => {
              const code = err.error?.code;
              if (code === 'NOT_FOUND') {
                job.errorMessage = 'Job listing not found — it may have expired.';
              } else if (code === 'TIMEOUT') {
                job.errorMessage = 'Page took too long to load. Try pasting the text directly.';
              } else {
                job.errorMessage = 'Could not fetch this page. Try pasting the text directly.';
              }
              reject(new Error(job.errorMessage ?? 'Fetch failed'));
            }
          });
        });
      }

      // Step 2 — Analyze
      job.status = 'analyzing';
      this.cdr.detectChanges();

      await new Promise<void>((resolve, reject) => {
        this.apiService.analyze(job.resolvedText).subscribe({
          next: (res) => {
            job.sessionId = res.sessionId;
            job.company = res.company ?? null;
            job.role = res.role ?? null;
            job.decision = res.decision;
            job.coverage = res.coverage;
            job.summary = res.summary;
            job.gapAnalysis = res.gapAnalysis;
            job.status = 'done';
            resolve();
          },
          error: (err) => {
            job.errorMessage = err.error?.error || 'Analysis failed.';
            reject(new Error(job.errorMessage ?? 'Analysis failed'));
          }
        });
      });

    } catch {
      if (job.status !== 'done') {
        job.status = 'failed';
      }
    }

    this.cdr.detectChanges();
  }

  // ── Materials ─────────────────────────────────────────────────────

  onGenerateMaterials(job: JobQueueItem): void {
    if (!job.sessionId) return;
    job.generatingMaterials = true;

    this.apiService.generateMaterials(job.sessionId).subscribe({
      next: (res) => {
        job.materials = res;
        job.generatingMaterials = false;
        this.cdr.detectChanges();
      },
      error: () => {
        job.generatingMaterials = false;
        this.cdr.detectChanges();
      }
    });
  }

  toggleSkillDetail(job: JobQueueItem): void {
    job.showSkillDetail = !job.showSkillDetail;
    this.cdr.detectChanges();
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
}
