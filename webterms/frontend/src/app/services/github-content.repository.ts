import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

interface HttpLikeError {
  status?: number;
  message?: string;
}

interface GithubGetFileResponse {
  sha: string;
  content?: string;
}

@Injectable({ providedIn: 'root' })
export class GithubContentRepository {
  private readonly http = inject(HttpClient);
  private static readonly MAX_RETRIES = 3;

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

    let lastError: unknown;
    for (let attempt = 1; attempt <= GithubContentRepository.MAX_RETRIES; attempt += 1) {
      const sha = await this.tryGetFileSha(url, params.branch, headers);
      try {
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
        return;
      } catch (error) {
        lastError = error;
        if (!this.isRetryableConflict(error) || attempt === GithubContentRepository.MAX_RETRIES) {
          throw error;
        }
        await this.waitMs(250 * attempt);
      }
    }

    throw lastError;
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

    let lastError: unknown;
    for (let attempt = 1; attempt <= GithubContentRepository.MAX_RETRIES; attempt += 1) {
      const sha = await this.tryGetFileSha(url, params.branch, headers);
      if (!sha) {
        // File gia assente: delete idempotente.
        return;
      }

      try {
        await firstValueFrom(
          this.http.request('DELETE', url, {
            headers,
            body: {
              message: params.message,
              branch: params.branch,
              sha
            }
          })
        );
        return;
      } catch (error) {
        lastError = error;
        const status = this.getStatus(error);
        if (status === 404) {
          return;
        }
        if (!this.isRetryableConflict(error) || attempt === GithubContentRepository.MAX_RETRIES) {
          throw error;
        }
        await this.waitMs(250 * attempt);
      }
    }

    throw lastError;
  }

  private async tryGetFileSha(
    url: string,
    branch: string,
    headers: HttpHeaders
  ): Promise<string | undefined> {
    try {
      const existing = await firstValueFrom(
        this.http.get<GithubGetFileResponse>(`${url}?ref=${branch}`, { headers })
      );
      return existing.sha;
    } catch (error) {
      if (this.getStatus(error) === 404) {
        return undefined;
      }
      throw error;
    }
  }

  private isRetryableConflict(error: unknown): boolean {
    const status = this.getStatus(error);
    return status === 409 || status === 412;
  }

  private getStatus(error: unknown): number | undefined {
    return (error as HttpLikeError)?.status;
  }

  private waitMs(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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

