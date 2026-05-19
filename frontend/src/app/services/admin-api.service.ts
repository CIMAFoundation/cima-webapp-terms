import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private readonly http = inject(HttpClient);
  // Relative path keeps API under current app base href:
  // dev -> /api (proxied), prod under /webterms -> /webterms/api
  private readonly baseUrl = 'api';

  async softDeleteDocument(payload: {
    platform: string;
    docType: string;
    lang: string;
    filePath?: string;
  }): Promise<void> {
    await firstValueFrom(this.http.post<void>(`${this.baseUrl}/soft-delete.php`, payload));
  }

  async softDeleteBatch(
    items: Array<{ platform: string; docType: string; lang: string; filePath?: string }>
  ): Promise<void> {
    await firstValueFrom(this.http.post<void>(`${this.baseUrl}/soft-delete-batch.php`, { items }));
  }

  async restoreDocument(payload: { platform: string; docType: string; lang: string }): Promise<void> {
    await firstValueFrom(this.http.post<void>(`${this.baseUrl}/restore.php`, payload));
  }

  async hardDeleteDocument(payload: {
    platform: string;
    docType: string;
    lang: string;
    filePath?: string;
  }): Promise<void> {
    await firstValueFrom(this.http.post<void>(`${this.baseUrl}/hard-delete.php`, payload));
  }

  async uploadDocument(payload: {
    line: string;
    lang: string;
    docType: string;
    date: string;
    fileName: string;
    contentBase64: string;
  }): Promise<{ latestPath: string; legacyPath: string }> {
    return firstValueFrom(
      this.http.post<{ latestPath: string; legacyPath: string }>(`${this.baseUrl}/upload.php`, payload)
    );
  }
}
