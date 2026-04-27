import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../api.service';
import { JobSkill, CandidateSkill, JobScore } from '../models';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-job-analysis',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './job-analysis.component.html',
  styleUrl: './job-analysis.component.css'
})
export class JobAnalysisComponent implements OnInit {
  cvText: string = '';
  jobDescription: string = '';

  summary: string = '';
  decision: string = '';
  coverage: number = 0;
  sessionId: string = '';
  showSkillDetail: boolean = false;
  cvSaved: boolean = false;

  candidateSkills: CandidateSkill[] = [];
  jobSkills: JobSkill[] = [];
  jobScore: JobScore | null = null;
  loading = false;
  error: string | null = null;

  generatingMaterials: boolean = false;
  materials: {
    tailoredCv: string;
    coverLetter: string;
    interviewPrep: string;
  } | null = null;

  constructor(private apiService: ApiService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {}

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
        console.error('Analysis failed:', err);
        this.error = err.error?.error || 'Analysis failed. Please ensure you saved your CV first.';
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
}
