import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { PublicLatestEntry } from '../../services/api.models';
import { ManifestQueryService } from '../../services/manifest-query.service';
import { RuntimeConfigService } from '../../services/runtime-config.service';

interface OfficialRow {
  line: string;
  platform: string;
  docType: string;
  lang: string;
  version: number;
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
  private readonly manifestQuery = inject(ManifestQueryService);
  private readonly runtimeConfig = inject(RuntimeConfigService);

  rows: OfficialRow[] = [];

  get publicReferenceUrl(): string {
    return this.runtimeConfig.getGithubRepoConfig().publicBaseUrl.trim();
  }

  constructor() {
    this.load();
  }

  trackByKey(_: number, row: OfficialRow): string {
    return `${row.platform}-${row.docType}-${row.lang}-${row.line}`;
  }

  formatVersion(version: number): string {
    return `v${String(version).padStart(3, '0')}`;
  }

  formatEffectiveDate(value: string): string {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return value || '-';
    return `${match[3]}/${match[2]}/${match[1]}`;
  }

  private async load(): Promise<void> {
    const response = await firstValueFrom(this.manifestQuery.getPublicLatest());
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
            version: entry.version,
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
