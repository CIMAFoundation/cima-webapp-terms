import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { PublicLatestEntry } from '../../services/api.models';
import { AppLinksService } from '../../services/app-links.service';
import { LatestIndexQueryService } from '../../services/latest-index-query.service';

interface OfficialRow {
  line: string;
  platform: string;
  docType: string;
  lang: string;
  effectiveDate: string;
  publicUrl: string;
  downloadUrl: string;
  downloadFileName: string;
}

@Component({
  selector: 'app-official-documents-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './official-documents-page.component.html'
})
export class OfficialDocumentsPageComponent {
  private readonly latestIndexQuery = inject(LatestIndexQueryService);
  private readonly appLinks = inject(AppLinksService);

  rows: OfficialRow[] = [];

  get publicReferenceUrl(): string {
    return this.appLinks.publicDocsPageUrl;
  }

  get legalPublicRepoUrl(): string {
    return this.appLinks.legalPublicRepoUrl;
  }

  constructor() {
    this.load();
  }

  trackByKey(_: number, row: OfficialRow): string {
    return `${row.platform}-${row.docType}-${row.lang}-${row.line}`;
  }

  formatEffectiveDate(value: string): string {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return value || '-';
    return `${match[3]}/${match[2]}/${match[1]}`;
  }

  private async load(): Promise<void> {
    const response = await firstValueFrom(this.latestIndexQuery.getPublicLatest());
    const flattened: OfficialRow[] = [];
    const latest = response.latest || {};
    for (const platform of Object.keys(latest)) {
      for (const docType of Object.keys(latest[platform] || {})) {
        for (const lang of Object.keys(latest[platform][docType] || {})) {
          const entry = latest[platform][docType][lang] as PublicLatestEntry;
          if (entry.deletedAt) continue;
          flattened.push({
            line: entry.line || '-',
            platform,
            docType,
            lang,
            effectiveDate: entry.effectiveDate,
            publicUrl: entry.url,
            downloadUrl: entry.downloadUrl,
            downloadFileName: entry.downloadFileName || entry.originalFileName || entry.id
          });
        }
      }
    }
    this.rows = flattened.sort((a, b) => {
      const lineCmp = a.line.localeCompare(b.line);
      if (lineCmp !== 0) return lineCmp;
      const platformCmp = a.platform.localeCompare(b.platform);
      if (platformCmp !== 0) return platformCmp;
      const typeCmp = a.docType.localeCompare(b.docType);
      if (typeCmp !== 0) return typeCmp;
      return a.lang.localeCompare(b.lang);
    });
  }
}
