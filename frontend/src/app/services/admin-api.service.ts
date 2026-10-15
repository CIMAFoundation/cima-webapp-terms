import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  /** Adds the server-issued CSRF token to document mutations. */
  private get options() {
    return { headers: { 'X-Webterms-CSRF': this.auth.getToken() } };
  }
  // Relative path keeps API under current app base href:
  // dev -> /api (proxied), prod under /webterms -> /webterms/api
  private readonly baseUrl = 'api';

  /** Requests reversible withdrawal through CI. */
  async softDeleteDocument(payload: {
    platform: string;
    docType: string;
    lang: string;
    filePath?: string;
  }): Promise<void> {
    await firstValueFrom(this.http.post<void>(`${this.baseUrl}/soft-delete.php`, payload, this.options));
  }

  /** Requests one CI run for selected withdrawals. */
  async softDeleteBatch(
    items: Array<{ platform: string; docType: string; lang: string; filePath?: string }>
  ): Promise<void> {
    await firstValueFrom(this.http.post<void>(`${this.baseUrl}/soft-delete-batch.php`, { items }, this.options));
  }

  /** Requests republication of a withdrawn document. */
  async restoreDocument(payload: { platform: string; docType: string; lang: string }): Promise<void> {
    await firstValueFrom(this.http.post<void>(`${this.baseUrl}/restore.php`, payload, this.options));
  }

  /** Restores all selected documents in one CI request. */
  async restoreBatch(items: Array<{ platform: string; docType: string; lang: string }>): Promise<void> {
    await firstValueFrom(this.http.post<void>(`${this.baseUrl}/restore.php`, { items }, this.options));
  }

  async hardDeleteDocument(payload: {
    platform: string;
    docType: string;
    lang: string;
    filePath?: string;
  }): Promise<void> {
    await firstValueFrom(this.http.post<void>(`${this.baseUrl}/hard-delete.php`, payload, this.options));
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
      this.http.post<{ latestPath: string; legacyPath: string }>(`${this.baseUrl}/upload.php`, payload, this.options)
    );
  }

  // Send the complete queue so the server creates one commit and updates the index once.
  async uploadDocuments(items: Array<{
    line: string;
    lang: string;
    docType: string;
    date: string;
    fileName: string;
    contentBase64: string;
  }>): Promise<void> {
    await firstValueFrom(this.http.post<void>(`${this.baseUrl}/upload.php`, { items }, this.options));
  }
}
