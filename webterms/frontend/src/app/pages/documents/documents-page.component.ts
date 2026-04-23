import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { DocumentsListComponent } from '../../components/documents-list/documents-list.component';
import { DocumentDto, PlatformOption } from '../../services/api.models';
import { AuthService } from '../../services/auth.service';
import { ConfigApiService } from '../../services/config-api.service';
import { DocumentsApiService } from '../../services/documents-api.service';
import { RuntimeConfigService } from '../../services/runtime-config.service';

@Component({
  selector: 'app-documents-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DocumentsListComponent],
  templateUrl: './documents-page.component.html'
})
export class DocumentsPageComponent {
  private readonly configApi = inject(ConfigApiService);
  private readonly documentsApi = inject(DocumentsApiService);
  private readonly runtimeConfig = inject(RuntimeConfigService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly filterForm = this.fb.group({
    search: [''],
    platform: [''],
    docType: [''],
    lang: ['']
  });

  documents: DocumentDto[] = [];
  deletedDocuments: DocumentDto[] = [];
  platforms: PlatformOption[] = [];
  languages = ['it', 'en', 'fr', 'es', 'pt'];
  showDeleted = false;
  loading = false;
  statusMessage = '';

  constructor() {
    this.loadConfig();
    this.loadDocuments();
    this.filterForm.valueChanges.subscribe(() => this.loadDocuments());
  }

  get canDelete(): boolean {
    return this.auth.canEditConfiguration();
  }

  async onSoftDelete(ids: string[]): Promise<void> {
    if (!ids || ids.length === 0) return;
    if (!confirm(`Vuoi spostare nel cestino ${ids.length} documeni?\nSolo una conferma necessaria.`)) return;

    this.loading = true;
    this.statusMessage = '';
    try {
      const github = this.runtimeConfig.getGithubRepoConfig();
      let count = 0;
      for (const id of ids) {
        const doc = this.documents.find((d) => d.id === id);
        if (!doc) continue;
        const filePath = this.extractFilePath(doc.downloadUrl);
        await this.documentsApi.softDeleteDocument({
          platform: doc.platform,
          docType: doc.docType,
          lang: doc.lang,
          githubToken: this.runtimeConfig.getGithubToken(),
          repoOwner: github.owner,
          repoName: github.repo,
          branch: github.branch,
          manifestPath: github.manifestPath,
          filePath
        });
        count++;
      }
      this.statusMessage = `✓ ${count} documenti spostati nel cestino.`;
      await this.loadDocuments();
    } catch (error: any) {
      this.statusMessage = `Errore: ${error?.message || 'sconosciuto'}`;
    } finally {
      this.loading = false;
    }
  }

  async onRestore(ids: string[]): Promise<void> {
    if (!ids || ids.length === 0) return;
    if (!confirm(`Ripristinare ${ids.length} documenti?`)) return;

    this.loading = true;
    this.statusMessage = '';
    try {
      const github = this.runtimeConfig.getGithubRepoConfig();
      let count = 0;
      for (const id of ids) {
        const doc = this.deletedDocuments.find((d) => d.id === id);
        if (!doc) continue;
        await this.documentsApi.restoreDocument({
          platform: doc.platform,
          docType: doc.docType,
          lang: doc.lang,
          githubToken: this.runtimeConfig.getGithubToken(),
          repoOwner: github.owner,
          repoName: github.repo,
          branch: github.branch,
          manifestPath: github.manifestPath
        });
        count++;
      }
      this.statusMessage = `✓ ${count} documenti ripristinati.`;
      await this.loadDocuments();
    } catch (error: any) {
      this.statusMessage = `Errore: ${error?.message || 'sconosciuto'}`;
    } finally {
      this.loading = false;
    }
  }

  async onHardDelete(ids: string[]): Promise<void> {
    if (!ids || ids.length === 0) return;
    const confirmed = confirm(
      `⚠️ ELIMINAZIONE DEFINITIVA di ${ids.length} file\n\n` +
      `Questa azione  IRREVERSIBILE. I file verranno rimossi da GitHub.\n\n` +
      `Confermi?`
    );
    if (!confirmed) return;

    this.loading = true;
    this.statusMessage = '';
    try {
      const github = this.runtimeConfig.getGithubRepoConfig();
      let count = 0;
      for (const id of ids) {
        const doc = this.deletedDocuments.find((d) => d.id === id);
        if (!doc) continue;
        const filePath = this.extractFilePath(doc.downloadUrl);
        await this.documentsApi.hardDeleteDocument({
          platform: doc.platform,
          docType: doc.docType,
          lang: doc.lang,
          githubToken: this.runtimeConfig.getGithubToken(),
          repoOwner: github.owner,
          repoName: github.repo,
          branch: github.branch,
          manifestPath: github.manifestPath,
          filePath
        });
        count++;
      }
      this.statusMessage = `✓ ${count} documenti eliminati definitivamente.`;
      await this.loadDocuments();
    } catch (error: any) {
      this.statusMessage = `Errore: ${error?.message || 'sconosciuto'}`;
    } finally {
      this.loading = false;
    }
  }

  toggleShowDeleted(): void {
    this.showDeleted = !this.showDeleted;
  }

  private async loadConfig(): Promise<void> {
    try {
      const cfg = await firstValueFrom(this.configApi.getInfraConfig());
      this.platforms = cfg.platforms || [];
      this.languages = cfg.languages?.length ? cfg.languages : this.languages;
    } catch {
      this.platforms = [];
    }
  }

  private async loadDocuments(): Promise<void> {
    const formValue = this.filterForm.getRawValue();
    const response = await firstValueFrom(
      this.documentsApi.getDocuments(this.runtimeConfig.getManifestUrl(), {
        search: formValue.search || undefined,
        platform: formValue.platform || undefined,
        docType: formValue.docType || undefined,
        lang: formValue.lang || undefined,
        includeDeleted: true
      })
    );
    this.documents = (response.documents || []).filter((d) => !d.deletedAt);
    this.deletedDocuments = (response.documents || []).filter((d) => d.deletedAt);
  }

  private extractFilePath(downloadUrl: string): string {
    // Extract path after /cima-legal-public-docs/
    const pagesMatch = downloadUrl.match(/cimafoundation\.github\.io\/cima-legal-public-docs\/(.+)/);
    if (pagesMatch) {
      return pagesMatch[1];
    }

    // Extract path after /raw.githubusercontent.com/{owner}/{repo}/{branch}/ (legacy/fallback)
    const rawMatch = downloadUrl.match(/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/[^/]+\/(.+)/);
    return rawMatch ? rawMatch[1] : '';
  }
}
