import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';
import { RuntimeConfigService } from './runtime-config.service';

interface UploadItem {
  line: string;
  lang: string;
  docType: string;
  date: string;
  fileName: string;
  contentBase64: string;
}

interface UploadReceipt {
  count: number;
  documents: Array<{ latestPath: string; legacyPath: string; sha256: string }>;
}

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly runtimeConfig = inject(RuntimeConfigService);

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

  /** Publishes one document through the same verified batch API. */
  async uploadDocument(payload: UploadItem): Promise<{ latestPath: string; legacyPath: string }> {
    const receipt = await this.submitUploads([payload]);
    return receipt.documents[0];
  }

  /** Publishes the queue in one commit and checks every returned content hash. */
  async uploadDocuments(items: UploadItem[]): Promise<void> {
    await this.submitUploads(items);
  }

  /** Rejects incomplete receipts and clears cached lists even after an ambiguous response. */
  private async submitUploads(items: UploadItem[]): Promise<UploadReceipt> {
    const hashes = await Promise.all(items.map(async (item) => {
      const bytes = Uint8Array.from(atob(item.contentBase64), (char) => char.charCodeAt(0));
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
    }));
    try {
      const receipt = await firstValueFrom(this.http.post<UploadReceipt>(
        `${this.baseUrl}/upload.php`, { items }, this.options
      ));
      if (receipt?.count !== items.length || !Array.isArray(receipt.documents)
        || receipt.documents.length !== items.length
        || items.some((item, index) => {
          const document = receipt.documents[index];
          return document?.latestPath !== `latest/${item.line}/${item.lang}/${item.docType}.pdf`
            || document?.legacyPath !== `legacy/${item.line}/${item.lang}/${item.docType}_${item.date}.pdf`
            || document?.sha256 !== hashes[index];
        })) {
        throw new Error('Conferma upload non valida. Controlla il repository prima di riprovare.');
      }
      return receipt;
    } finally {
      this.runtimeConfig.clearCachedLatestIndex();
    }
  }
}
