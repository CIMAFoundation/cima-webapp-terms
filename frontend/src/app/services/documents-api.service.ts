import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  DocumentsResponse,
  PublicLatestResponse,
  PublishPayload,
  DeletePayload,
  RestorePayload,
  SimplePublishPayload
} from './api.models';
import { ManifestCommandService } from './manifest-command.service';
import { ManifestQueryService } from './manifest-query.service';
import { AdminApiService } from './admin-api.service';

@Injectable({ providedIn: 'root' })
export class DocumentsApiService {
  private readonly manifestQuery = inject(ManifestQueryService);
  private readonly manifestCommands = inject(ManifestCommandService);
  private readonly adminApi = inject(AdminApiService);

  getDocuments(
    _manifestUrl: string,
    filters: {
      search?: string;
      platform?: string;
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

  async publishDocument(payload: PublishPayload): Promise<{ version: number; filePath: string }> {
    return this.manifestCommands.publishDocument(payload);
  }

  async publishSimpleDocument(
    payload: SimplePublishPayload
  ): Promise<{ latestPath: string; legacyPath: string }> {
    return this.manifestCommands.publishSimpleDocument(payload);
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
