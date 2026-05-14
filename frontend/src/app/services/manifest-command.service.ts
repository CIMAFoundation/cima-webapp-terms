import { Injectable, inject } from '@angular/core';
import {
  DeletePayload,
  PublicLatestEntry,
  PublicLatestResponse,
  PublishPayload,
  SimplePublishPayload,
  RestorePayload
} from './api.models';
import { GithubContentRepository } from './github-content.repository';
import { RuntimeConfigService } from './runtime-config.service';

interface HttpLikeError {
  status?: number;
}

interface LatestIndexRow {
  id: string;
  line: string;
  lang: string;
  docType: string;
  effectiveDate: string;
  publicUrl: string;
  downloadFileName: string;
}

interface LatestIndexPayload {
  generatedAt: string;
  rows: LatestIndexRow[];
}

@Injectable({ providedIn: 'root' })
export class ManifestCommandService {
  private readonly runtimeConfig = inject(RuntimeConfigService);
  private readonly githubRepo = inject(GithubContentRepository);
  private static readonly MAX_WRITE_RETRIES = 5;

  async publishDocument(payload: PublishPayload): Promise<{ version: number; filePath: string }> {
    const dateStr = payload.effectiveDate;
    const safeName = payload.fileName.replace(/[^a-zA-Z0-9.-]/g, '-').replace(/-+/g, '-');
    const sha256 = await this.computeSha256(payload.contentBase64);
    const extMatch = payload.fileName.match(/\.[0-9a-z]+$/i);
    const ext = extMatch ? extMatch[0] : '';
    let lastError: unknown;

    for (let attempt = 1; attempt <= ManifestCommandService.MAX_WRITE_RETRIES; attempt += 1) {
      try {
        const manifest = await this.fetchManifestForWrite(payload);
        const currentVersion =
          manifest.latest?.[payload.platform]?.[payload.docType]?.[payload.lang]?.version ?? 0;
        const nextVersion = currentVersion + 1;
        const versionTag = `v${String(nextVersion).padStart(3, '0')}`;

        const filePath = `${payload.documentsRootPath}/${payload.platform}/${payload.docType}/${payload.lang}/${dateStr}-${versionTag}-${safeName}`;
        const downloadUrl = `${payload.publicBaseUrl}/${filePath}`;

        const entry: PublicLatestEntry = {
          id: `${payload.platform}-${payload.docType}-${payload.lang}-${versionTag}`,
          line: payload.line || '-',
          version: nextVersion,
          effectiveDate: payload.effectiveDate,
          sha256,
          url: downloadUrl,
          downloadUrl,
          originalFileName: payload.fileName,
          downloadFileName: `${payload.platform}_${payload.docType}_${payload.lang}_${versionTag}${ext}`,
          deletedAt: undefined
        };

        const nextManifest: PublicLatestResponse = {
          latest: {
            ...(manifest.latest || {}),
            [payload.platform]: {
              ...(manifest.latest?.[payload.platform] || {}),
              [payload.docType]: {
                ...(manifest.latest?.[payload.platform]?.[payload.docType] || {}),
                [payload.lang]: entry
              }
            }
          }
        };

        await this.githubRepo.upsertFile({
          owner: payload.repoOwner,
          repo: payload.repoName,
          branch: payload.branch,
          path: filePath,
          contentBase64: payload.contentBase64,
          message: `docs: publish ${payload.platform}/${payload.docType}/${payload.lang} ${versionTag}`,
          token: payload.githubToken
        });

        await this.githubRepo.upsertFile({
          owner: payload.repoOwner,
          repo: payload.repoName,
          branch: payload.branch,
          path: payload.manifestPath,
          contentBase64: this.encodeUtf8ToBase64(JSON.stringify(nextManifest, null, 2) + '\n'),
          message: `docs: update manifest ${payload.platform}/${payload.docType}/${payload.lang} ${versionTag}`,
          token: payload.githubToken
        });

        this.runtimeConfig.clearCachedManifest();
        return { version: nextVersion, filePath };
      } catch (error) {
        lastError = error;
        if (!this.isRetryableConflict(error) || attempt === ManifestCommandService.MAX_WRITE_RETRIES) {
          break;
        }
        await this.waitMs(400 * attempt);
      }
    }

    if (this.isRetryableConflict(lastError)) {
      throw new Error(
        'Conflitto durante la pubblicazione del manifest. Riprova tra pochi secondi: e probabile una pubblicazione concorrente in corso.'
      );
    }

    throw lastError;
  }

