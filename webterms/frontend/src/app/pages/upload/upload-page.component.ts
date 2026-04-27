import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { UploadDropzoneComponent } from '../../components/upload/upload-dropzone.component';
import {
  UploadSnackbarComponent,
  UploadSnackbarMessage
} from '../../components/upload/upload-snackbar.component';
import { UploadQueueTableComponent } from '../../components/upload/upload-queue-table.component';
import { PlatformOption } from '../../services/api.models';
import { AuthService } from '../../services/auth.service';
import { ConfigApiService } from '../../services/config-api.service';
import { RuntimeConfigService } from '../../services/runtime-config.service';
import { UploadFacadeService } from '../../services/upload-facade.service';

@Component({
  selector: 'app-upload-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    UploadSnackbarComponent,
    UploadDropzoneComponent,
    UploadQueueTableComponent
  ],
  providers: [UploadFacadeService],
  templateUrl: './upload-page.component.html'
})
export class UploadPageComponent {
  private readonly configApi = inject(ConfigApiService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly runtimeConfig = inject(RuntimeConfigService);

  readonly uploadFacade = inject(UploadFacadeService);

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

  showGithubConfig = false;
  submitAttempted = false;
  platformOptions: PlatformOption[] = [];
  langOptions = ['it', 'en', 'fr', 'es', 'pt'];
  snackbar: UploadSnackbarMessage | null = null;
  private snackbarTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    if (!this.auth.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }
    this.loadConfig();
  }

  get canPublish(): boolean {
    return this.uploadFacade.canPublish(this.githubForm.valid);
  }

  private showSnackbar(text: string, type: 'success' | 'error' | 'info' = 'success'): void {
    if (this.snackbarTimeout) {
      clearTimeout(this.snackbarTimeout);
    }
    this.snackbar = { text, type };
    this.snackbarTimeout = setTimeout(() => {
      this.snackbar = null;
    }, 4000);
  }

  onFilesSelected(files: FileList | null): void {
    this.uploadFacade.addFiles(files);
  }

  onRemoveQueued(id: string): void {
    this.uploadFacade.removeQueued(id);
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
    this.showSnackbar('Configurazione salvata', 'success');
  }

  exportConfig(): void {
    if (!this.canEditGithubConfig) return;

    const config = {
      manifestUrl: this.runtimeConfig.getManifestUrl(),
      githubToken: this.runtimeConfig.getGithubToken(),
      githubRepoConfig: this.runtimeConfig.getGithubRepoConfig()
    };

    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `webterms-config-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.showSnackbar('Configurazione esportata', 'success');
  }

  importConfig(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const config = JSON.parse(e.target?.result as string);

        if (config.manifestUrl) this.runtimeConfig.setManifestUrl(config.manifestUrl);
        if (config.githubToken) this.runtimeConfig.setGithubToken(config.githubToken);
        if (config.githubRepoConfig) this.runtimeConfig.setGithubRepoConfig(config.githubRepoConfig);

        this.githubForm.patchValue({
          manifestUrl: config.manifestUrl || this.runtimeConfig.getManifestUrl(),
          githubToken: config.githubToken || '',
          ...config.githubRepoConfig
        });

        this.showSnackbar('Configurazione importata', 'success');
      } catch {
        this.showSnackbar('File non valido', 'error');
      }
    };
    reader.readAsText(file);
    input.value = '';
  }

  async uploadAll(): Promise<void> {
    this.submitAttempted = true;

    if (!this.canPublish) {
      this.showSnackbar('Compila tutti i campi richiesti', 'error');
      return;
    }

    this.saveGithubSettings();
    const github = this.githubForm.getRawValue();

    const result = await this.uploadFacade.uploadAll({
      githubToken: String(github.githubToken || ''),
      repoOwner: String(github.repoOwner || ''),
      repoName: String(github.repoName || ''),
      branch: String(github.branch || ''),
      documentsRootPath: String(github.documentsRootPath || ''),
      manifestPath: String(github.manifestPath || ''),
      publicBaseUrl: String(github.publicBaseUrl || '')
    });

    if (result.successCount > 0 && result.errorCount === 0) {
      this.showSnackbar(`${result.successCount} file pubblicati`, 'success');
    } else if (result.errorCount > 0) {
      this.showSnackbar(`${result.errorCount} errori su ${this.uploadFacade.queuedFiles.length} file`, 'error');
    }

    setTimeout(() => {
      this.uploadFacade.removeDone();
    }, 3000);
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

  dismissSnackbar(): void {
    if (this.snackbarTimeout) {
      clearTimeout(this.snackbarTimeout);
    }
    this.snackbar = null;
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
}
