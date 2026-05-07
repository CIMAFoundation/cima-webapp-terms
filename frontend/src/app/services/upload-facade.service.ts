import { Injectable, inject } from '@angular/core';
import { PublishPayload } from './api.models';
import { DocumentsApiService } from './documents-api.service';

type DocType = 'terms' | 'privacy' | 'cookie';

export interface QueuedFile {
  id: string;
  file: File;
  platform: string;
  docType: DocType | '';
  lang: string;
  effectiveDate: string;
  status: 'pending' | 'uploading' | 'done' | 'error';
  message?: string;
}

export interface UploadBatchResult {
  successCount: number;
  errorCount: number;
}

export interface UploadGithubConfig {
  githubToken: string;
  repoOwner: string;
  repoName: string;
  branch: string;
  documentsRootPath: string;
  manifestPath: string;
  publicBaseUrl: string;
}

@Injectable({ providedIn: 'root' })
export class UploadFacadeService {
  private readonly documentsApi = inject(DocumentsApiService);

  queuedFiles: QueuedFile[] = [];
  private fileCounter = 0;

  addFiles(files: FileList | null): void {
    if (!files?.length) return;

    const existing = new Set(this.queuedFiles.map((f) => `${f.file.name}:${f.file.size}`));
    for (const file of Array.from(files)) {
      const key = `${file.name}:${file.size}`;
      if (!existing.has(key)) {
        this.queuedFiles.push(this.createFileEntry(file));
      }
    }
  }

  removeQueued(id: string): void {
    this.queuedFiles = this.queuedFiles.filter((f) => f.id !== id);
  }

  removeDone(): void {
    this.queuedFiles = this.queuedFiles.filter((f) => f.status !== 'done');
  }

  canPublish(githubFormValid: boolean): boolean {
    return (
      !this.queuedFiles.some((f) => f.status === 'uploading') &&
      githubFormValid &&
      this.queuedFiles.length > 0 &&
      this.queuedFiles.every((f) => this.isReadyForPublish(f))
    );
  }

  async uploadAll(github: UploadGithubConfig): Promise<UploadBatchResult> {
    this.queuedFiles.forEach((f) => {
      f.status = 'uploading';
      f.message = undefined;
    });

    let successCount = 0;
    let errorCount = 0;

    for (const queuedFile of this.queuedFiles) {
      if (!this.isReadyForPublish(queuedFile)) {
        queuedFile.status = 'error';
        queuedFile.message = 'Campi mancanti';
        errorCount += 1;
        continue;
      }

      try {
        const payload: PublishPayload = {
          platform: queuedFile.platform,
          docType: queuedFile.docType,
          lang: queuedFile.lang,
          effectiveDate: queuedFile.effectiveDate,
          fileName: queuedFile.file.name,
          contentBase64: await this.readFileAsBase64(queuedFile.file),
          githubToken: github.githubToken,
          repoOwner: github.repoOwner,
          repoName: github.repoName,
          branch: github.branch,
          documentsRootPath: github.documentsRootPath,
          manifestPath: github.manifestPath,
          publicBaseUrl: github.publicBaseUrl
        };

        const published = await this.documentsApi.publishDocument(payload);
        queuedFile.status = 'done';
        queuedFile.message = `Pubblicato v${String(published.version).padStart(3, '0')}`;
        successCount += 1;
      } catch (error: any) {
        queuedFile.status = 'error';
        const backendError = String(error?.error?.message || error?.error || '').trim();
        const directError = String(error?.message || '').trim();
        queuedFile.message = backendError || directError || `Errore (status ${error?.status || '?'})`;
        errorCount += 1;
      }
    }

    return { successCount, errorCount };
  }

  private createFileEntry(file: File): QueuedFile {
    return {
      id: `file-${++this.fileCounter}`,
      file,
      platform: '',
      docType: '',
      lang: '',
      effectiveDate: this.getTodayDate(),
      status: 'pending'
    };
  }

  private isReadyForPublish(file: QueuedFile): file is QueuedFile & { docType: DocType } {
    return Boolean(file.platform && file.docType && file.lang && file.effectiveDate);
  }

  private getTodayDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  private readFileAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? '').split(',')[1] ?? '');
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }
}