  async publishSimpleDocument(
    payload: SimplePublishPayload
  ): Promise<{ latestPath: string; legacyPath: string }> {
    const dateStr = payload.date;
    const latestPath = `latest/${payload.line}/${payload.lang}/${payload.docType}.pdf`;
    const legacyPath = `legacy/${payload.line}/${payload.lang}/${payload.docType}_${dateStr}.pdf`;
    const latestIndexPath = 'assets/latest-index.json';

    await this.githubRepo.upsertFile({
      owner: payload.repoOwner,
      repo: payload.repoName,
      branch: payload.branch,
      path: latestPath,
      contentBase64: payload.contentBase64,
      message: `docs: latest ${payload.line}/${payload.lang}/${payload.docType}`,
      token: payload.githubToken
    });

    await this.githubRepo.upsertFile({
      owner: payload.repoOwner,
      repo: payload.repoName,
      branch: payload.branch,
      path: legacyPath,
      contentBase64: payload.contentBase64,
      message: `docs: legacy ${payload.line}/${payload.lang}/${payload.docType}_${dateStr}`,
      token: payload.githubToken
    });

    const latestIndex = await this.githubRepo.readJsonFile<LatestIndexPayload>({
      owner: payload.repoOwner,
      repo: payload.repoName,
      branch: payload.branch,
      path: latestIndexPath,
      token: payload.githubToken
    });
    const rows = Array.isArray(latestIndex?.rows) ? [...latestIndex.rows] : [];
    const nextRow: LatestIndexRow = {
      id: `${payload.line}-${payload.lang}-${payload.docType}`,
      line: payload.line,
      lang: payload.lang,
      docType: payload.docType,
      effectiveDate: dateStr,
      publicUrl: `https://cimafoundation.github.io/cima-legal-public-docs/${latestPath}`,
      downloadFileName: `${payload.docType}.pdf`
    };
    const filtered = rows.filter(
      (row) =>
        !(
          String(row.line || '') === payload.line &&
          String(row.lang || '') === payload.lang &&
          String(row.docType || '') === payload.docType
        )
    );
    filtered.push(nextRow);
    filtered.sort((a, b) => a.line.localeCompare(b.line) || a.lang.localeCompare(b.lang) || a.docType.localeCompare(b.docType));
    const nextIndex: LatestIndexPayload = {
      generatedAt: new Date().toISOString(),
      rows: filtered
    };

    await this.githubRepo.upsertFile({
      owner: payload.repoOwner,
      repo: payload.repoName,
      branch: payload.branch,
      path: latestIndexPath,
      contentBase64: this.encodeUtf8ToBase64(`${JSON.stringify(nextIndex, null, 2)}\n`),
      message: `docs: update latest-index ${payload.line}/${payload.lang}/${payload.docType}`,
      token: payload.githubToken
    });

    this.runtimeConfig.clearCachedManifest();
    return { latestPath, legacyPath };
  }

  async softDeleteDocument(payload: DeletePayload): Promise<void> {
    const manifest = await this.fetchManifestForWrite(payload);
    const entry = manifest.latest?.[payload.platform]?.[payload.docType]?.[payload.lang];

    if (!entry) {
      throw new Error(`Document not found: ${payload.platform}/${payload.docType}/${payload.lang}`);
    }

    const deletedEntry: PublicLatestEntry = {
      ...entry,
      deletedAt: new Date().toISOString()
    };

    const nextManifest: PublicLatestResponse = {
      latest: {
        ...(manifest.latest || {}),
        [payload.platform]: {
          ...(manifest.latest?.[payload.platform] || {}),
          [payload.docType]: {
            ...(manifest.latest?.[payload.platform]?.[payload.docType] || {}),
            [payload.lang]: deletedEntry
          }
        }
      }
    };

    await this.githubRepo.upsertFile({
      owner: payload.repoOwner,
      repo: payload.repoName,
      branch: payload.branch,
      path: payload.manifestPath,
      contentBase64: this.encodeUtf8ToBase64(JSON.stringify(nextManifest, null, 2) + '\n'),
      message: `docs: soft-delete ${payload.platform}/${payload.docType}/${payload.lang}`,
      token: payload.githubToken
    });

    this.runtimeConfig.clearCachedManifest();
  }

