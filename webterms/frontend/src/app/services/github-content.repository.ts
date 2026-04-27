import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

interface GithubGetFileResponse {
  sha: string;
  content?: string;
}

@Injectable({ providedIn: 'root' })
export class GithubContentRepository {
  private readonly http = inject(HttpClient);

  async readJsonFile<T>(params: {
    owner: string;
    repo: string;
    branch: string;
    path: string;
    token: string;
  }): Promise<T | null> {
    const url = this.buildContentsUrl(params.owner, params.repo, params.path);
    const headers = this.buildHeaders(params.token);

    try {
      const response = await firstValueFrom(
        this.http.get<GithubGetFileResponse>(`${url}?ref=${params.branch}`, { headers })
      );
      const raw = atob(String(response.content || '').replace(/\n/g, ''));
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async upsertFile(params: {
    owner: string;
    repo: string;
    branch: string;
    path: string;
    contentBase64: string;
    message: string;
    token: string;
  }): Promise<void> {
    const url = this.buildContentsUrl(params.owner, params.repo, params.path);
    const headers = this.buildHeaders(params.token);

    let sha: string | undefined;
    try {
      const existing = await firstValueFrom(
        this.http.get<GithubGetFileResponse>(`${url}?ref=${params.branch}`, { headers })
      );
      sha = existing.sha;
    } catch {
      sha = undefined;
    }

    await firstValueFrom(
      this.http.put(
        url,
        {
          message: params.message,
          content: params.contentBase64,
          branch: params.branch,
          sha
        },
        { headers }
      )
    );
  }

  async deleteFile(params: {
    owner: string;
    repo: string;
    branch: string;
    path: string;
    message: string;
    token: string;
  }): Promise<void> {
    const url = this.buildContentsUrl(params.owner, params.repo, params.path);
    const headers = this.buildHeaders(params.token);

    const existing = await firstValueFrom(
      this.http.get<GithubGetFileResponse>(`${url}?ref=${params.branch}`, { headers })
    );

    await firstValueFrom(
      this.http.request('DELETE', url, {
        headers,
        body: {
          message: params.message,
          branch: params.branch,
          sha: existing.sha
        }
      })
    );
  }

  private buildContentsUrl(owner: string, repo: string, path: string): string {
    return `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  }

  private buildHeaders(token: string): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json'
    });
  }
}

