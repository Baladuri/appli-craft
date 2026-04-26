import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { GapAnalysis, JobScore } from './models';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private baseUrl = 'http://localhost:3000';

  constructor(private http: HttpClient) {}

  getGapAnalysis(): Observable<GapAnalysis> {
    return this.http.get<GapAnalysis>(`${this.baseUrl}/gap-analysis`);
  }

  getJobScore(): Observable<JobScore> {
    return this.http.get<JobScore>(`${this.baseUrl}/job-score`);
  }

  analyze(cvText: string, jobDescription: string): Observable<{ gapAnalysis: GapAnalysis; jobScore: JobScore }> {
    return this.http.post<{ gapAnalysis: GapAnalysis; jobScore: JobScore }>(`${this.baseUrl}/analyze`, {
      cvText,
      jobDescription
    });
  }
}
