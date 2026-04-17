import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, AbstractControl, FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { PlatformOption } from '../../services/api.models';
import { AuthService } from '../../services/auth.service';
import { ConfigApiService } from '../../services/config-api.service';
import { DocumentsApiService } from '../../services/documents-api.service';
import { RuntimeConfigService } from '../../services/runtime-config.service';

interface QueuedFile {
  id: string;
  file: File;
  platform: string;
  docType: 'terms' | 'privacy' | 'cookie';
  lang: string;
  effectiveDate: string;
  status: 'pending' | 'uploading' | 'done' | 'error';
  message?: string;
}

@Component({
  selector: 'app-upload-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, FormsModule],
  templateUrl: './upload-page.component.html',
  styleUrl: './upload-page.component.scss'
})
export class UploadPageComponent {
  private readonly configApi = inject(ConfigApiService);
  private readonly documentsApi = inject(DocumentsApiService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly runtimeConfig = inject(RuntimeConfigService);

  readonly githubForm = this.fb.group({
    manifestUrl: [this.runtimeConfig.getManifestUrl(), Validators.required],
    githubToken: [this.runtimeConfig.getGithubToken(), Validators.required],
    repoOwner: [this.runtimeConfig.getGithubRepoConfig().owner, Validators.required],
    repoName: [this.runtimeConfig.getGithubRepoConfig().repo, Validators.required],
    branch: [this.runtimeConfig.getGithubRepoConfig().branch, Validators.required],
    documentsRootPath: [this.runtimeConfig.getGithubRepoConfig().documentsRootPath, Validators.required],
    manifestPath: [this.runtimeConfig.getGithubRepoConfig().manifestPath, Validators.required],
    publicBaseUrl: [this.runtimeConfig.getGithubRepoConfig().publicBaseUrl, Validators.required]
  });

  queuedFiles: QueuedFile[] = [];
  dragActive = false;
  showGithubConfig = false;
  submitAttempted = false;
  platformOptions: PlatformOption[] = [];
  langOptions = ['it', 'en', 'fr', 'es', 'pt'];
  private fileCounter = 0;

  constructor() {
    if (!this.auth.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }
    this.loadConfig();
  }

  onPickFiles(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.addFiles(input.files);
    input.value = '';
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragActive = false;
    this.addFiles(event.dataTransfer?.files ?? null);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragActive = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragActive = false;
  }

  toggleGithubConfig(): void {
    if (!this.canViewGithubConfig) return;
    this.showGithubConfig = !this.showGithubConfig;
  }

  saveGithubSettings(): void {
    if (!this.canEditGithubConfig) return;
    const cfg = this.githubForm.getRawValue();
    this.runtimeConfig.setManifestUrl(String(cfg.manifestUrl || ''));
    this.runtimeConfig.setGithubToken(String(cfg.githubToken || ''));
    this.runtimeConfig.setGithubRepoConfig({
      owner: String(cfg.repoOwner || ''),
      repo: String(cfg.repoName || ''),
      branch: String(cfg.branch || ''),
      documentsRootPath: String(cfg.documentsRootPath || ''),
      manifestPath: String(cfg.manifestPath || ''),
      publicBaseUrl: String(cfg.publicBaseUrl || '')
    });
  }

  createFileEntry(file: File): QueuedFile {
    const defaultPlatform = this.platformOptions[0]?.id || '';
    return {
      id: `file-${++this.fileCounter}`,
      file,
      platform: defaultPlatform,
      docType: 'terms',
      lang: 'it',
      effectiveDate: this.getTodayDate(),
      status: 'pending'
    };
  }

  removeQueued(id: string): void {
    this.queuedFiles = this.queuedFiles.filter((f) => f.id !== id);
  }

  async uploadAll(): Promise<void> {
    this.submitAttempted = true;

    if (!this.canPublish) return;

    this.saveGithubSettings();
    const github = this.githubForm.getRawValue();

    this.queuedFiles.forEach((f) => {
      f.status = 'uploading';
      f.message = undefined;
    });

    for (const queuedFile of this.queuedFiles) {
      try {
        const payload = {
          platform: queuedFile.platform,
          docType: queuedFile.docType,
          lang: queuedFile.lang,
          effectiveDate: queuedFile.effectiveDate,
          fileName: queuedFile.file.name,
          contentBase64: await this.readFileAsBase64(queuedFile.file),
          githubToken: String(github.githubToken || ''),
          repoOwner: String(github.repoOwner || ''),
          repoName: String(github.repoName || ''),
          branch: String(github.branch || ''),
          documentsRootPath: String(github.documentsRootPath || ''),
          manifestPath: String(github.manifestPath || ''),
          publicBaseUrl: String(github.publicBaseUrl || '')
        };
        const published = await this.documentsApi.publishDocument(payload);
        queuedFile.status = 'done';
        queuedFile.message = `Pubblicato v${String(published.version).padStart(3, '0')}`;
      } catch (error: any) {
        queuedFile.status = 'error';
        const backendError = String(error?.error?.message || error?.error || '').trim();
        queuedFile.message = backendError || `Errore (status ${error?.status || '?'})`;
      }
    }

    setTimeout(() => {
      this.queuedFiles = this.queuedFiles.filter((f) => f.status !== 'done');
    }, 2000);
  }

  private getTodayDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  private async loadConfig(): Promise<void> {
    try {
      const cfg = await firstValueFrom(this.configApi.getInfraConfig());
      this.platformOptions = cfg.platforms || [];
      this.langOptions = cfg.languages?.length ? cfg.languages : this.langOptions;
    } catch {
      this.platformOptions = [];
    }
  }

  private addFiles(files: FileList | null): void {
    if (!files?.length) return;
    const existing = new Set(this.queuedFiles.map((f) => `${f.file.name}:${f.file.size}`));
    for (const file of Array.from(files)) {
      const key = `${file.name}:${file.size}`;
      if (!existing.has(key)) {
        this.queuedFiles.push(this.createFileEntry(file));
      }
    }
  }

  private readFileAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? '').split(',')[1] ?? '');
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  get canPublish(): boolean {
    return (
      !this.queuedFiles.some((f) => f.status === 'uploading') &&
      this.githubForm.valid &&
      this.queuedFiles.length > 0 &&
      this.queuedFiles.every((f) => f.platform && f.effectiveDate)
    );
  }

  hasGithubError(controlName: string): boolean {
    const control = this.githubForm.get(controlName) as AbstractControl | null;
    return Boolean(control?.invalid && (control.touched || this.submitAttempted));
  }

  get canViewGithubConfig(): boolean {
    return this.auth.canViewConfiguration();
  }

  get canEditGithubConfig(): boolean {
    return this.auth.canEditConfiguration();
  }

  trackById(_: number, item: QueuedFile): string {
    return item.id;
  }
}
