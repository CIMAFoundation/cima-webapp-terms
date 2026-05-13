import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { UploadDropzoneComponent } from '../../components/upload/upload-dropzone.component';
import {
  UploadSnackbarComponent,
  UploadSnackbarMessage
} from '../../components/upload/upload-snackbar.component';
import { UploadQueueTableComponent } from '../../components/upload/upload-queue-table.component';
import { AuthService } from '../../services/auth.service';
import { RuntimeConfigService } from '../../services/runtime-config.service';
import { UploadDocType } from '../../services/api.models';
import { UploadFacadeService } from '../../services/upload-facade.service';

type UploadLanguage = 'it' | 'en' | 'fr' | 'es' | 'pt';

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
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly runtimeConfig = inject(RuntimeConfigService);
  readonly uploadFacade = inject(UploadFacadeService);

  readonly lineOptions = [
    'mydewetra-world',
    'mydewetra-italy',
    'prevenzione-comune',
    'parco-cinque-terre',
    'seawetra',
    'bricks-dev'
  ];
  readonly langOptions: UploadLanguage[] = ['it', 'en', 'fr', 'es', 'pt'];
  readonly docTypeOptions: UploadDocType[] = ['privacy-policy', 'cookie-policy', 'terms-of-use'];

  readonly metadataForm = this.fb.group({
    line: ['', Validators.required],
    lang: ['', Validators.required],
    docType: ['', Validators.required],
    date: [this.getTodayDate(), Validators.required]
  });

  submitAttempted = false;
  snackbar: UploadSnackbarMessage | null = null;
  private snackbarTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    if (!this.auth.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }
  }

  get canPublish(): boolean {
    return this.uploadFacade.canPublish(this.metadataForm.valid);
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

  hasMetadataError(controlName: string): boolean {
    const control = this.metadataForm.get(controlName) as AbstractControl | null;
    return Boolean(control?.invalid && (control.touched || this.submitAttempted));
  }

  onFilesSelected(files: FileList | null): void {
    const result = this.uploadFacade.addFiles(files);
    if (result.rejected.length > 0) {
      this.showSnackbar(`Scartati file non PDF: ${result.rejected.join(', ')}`, 'error');
    } else if (result.accepted > 0) {
      this.showSnackbar(`${result.accepted} file aggiunti`, 'info');
    }
  }

  onRemoveQueued(id: string): void {
    this.uploadFacade.removeQueued(id);
  }

  async uploadAll(): Promise<void> {
    this.submitAttempted = true;
    if (!this.canPublish) {
      this.showSnackbar('Compila campi obbligatori e seleziona almeno un PDF', 'error');
      return;
    }

    const cfg = this.runtimeConfig.getGithubRepoConfig();
    const githubToken = this.runtimeConfig.getGithubToken();
    if (!githubToken) {
      this.showSnackbar('Token GitHub non configurato in localStorage', 'error');
      return;
    }

    const values = this.metadataForm.getRawValue();
    const line = String(values.line || '').trim();
    const lang = String(values.lang || '').trim() as UploadLanguage;
    const docType = String(values.docType || '').trim() as UploadDocType;
    const date = String(values.date || '').trim();

    const result = await this.uploadFacade.uploadAll(
      {
        githubToken,
        repoOwner: cfg.owner,
        repoName: cfg.repo,
        branch: cfg.branch
      },
      { line, lang, docType, date }
    );

    if (result.successCount > 0 && result.errorCount === 0) {
      this.showSnackbar(`${result.successCount} file salvati in latest + legacy`, 'success');
    } else if (result.successCount > 0 && result.errorCount > 0) {
      this.showSnackbar(`${result.errorCount} errori su ${this.uploadFacade.queuedFiles.length} file`, 'error');
    } else {
      this.showSnackbar(`${result.errorCount} errori su ${this.uploadFacade.queuedFiles.length} file`, 'error');
    }

    setTimeout(() => {
      this.uploadFacade.removeDone();
    }, 3000);
  }

  dismissSnackbar(): void {
    if (this.snackbarTimeout) {
      clearTimeout(this.snackbarTimeout);
    }
    this.snackbar = null;
  }

  private getTodayDate(): string {
    return new Date().toISOString().split('T')[0];
  }
}
