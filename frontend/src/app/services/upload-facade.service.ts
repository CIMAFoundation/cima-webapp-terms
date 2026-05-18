import { Injectable, inject } from '@angular/core';
import { SimplePublishPayload, UploadDocType } from './api.models';
import { DocumentsApiService } from './documents-api.service';

export interface QueuedFile {
  id: string;
  file: File;
  line: string;
  lang: '' | 'it' | 'en' | 'fr' | 'es' | 'pt';
  docType: '' | UploadDocType;
  date: string;
  status: 'pending' | 'uploading' | 'done' | 'error';
  message?: string;
}

export interface UploadBatchResult {
  successCount: number;
  errorCount: number;
}

export interface UploadMetadata {
  line: string;
  lang: 'it' | 'en' | 'fr' | 'es' | 'pt';
  docType: UploadDocType;
  date: string;
}

export interface AddFilesResult {
  accepted: number;
  rejected: string[];
}

export interface UploadDefaults {
  line: string;
  lang: '' | 'it' | 'en' | 'fr' | 'es' | 'pt';
  docType: '' | UploadDocType;
  date: string;
}

export type UploadMetadataField = 'line' | 'lang' | 'docType' | 'date';

@Injectable({ providedIn: 'root' })
export class UploadFacadeService {
  private readonly documentsApi = inject(DocumentsApiService);

  queuedFiles: QueuedFile[] = [];
  private fileCounter = 0;

  addFiles(files: FileList | null, defaults: UploadDefaults): AddFilesResult {
    if (!files?.length) return { accepted: 0, rejected: [] };

    const existing = new Set(this.queuedFiles.map((f) => `${f.file.name}:${f.file.size}`));
    let accepted = 0;
    const rejected: string[] = [];

    for (const file of Array.from(files)) {
      if (!this.isPdf(file)) {
        rejected.push(file.name);
        continue;
      }
      const key = `${file.name}:${file.size}`;
      if (!existing.has(key)) {
        this.queuedFiles.push(this.createFileEntry(file, defaults));
        accepted += 1;
      }
    }

    return { accepted, rejected };
  }

  removeQueued(id: string): void {
    this.queuedFiles = this.queuedFiles.filter((f) => f.id !== id);
  }

  removeDone(): void {
    this.queuedFiles = this.queuedFiles.filter((f) => f.status !== 'done');
  }

  updateMetadataField(id: string, field: UploadMetadataField, value: string): void {
    const item = this.queuedFiles.find((f) => f.id === id);
    if (!item) return;
    if (field === 'line') item.line = String(value || '').trim();
    if (field === 'lang') item.lang = value as UploadDefaults['lang'];
    if (field === 'docType') item.docType = value as UploadDefaults['docType'];
    if (field === 'date') item.date = String(value || '').trim();
  }

  canPublish(): boolean {
    return (
      !this.queuedFiles.some((f) => f.status === 'uploading') &&
      this.queuedFiles.every((f) => Boolean(f.line && f.lang && f.docType && f.date)) &&
      this.queuedFiles.length > 0
    );
  }

  async uploadAll(): Promise<UploadBatchResult> {
    this.queuedFiles.forEach((f) => {
      f.status = 'uploading';
      f.message = undefined;
    });

    let successCount = 0;
    let errorCount = 0;

    for (const queuedFile of this.queuedFiles) {
      try {
        const payload: SimplePublishPayload = {
          line: queuedFile.line,
          lang: queuedFile.lang as UploadMetadata['lang'],
          docType: queuedFile.docType as UploadMetadata['docType'],
          date: queuedFile.date,
          fileName: queuedFile.file.name,
          contentBase64: await this.readFileAsBase64(queuedFile.file),
          githubToken: '__server__',
          repoOwner: '',
          repoName: '',
          branch: ''
        };

        await this.documentsApi.publishSimpleDocument(payload);
        queuedFile.status = 'done';
        queuedFile.message = 'Salvato in latest + legacy';
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

  private createFileEntry(file: File, defaults: UploadDefaults): QueuedFile {
    return {
      id: `file-${++this.fileCounter}`,
      file,
      line: defaults.line,
      lang: defaults.lang,
      docType: defaults.docType,
      date: defaults.date,
      status: 'pending'
    };
  }

  private isPdf(file: File): boolean {
    const byType = file.type === 'application/pdf';
    const byName = /\.pdf$/i.test(file.name);
    return byType || byName;
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
