import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { DocumentsListComponent } from '../../components/documents-list/documents-list.component';
import { DocumentDto } from '../../services/api.models';
import { AuthService } from '../../services/auth.service';
import { AppLinksService } from '../../services/app-links.service';
import { ConfigApiService } from '../../services/config-api.service';
import { DocumentsApiService } from '../../services/documents-api.service';
import { LatestIndexQueryService } from '../../services/latest-index-query.service';

@Component({
  selector: 'app-documents-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DocumentsListComponent],
  templateUrl: './documents-page.component.html'
})
export class DocumentsPageComponent {
  private readonly configApi = inject(ConfigApiService);
  private readonly documentsApi = inject(DocumentsApiService);
  private readonly latestIndexQuery = inject(LatestIndexQueryService);
  private readonly appLinks = inject(AppLinksService);
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
    return this.appLinks.publicDocsPageUrl;
  }

  get legalPublicRepoUrl(): string {
    return this.appLinks.legalPublicRepoUrl;
  }

  /** Manages reversible document publication for admin and dev users. */
  async onSoftDelete(ids: string[]): Promise<void> {
    if (!this.canDelete || this.loading || !ids || ids.length === 0) return;
    if (!confirm(`Ritirare ${ids.length} documenti? La CI li escluderà da indice e sito pubblico, mantenendoli nel repository.`)) return;

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
      this.statusMessage = `✓ Ritiro di ${count} documenti richiesto. Attendi la CI, poi aggiorna la lista.`;
      await this.loadDocuments();
    } catch (error: unknown) {
      this.statusMessage = this.formatApiError(error);
    } finally {
      this.loading = false;
    }
  }

  /** Manages reversible document publication for admin and dev users. */
  async onRestore(ids: string[]): Promise<void> {
    if (!this.canDelete || this.loading || !ids || ids.length === 0) return;
    if (!confirm(`Ripristinare ${ids.length} documenti?`)) return;

    this.loading = true;
    this.statusMessage = '';
    try {
      const payloads = this.deletedDocuments
        .filter((doc) => ids.includes(doc.id))
        .map((doc) => ({ platform: doc.platform, docType: doc.docType, lang: doc.lang }));
      await this.documentsApi.restoreDocuments(payloads);
      const count = payloads.length;
      this.statusMessage = `✓ Ripristino di ${count} documenti richiesto. Attendi la CI, poi aggiorna la lista.`;
      await this.loadDocuments();
    } catch (error: unknown) {
      this.statusMessage = this.formatApiError(error);
    } finally {
      this.loading = false;
    }
  }

  private async loadConfig(): Promise<void> {
    try {
      const cfg = await firstValueFrom(this.configApi.getInfraConfig());
      this.languages = cfg.languages?.length ? cfg.languages : this.languages;
    } catch {}
  }

  /** Reloads the authoritative index after a CI run completes. */
  async loadDocuments(): Promise<void> {
    const formValue = this.filterForm.getRawValue();
    try {
      const response = await firstValueFrom(
        this.latestIndexQuery.getDocuments({
          search: formValue.search || undefined,
          line: formValue.line || undefined,
          docType: formValue.docType || undefined,
          lang: formValue.lang || undefined,
          includeDeleted: this.canDelete
        })
      );
      this.documents = (response.documents || []).filter((d) => !d.deletedAt);
      this.deletedDocuments = (response.documents || []).filter((d) => d.deletedAt);
      const all = [...this.documents, ...this.deletedDocuments];
      this.lines = Array.from(new Set(all.map((d) => String(d.line || '-')))).sort((a, b) =>
        a.localeCompare(b)
      );
    } catch (error: unknown) {
      this.statusMessage = this.formatApiError(error);
    }
  }

  /** Resolves the repository path from the public document URL. */
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

  /** Displays session and workflow failures without claiming publication succeeded. */
  private formatApiError(value: unknown): string {
    const error = value as { status?: number; error?: { error?: string; message?: string }; message?: string };
    const status = Number(error?.status || 0);
    if (status === 401 || status === 403) {
      return 'Errore: sessione scaduta o ruolo non autorizzato. Accedi nuovamente.';
    }
    const message = String(error?.error?.error || error?.error?.message || error?.message || '').trim();
    return `Errore: ${message || 'sconosciuto'}`;
  }
}
