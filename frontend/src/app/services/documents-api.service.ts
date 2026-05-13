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

@Injectable({ providedIn: 'root' })
export class DocumentsApiService {
  private readonly manifestQuery = inject(ManifestQueryService);
  private readonly manifestCommands = inject(ManifestCommandService);

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
    return this.manifestCommands.softDeleteDocument(payload);
  }

  async restoreDocument(payload: RestorePayload): Promise<void> {
    return this.manifestCommands.restoreDocument(payload);
  }

  async hardDeleteDocument(payload: DeletePayload): Promise<void> {
    return this.manifestCommands.hardDeleteDocument(payload);
  }
}
