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

  candidateSkills: CandidateSkill[] = [];
  jobSkills: JobSkill[] = [];
  jobScore: JobScore | null = null;
  loading = false;
  error: string | null = null;

  constructor(private apiService: ApiService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    // Automatic loading removed as per requirement
  }

  onAnalyze(): void {
    if (!this.cvText || !this.jobDescription) {
      this.error = 'Please provide both CV and Job Description';
      return;
    }

    this.loading = true;
    this.error = null;
    console.log('Starting analysis...');

    this.apiService.analyze(this.cvText, this.jobDescription).subscribe({
      next: (res) => {
        console.log('Analysis complete:', res);
        this.candidateSkills = res.gapAnalysis.candidateSkills;
        this.jobSkills = res.gapAnalysis.requiredSkills;
        this.jobScore = res.jobScore;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Analysis failed:', err);
        this.error = 'Analysis failed. Please try again.';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  deleteCandidateSkill(index: number): void {
    this.candidateSkills.splice(index, 1);
  }

  deleteJobSkill(index: number): void {
    this.jobSkills.splice(index, 1);
  }
}
