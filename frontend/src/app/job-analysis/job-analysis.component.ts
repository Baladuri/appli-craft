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
  showSkillDetail: boolean = false;
  cvSaved: boolean = false;

  candidateSkills: CandidateSkill[] = [];
  jobSkills: JobSkill[] = [];
  jobScore: JobScore | null = null;
  loading = false;
  error: string | null = null;

  constructor(private apiService: ApiService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    // Check if CV already exists on backend
    // this.apiService.getCV().subscribe(...) could be added here later
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

  onAnalyze(): void {
    if (!this.jobDescription) {
      this.error = 'Please provide a Job Description';
      return;
    }

    this.loading = true;
    this.error = null;
    this.summary = ''; // Clear previous result
    
    this.apiService.analyze(this.jobDescription).subscribe({
      next: (res) => {
        this.summary = res.summary;
        this.decision = res.decision;
        this.coverage = res.coverage;
        this.candidateSkills = res.gapAnalysis.candidateSkills;
        this.jobSkills = res.gapAnalysis.requiredSkills;
        this.jobScore = res.jobScore;
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
