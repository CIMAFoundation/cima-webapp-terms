import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import {
  DocumentDto,
  DocumentsResponse,
  PublicLatestEntry,
  PublicLatestResponse
} from './api.models';
import { RuntimeConfigService } from './runtime-config.service';
import { latestIndexToCanonicalDocType } from './doc-type-map';

export interface DocumentFilters {
  search?: string;
  line?: string;
  docType?: string;
  lang?: string;
  includeDeleted?: boolean;
}

@Injectable({ providedIn: 'root' })
export class LatestIndexQueryService {
  private readonly http = inject(HttpClient);
  private readonly runtimeConfig = inject(RuntimeConfigService);

  getDocuments(filters: DocumentFilters): Observable<DocumentsResponse> {
    return this.getPublicLatest().pipe(
      map((response) => {
        const documents = this.flattenLatest(response.latest || {});
        return {
          documents: documents.filter((doc) => {
            if (!filters.includeDeleted && doc.deletedAt) return false;
            if (filters.search) {
              const search = filters.search.toLowerCase();
              const haystack = `${doc.originalFileName} ${doc.downloadFileName} ${doc.line || ''} ${doc.platform} ${doc.docType}`
                .toLowerCase();
              if (!haystack.includes(search)) return false;
            }
            if (filters.line && (doc.line || '-') !== filters.line) return false;
            if (filters.docType && doc.docType !== filters.docType) return false;
            if (filters.lang && doc.lang !== filters.lang) return false;
            return true;
          })
        };
      })
    );
  }

  getPublicLatest(): Observable<PublicLatestResponse> {
    const latestIndexUrl = this.runtimeConfig.getLatestIndexUrl();
    const cached = this.runtimeConfig.getCachedLatestIndex();
    if (cached) {
      return new Observable((observer) => {
        observer.next(cached.value as PublicLatestResponse);
        observer.complete();
      });
    }

    const t = Date.now();
    const withBuster = latestIndexUrl.includes('?') ? `${latestIndexUrl}&t=${t}` : `${latestIndexUrl}?t=${t}`;

    return new Observable((observer) => {
      this.http
        .get<{
          rows?: Array<{
            line?: string;
            lang?: string;
            docType?: string;
            effectiveDate?: string;
            publicUrl?: string;
            downloadFileName?: string;
            deletedAt?: string;
          }>;
        }>(withBuster)
        .subscribe({
          next: (payload) => {
            const response = this.latestIndexToManifest(payload?.rows || []);
            this.runtimeConfig.setCachedLatestIndex(response);
            observer.next(response);
            observer.complete();
          },
          error: (error) => {
            observer.error(error);
          }
        });
    });
  }

  private latestIndexToManifest(
    rows: Array<{
      line?: string;
      lang?: string;
      docType?: string;
      effectiveDate?: string;
      publicUrl?: string;
      downloadFileName?: string;
      deletedAt?: string;
    }>
  ): PublicLatestResponse {
    const latest: PublicLatestResponse['latest'] = {};
    for (const row of rows) {
      const line = String(row.line || '-').trim() || '-';
      const platform = line;
      const docType = latestIndexToCanonicalDocType(String(row.docType || '').trim());
      const lang = String(row.lang || '-').trim() || '-';
      const publicUrl = String(row.publicUrl || '').trim();
      const effectiveDate = String(row.effectiveDate || '').trim() || new Date().toISOString().slice(0, 10);
      const fileName = String(row.downloadFileName || `${row.docType || 'document'}.pdf`);

      latest[platform] = latest[platform] || {};
      latest[platform][docType] = latest[platform][docType] || {};
      latest[platform][docType][lang] = {
        id: `${line}-${docType}-${lang}`,
        line,
        version: 1,
        effectiveDate,
        sha256: '',
        url: publicUrl,
        downloadUrl: publicUrl,
        originalFileName: fileName,
        downloadFileName: fileName,
        deletedAt: row.deletedAt ? String(row.deletedAt) : undefined
      };
    }
    return { latest };
  }

  private flattenLatest(latest: PublicLatestResponse['latest']): DocumentDto[] {
    const flattened: DocumentDto[] = [];

    for (const platform of Object.keys(latest || {})) {
      const byType = latest[platform] || {};
      for (const docType of Object.keys(byType)) {
        const byLang = byType[docType] || {};
        for (const lang of Object.keys(byLang)) {
          const entry = byLang[lang] as PublicLatestEntry;
          flattened.push({
            id: entry.id,
            downloadFileName: entry.downloadFileName || entry.id,
            originalFileName: entry.originalFileName || entry.id,
            line: entry.line,
            sha256: entry.sha256,
            platform,
            docType: docType as DocumentDto['docType'],
            lang,
            effectiveDate: entry.effectiveDate,
            version: entry.version,
            deletedAt: entry.deletedAt || null,
            downloadUrl: entry.downloadUrl,
            publicUrl: entry.url
          });
        }
      }
    }

    return flattened.sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate));
  }
}
