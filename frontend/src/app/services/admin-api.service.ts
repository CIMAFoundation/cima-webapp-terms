import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private readonly http = inject(HttpClient);
  // Relative path keeps API under current app base href:
  // dev -> /api/admin, prod under /webterms -> /webterms/api/admin
  private readonly baseUrl = 'api/admin';

  async softDeleteDocument(payload: {
    platform: string;
    docType: string;
    lang: string;
    filePath?: string;
  }): Promise<void> {
    await firstValueFrom(this.http.post<void>(`${this.baseUrl}/documents/soft-delete`, payload));
  }

  async softDeleteBatch(
    items: Array<{ platform: string; docType: string; lang: string; filePath?: string }>
  ): Promise<void> {
    await firstValueFrom(this.http.post<void>(`${this.baseUrl}/documents/soft-delete-batch`, { items }));
  }

  async restoreDocument(payload: { platform: string; docType: string; lang: string }): Promise<void> {
    await firstValueFrom(this.http.post<void>(`${this.baseUrl}/documents/restore`, payload));
  }

  async hardDeleteDocument(payload: {
    platform: string;
    docType: string;
    lang: string;
    filePath?: string;
  }): Promise<void> {
    await firstValueFrom(this.http.post<void>(`${this.baseUrl}/documents/hard-delete`, payload));
  }
}
