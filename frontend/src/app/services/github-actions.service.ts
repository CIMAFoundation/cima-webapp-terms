import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface GithubWorkflowRun {
  id: number;
  name: string;
  status: 'queued' | 'in_progress' | 'completed' | string;
  conclusion: 'success' | 'failure' | 'cancelled' | 'timed_out' | string | null;
  html_url: string;
  created_at: string;
  updated_at: string;
  head_branch: string;
  event: string;
}

interface GithubWorkflowRunsResponse {
  workflow_runs: GithubWorkflowRun[];
}

@Injectable({ providedIn: 'root' })
export class GithubActionsService {
  private readonly http = inject(HttpClient);

  async getWorkflowRuns(params: {
    owner: string;
    repo: string;
    branch: string;
    token: string;
    perPage?: number;
  }): Promise<GithubWorkflowRun[]> {
    const perPage = params.perPage ?? 20;
    const url = `https://api.github.com/repos/${params.owner}/${params.repo}/actions/runs?branch=${encodeURIComponent(params.branch)}&per_page=${perPage}`;

    const headers = new HttpHeaders({
      Authorization: `Bearer ${params.token}`,
      Accept: 'application/vnd.github+json'
    });

    const response = await firstValueFrom(
      this.http.get<GithubWorkflowRunsResponse>(url, { headers })
    );

    return response.workflow_runs || [];
  }
}

