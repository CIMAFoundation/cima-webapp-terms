import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { DocumentsListComponent } from '../../components/documents-list/documents-list.component';
import { DocumentDto } from '../../services/api.models';
import { AuthService } from '../../services/auth.service';
import { ConfigApiService } from '../../services/config-api.service';
import { DocumentsApiService } from '../../services/documents-api.service';
import { ManifestQueryService } from '../../services/manifest-query.service';
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
  private readonly manifestQuery = inject(ManifestQueryService);
  private readonly runtimeConfig = inject(RuntimeConfigService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly filterForm = this.fb.group({
    search: [''],
    line: [''],
    docType: [''],
    lang: ['']
  });

  documents: DocumentDto[] = [];
  deletedDocuments: DocumentDto[] = [];
  lines: string[] = [];
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
    return this.auth.canViewConfiguration();
  }

  get publicReferenceUrl(): string {
    return this.runtimeConfig.getGithubRepoConfig().publicBaseUrl.trim();
  }

  async onSoftDelete(ids: string[]): Promise<void> {
    if (!ids || ids.length === 0) return;
    if (!confirm(`Vuoi spostare nel cestino ${ids.length} documenti?\nSolo una conferma necessaria.`)) return;

    this.loading = true;
    this.statusMessage = '';
    try {
      const payloads: Array<{
        platform: string;
        docType: 'terms' | 'privacy' | 'cookie';
        lang: string;
        filePath: string;
      }> = [];
      for (const id of ids) {
        const doc = this.documents.find((d) => d.id === id);
        if (!doc) continue;
        const filePath = this.extractFilePath(doc.downloadUrl);
        payloads.push({
          platform: doc.platform,
          docType: doc.docType,
          lang: doc.lang,
          filePath
        });
      }
      await this.documentsApi.softDeleteDocuments(payloads);
      const count = payloads.length;
      this.statusMessage = `✓ ${count} documenti spostati nel cestino.`;
      await this.loadDocuments();
    } catch (error: any) {
      this.statusMessage = this.formatApiError(error);
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
      let count = 0;
      for (const id of ids) {
        const doc = this.deletedDocuments.find((d) => d.id === id);
        if (!doc) continue;
        await this.documentsApi.restoreDocument({
          platform: doc.platform,
          docType: doc.docType,
          lang: doc.lang
        });
        count++;
      }
      this.statusMessage = `✓ ${count} documenti ripristinati.`;
      await this.loadDocuments();
    } catch (error: any) {
      this.statusMessage = this.formatApiError(error);
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
      let count = 0;
      for (const id of ids) {
        const doc = this.deletedDocuments.find((d) => d.id === id) || this.documents.find((d) => d.id === id);
        if (!doc) continue;
        const filePath = this.extractFilePath(doc.downloadUrl);
        await this.documentsApi.hardDeleteDocument({
          platform: doc.platform,
          docType: doc.docType,
          lang: doc.lang,
          filePath
        });
        count++;
      }
      this.statusMessage = `✓ ${count} documenti eliminati definitivamente.`;
      await this.loadDocuments();
    } catch (error: any) {
      this.statusMessage = this.formatApiError(error);
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
      this.languages = cfg.languages?.length ? cfg.languages : this.languages;
    } catch {}
  }

  private async loadDocuments(): Promise<void> {
    const formValue = this.filterForm.getRawValue();
    const response = await firstValueFrom(
      this.manifestQuery.getDocuments({
        search: formValue.search || undefined,
        line: formValue.line || undefined,
        docType: formValue.docType || undefined,
        lang: formValue.lang || undefined,
        includeDeleted: true
      })
    );
    this.documents = (response.documents || []).filter((d) => !d.deletedAt);
    this.deletedDocuments = (response.documents || []).filter((d) => d.deletedAt);
    const all = [...this.documents, ...this.deletedDocuments];
    this.lines = Array.from(new Set(all.map((d) => String(d.line || '-')))).sort((a, b) =>
      a.localeCompare(b)
    );
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

  private formatApiError(error: any): string {
    const status = Number(error?.status || 0);
    if (status === 401 || status === 403) {
      return 'Errore: backend admin non autorizzato a GitHub (controlla token server-side).';
    }
    const message = String(error?.error?.message || error?.message || '').trim();
    return `Errore: ${message || 'sconosciuto'}`;
  }
}
