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

export interface DocumentFilters {
  search?: string;
  platform?: string;
  docType?: string;
  lang?: string;
  includeDeleted?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ManifestQueryService {
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
              const haystack = `${doc.originalFileName} ${doc.downloadFileName} ${doc.platform} ${doc.docType}`
                .toLowerCase();
              if (!haystack.includes(search)) return false;
            }
            if (filters.platform && doc.platform !== filters.platform) return false;
            if (filters.docType && doc.docType !== filters.docType) return false;
            if (filters.lang && doc.lang !== filters.lang) return false;
            return true;
          })
        };
      })
    );
  }

  getPublicLatest(): Observable<PublicLatestResponse> {
    const primaryUrl = this.runtimeConfig.getManifestUrl();
    const fallbackUrl = this.runtimeConfig.getFallbackManifestUrl();

    const cached = this.runtimeConfig.getCachedManifest();
    if (cached) {
      return new Observable((observer) => {
        observer.next(cached.manifest as PublicLatestResponse);
        observer.complete();
      });
    }

    const t = Date.now();
    const primaryWithBuster = primaryUrl.includes('?') ? `${primaryUrl}&t=${t}` : `${primaryUrl}?t=${t}`;
    const fallbackWithBuster = fallbackUrl.includes('?')
      ? `${fallbackUrl}&t=${t}`
      : `${fallbackUrl}?t=${t}`;

    return new Observable((observer) => {
      this.http.get<PublicLatestResponse>(primaryWithBuster).subscribe({
        next: (response) => {
          this.runtimeConfig.setCachedManifest(response);
          observer.next(response);
          observer.complete();
        },
        error: () => {
          this.http.get<PublicLatestResponse>(fallbackWithBuster).subscribe({
            next: (response) => {
              this.runtimeConfig.setCachedManifest(response);
              observer.next(response);
              observer.complete();
            },
            error: (fallbackError) => {
              const cachedRaw = localStorage.getItem('webterms_cached_manifest');
              if (cachedRaw) {
                try {
                  observer.next(JSON.parse(cachedRaw) as PublicLatestResponse);
                  observer.complete();
                  return;
                } catch {
                  // ignore stale invalid cache
                }
              }
              observer.error(fallbackError);
            }
          });
        }
      });
    });
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