  async restoreDocument(payload: RestorePayload): Promise<void> {
    const manifest = await this.fetchManifestForWrite(payload);
    const entry = manifest.latest?.[payload.platform]?.[payload.docType]?.[payload.lang];

    if (!entry) {
      throw new Error(`Document not found: ${payload.platform}/${payload.docType}/${payload.lang}`);
    }

    const restoredEntry: PublicLatestEntry = {
      ...entry,
      deletedAt: undefined
    };

    const nextManifest: PublicLatestResponse = {
      latest: {
        ...(manifest.latest || {}),
        [payload.platform]: {
          ...(manifest.latest?.[payload.platform] || {}),
          [payload.docType]: {
            ...(manifest.latest?.[payload.platform]?.[payload.docType] || {}),
            [payload.lang]: restoredEntry
          }
        }
      }
    };

    await this.githubRepo.upsertFile({
      owner: payload.repoOwner,
      repo: payload.repoName,
      branch: payload.branch,
      path: payload.manifestPath,
      contentBase64: this.encodeUtf8ToBase64(JSON.stringify(nextManifest, null, 2) + '\n'),
      message: `docs: restore ${payload.platform}/${payload.docType}/${payload.lang}`,
      token: payload.githubToken
    });

    this.runtimeConfig.clearCachedManifest();
  }

  async hardDeleteDocument(payload: DeletePayload): Promise<void> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= ManifestCommandService.MAX_WRITE_RETRIES; attempt += 1) {
      try {
        const manifest = await this.fetchManifestForWrite(payload);
        const entry = manifest.latest?.[payload.platform]?.[payload.docType]?.[payload.lang];

        if (!entry) {
          // Gia eliminato da un processo concorrente.
          this.runtimeConfig.clearCachedManifest();
          return;
        }

        await this.githubRepo.deleteFile({
          owner: payload.repoOwner,
          repo: payload.repoName,
          branch: payload.branch,
          path: payload.filePath,
          message: `docs: hard-delete ${payload.platform}/${payload.docType}/${payload.lang}`,
          token: payload.githubToken
        });

        const nextLatest = JSON.parse(JSON.stringify(manifest.latest || {}));
        delete nextLatest[payload.platform]?.[payload.docType]?.[payload.lang];

        if (
          !nextLatest[payload.platform]?.[payload.docType] ||
          Object.keys(nextLatest[payload.platform][payload.docType]).length === 0
        ) {
          delete nextLatest[payload.platform][payload.docType];
        }
        if (!nextLatest[payload.platform] || Object.keys(nextLatest[payload.platform]).length === 0) {
          delete nextLatest[payload.platform];
        }

        const nextManifest: PublicLatestResponse = { latest: nextLatest };

        await this.githubRepo.upsertFile({
          owner: payload.repoOwner,
          repo: payload.repoName,
          branch: payload.branch,
          path: payload.manifestPath,
          contentBase64: this.encodeUtf8ToBase64(JSON.stringify(nextManifest, null, 2) + '\n'),
          message: `docs: hard-delete ${payload.platform}/${payload.docType}/${payload.lang}`,
          token: payload.githubToken
        });

        this.runtimeConfig.clearCachedManifest();
        return;
      } catch (error) {
        lastError = error;
        if (!this.isRetryableConflict(error) || attempt === ManifestCommandService.MAX_WRITE_RETRIES) {
          break;
        }
        await this.waitMs(300 * attempt);
      }
    }

    if (this.isRetryableConflict(lastError)) {
      throw new Error(
        'Conflitto durante l\'aggiornamento del manifest. Riprova tra pochi secondi: e probabile una pubblicazione GitHub Actions in corso.'
      );
    }

    throw lastError;
  }

  private async fetchManifestForWrite(
    payload: PublishPayload | DeletePayload | RestorePayload
  ): Promise<PublicLatestResponse> {
    const result = await this.githubRepo.readJsonFile<PublicLatestResponse>({
      owner: payload.repoOwner,
      repo: payload.repoName,
      branch: payload.branch,
      path: payload.manifestPath,
      token: payload.githubToken
    });
    return result || { latest: {} };
  }

  private async computeSha256(contentBase64: string): Promise<string> {
    const binary = atob(contentBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const view = new Uint8Array(digest);
    return Array.from(view)
      .map((value) => value.toString(16).padStart(2, '0'))
      .join('');
  }

  private encodeUtf8ToBase64(value: string): string {
    const bytes = new TextEncoder().encode(value);
    let binary = '';
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    return btoa(binary);
  }

  private isRetryableConflict(error: unknown): boolean {
    const status = (error as HttpLikeError)?.status;
    return status === 409 || status === 412;
  }

  private waitMs(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
