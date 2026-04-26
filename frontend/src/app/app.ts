import { Component } from '@angular/core';
import { JobAnalysisComponent } from './job-analysis/job-analysis.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [JobAnalysisComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {}
