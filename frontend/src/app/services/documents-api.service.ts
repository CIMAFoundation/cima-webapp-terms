import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  DocumentsResponse,
  PublicLatestResponse,
  DeletePayload,
  RestorePayload,
  SimplePublishPayload
} from './api.models';
import { ManifestQueryService } from './manifest-query.service';
import { AdminApiService } from './admin-api.service';

@Injectable({ providedIn: 'root' })
export class DocumentsApiService {
  private readonly manifestQuery = inject(ManifestQueryService);
  private readonly adminApi = inject(AdminApiService);

  getDocuments(
    _manifestUrl: string,
    filters: {
      search?: string;
      line?: string;
      docType?: string;
      lang?: string;
      includeDeleted?: boolean;
    }
  ): Observable<DocumentsResponse> {
    return this.manifestQuery.getDocuments(filters);
  }

  getPublicLatest(_manifestUrl: string): Observable<PublicLatestResponse> {
    return this.manifestQuery.getPublicLatest();
  }

  async publishSimpleDocument(
    payload: SimplePublishPayload
  ): Promise<{ latestPath: string; legacyPath: string }> {
    return this.adminApi.uploadDocument({
      line: payload.line,
      lang: payload.lang,
      docType: payload.docType,
      date: payload.date,
      fileName: payload.fileName,
      contentBase64: payload.contentBase64
    });
  }

  async softDeleteDocument(payload: DeletePayload): Promise<void> {
    return this.adminApi.softDeleteDocument({
      platform: payload.platform,
      docType: payload.docType,
      lang: payload.lang,
      filePath: payload.filePath
    });
  }

  async softDeleteDocuments(payloads: DeletePayload[]): Promise<void> {
    return this.adminApi.softDeleteBatch(
      payloads.map((payload) => ({
        platform: payload.platform,
        docType: payload.docType,
        lang: payload.lang,
        filePath: payload.filePath
      }))
    );
  }

  async restoreDocument(payload: RestorePayload): Promise<void> {
    return this.adminApi.restoreDocument({
      platform: payload.platform,
      docType: payload.docType,
      lang: payload.lang
    });
  }

  async hardDeleteDocument(payload: DeletePayload): Promise<void> {
    return this.adminApi.hardDeleteDocument({
      platform: payload.platform,
      docType: payload.docType,
      lang: payload.lang,
      filePath: payload.filePath
    });
  }
}
