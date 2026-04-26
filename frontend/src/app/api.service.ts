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

  analyze(jobDescription: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/analyze`, { jobDescription });
  }

  saveCV(cvText: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/cv`, { cvText });
  }
}
