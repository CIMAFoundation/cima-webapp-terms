import { CommonModule } from '@angular/common';
import { Component, OnDestroy, inject } from '@angular/core';
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
import { GithubActionsService, GithubWorkflowRun } from '../../services/github-actions.service';
import { RuntimeConfigService } from '../../services/runtime-config.service';
import { UploadFacadeService } from '../../services/upload-facade.service';

type PublishMonitorState = 'idle' | 'polling' | 'success' | 'failure' | 'timeout' | 'error';

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
export class UploadPageComponent implements OnDestroy {
  private readonly configApi = inject(ConfigApiService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly runtimeConfig = inject(RuntimeConfigService);
  private readonly githubActions = inject(GithubActionsService);

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

  publishMonitorState: PublishMonitorState = 'idle';
  publishMonitorMessage = '';
  latestRunUrl = '';
  private pollStartTs = 0;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    if (!this.auth.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }
    this.loadConfig();
  }

  ngOnDestroy(): void {
    this.clearActionsPolling();
  }

  get canPublish(): boolean {
    return this.uploadFacade.canPublish(this.githubForm.valid);
  }

  get actionsPageUrl(): string {
    const cfg = this.githubForm.getRawValue();
    return `https://github.com/${cfg.repoOwner}/${cfg.repoName}/actions`;
  }

  get isPublishMonitorVisible(): boolean {
    return this.publishMonitorState !== 'idle';
  }

  get isPollingActions(): boolean {
    return this.publishMonitorState === 'polling';
  }

  get canHardRefresh(): boolean {
    return (
      this.publishMonitorState === 'success' ||
      this.publishMonitorState === 'failure' ||
      this.publishMonitorState === 'timeout' ||
      this.publishMonitorState === 'error'
    );
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
      this.startActionsPolling();
    } else if (result.successCount > 0 && result.errorCount > 0) {
      this.showSnackbar(`${result.errorCount} errori su ${this.uploadFacade.queuedFiles.length} file`, 'error');
      this.startActionsPolling();
    } else if (result.errorCount > 0) {
      this.showSnackbar(`${result.errorCount} errori su ${this.uploadFacade.queuedFiles.length} file`, 'error');
      this.resetPublishMonitor();
    }

    setTimeout(() => {
      this.uploadFacade.removeDone();
    }, 3000);
  }

  hardRefreshApp(): void {
    this.runtimeConfig.clearCachedManifest();
    window.location.reload();
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

  private resetPublishMonitor(): void {
    this.clearActionsPolling();
    this.publishMonitorState = 'idle';
    this.publishMonitorMessage = '';
    this.latestRunUrl = '';
  }

  private startActionsPolling(): void {
    this.clearActionsPolling();

    this.publishMonitorState = 'polling';
    this.publishMonitorMessage = 'Pubblicazione in corso su GitHub Actions. Attendo completamento...';
    this.latestRunUrl = '';
    this.pollStartTs = Date.now();

    void this.checkActionsStatus();
    this.pollTimer = setInterval(() => {
      void this.checkActionsStatus();
    }, 12000);
  }

  private clearActionsPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private isRelevantRun(run: GithubWorkflowRun): boolean {
    const name = String(run.name || '').toLowerCase();
    return name.includes('publish manifest');
  }

  private async checkActionsStatus(): Promise<void> {
    const timeoutMs = 12 * 60 * 1000;
    if (Date.now() - this.pollStartTs > timeoutMs) {
      this.publishMonitorState = 'timeout';
      this.publishMonitorMessage =
        'Tempo di attesa superato. Puoi aprire le Actions e poi usare Aggiorna ora quando il run termina.';
      this.clearActionsPolling();
      return;
    }

    const cfg = this.githubForm.getRawValue();
    const owner = String(cfg.repoOwner || '');
    const repo = String(cfg.repoName || '');
    const branch = String(cfg.branch || 'main');
    const token = String(cfg.githubToken || '');

    try {
      const runs = await this.githubActions.getWorkflowRuns({ owner, repo, branch, token, perPage: 25 });
      const relevantRuns = runs.filter((run) => this.isRelevantRun(run));
      if (!relevantRuns.length) {
        this.publishMonitorMessage = 'Nessun run trovato al momento. Continuo a controllare...';
        return;
      }

      const inProgress = relevantRuns.find((run) => run.status !== 'completed');
      if (inProgress) {
        this.latestRunUrl = inProgress.html_url;
        this.publishMonitorMessage =
          `Workflow in esecuzione (${inProgress.status}). I file saranno visibili al termine.`;
        return;
      }

      const latestCompleted = relevantRuns[0];
      this.latestRunUrl = latestCompleted.html_url;
      const completedTs = Date.parse(latestCompleted.updated_at);
      const isRunAfterUpload = completedTs >= this.pollStartTs - 120000;

      if (!isRunAfterUpload) {
        this.publishMonitorMessage = 'Run completato precedente all\'upload corrente. Attendo il prossimo...';
        return;
      }

      if (latestCompleted.conclusion === 'success') {
        this.publishMonitorState = 'success';
        this.publishMonitorMessage =
          'Workflow completato con successo. Ora puoi fare Aggiorna ora per ricaricare i dati.';
      } else {
        this.publishMonitorState = 'failure';
        this.publishMonitorMessage =
          `Workflow completato con esito: ${latestCompleted.conclusion || 'unknown'}. Verifica il log Actions.`;
      }
      this.clearActionsPolling();
    } catch {
      this.publishMonitorState = 'error';
      this.publishMonitorMessage =
        'Impossibile leggere lo stato Actions via API. Usa il link alle Actions e poi Aggiorna ora.';
      this.clearActionsPolling();
    }
  }
}
