import { Injectable } from '@angular/core';

export interface GithubRepoConfig {
  owner: string;
  repo: string;
  branch: string;
  documentsRootPath: string;
  manifestPath: string;
  publicBaseUrl: string;
}

@Injectable({ providedIn: 'root' })
export class RuntimeConfigService {
  private static readonly MANIFEST_URL_KEY = 'webterms_manifest_url';
  private static readonly CACHED_MANIFEST_KEY = 'webterms_cached_manifest';
  private static readonly CACHED_MANIFEST_TTL_KEY = 'webterms_cached_manifest_ttl';
  private static readonly GITHUB_TOKEN_KEY = 'webterms_github_token';
  private static readonly GITHUB_REPO_CONFIG_KEY = 'webterms_github_repo_config';

  // GitHub Pages URL (primary, stable)
  private static readonly PAGES_MANIFEST_URL =
    'https://dedandy.github.io/catalog/manifest.json';

  // Corporate repo URLs (fallback)
  private static readonly CORPORATE_MANIFEST_URL =
    'https://raw.githubusercontent.com/CIMAFoundation/cima-legal-public-docs/main/legal-docs/manifests/latest.json';

  // Corporate repo defaults
  private static readonly DEFAULT_REPO_CONFIG: GithubRepoConfig = {
    owner: 'CIMAFoundation',
    repo: 'cima-legal-public-docs',
    branch: 'main',
    documentsRootPath: 'legal-docs/files',
    manifestPath: 'legal-docs/manifests/latest.json',
    publicBaseUrl: 'https://raw.githubusercontent.com/CIMAFoundation/cima-legal-public-docs/main'
  };

  private static readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Gets the manifest URL for reading.
   * Priority: 1) User custom, 2) GitHub Pages, 3) Corporate raw (fallback)
   */
  getManifestUrl(): string {
    const custom = localStorage.getItem(RuntimeConfigService.MANIFEST_URL_KEY);
    if (custom) return custom;
    return RuntimeConfigService.PAGES_MANIFEST_URL;
  }

  /**
   * Gets fallback URL if primary fails.
   */
  getFallbackManifestUrl(): string {
    return RuntimeConfigService.CORPORATE_MANIFEST_URL;
  }

  setManifestUrl(url: string): void {
    localStorage.setItem(RuntimeConfigService.MANIFEST_URL_KEY, url.trim());
  }

  // Cached manifest management
  getCachedManifest(): { manifest: unknown; timestamp: number } | null {
    try {
      const raw = localStorage.getItem(RuntimeConfigService.CACHED_MANIFEST_KEY);
      const ttlRaw = localStorage.getItem(RuntimeConfigService.CACHED_MANIFEST_TTL_KEY);
      if (!raw || !ttlRaw) return null;
      
      const ttl = parseInt(ttlRaw, 10);
      if (Date.now() > ttl) {
        this.clearCachedManifest();
        return null;
      }
      
      return { manifest: JSON.parse(raw), timestamp: ttl };
    } catch {
      return null;
    }
  }

  setCachedManifest(manifest: unknown): void {
    const ttl = Date.now() + RuntimeConfigService.CACHE_TTL_MS;
    localStorage.setItem(RuntimeConfigService.CACHED_MANIFEST_KEY, JSON.stringify(manifest));
    localStorage.setItem(RuntimeConfigService.CACHED_MANIFEST_TTL_KEY, ttl.toString());
  }

  clearCachedManifest(): void {
    localStorage.removeItem(RuntimeConfigService.CACHED_MANIFEST_KEY);
    localStorage.removeItem(RuntimeConfigService.CACHED_MANIFEST_TTL_KEY);
  }

  getGithubToken(): string {
    return localStorage.getItem(RuntimeConfigService.GITHUB_TOKEN_KEY) || '';
  }

  setGithubToken(token: string): void {
    localStorage.setItem(RuntimeConfigService.GITHUB_TOKEN_KEY, token.trim());
  }

  clearGithubToken(): void {
    localStorage.removeItem(RuntimeConfigService.GITHUB_TOKEN_KEY);
  }

  /**
   * Gets GitHub repo config for writes (always corporate repo).
   */
  getGithubRepoConfig(): GithubRepoConfig {
    const raw = localStorage.getItem(RuntimeConfigService.GITHUB_REPO_CONFIG_KEY);
    if (!raw) {
      return RuntimeConfigService.DEFAULT_REPO_CONFIG;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<GithubRepoConfig>;
      return {
        owner: parsed.owner || RuntimeConfigService.DEFAULT_REPO_CONFIG.owner,
        repo: parsed.repo || RuntimeConfigService.DEFAULT_REPO_CONFIG.repo,
        branch: parsed.branch || RuntimeConfigService.DEFAULT_REPO_CONFIG.branch,
        documentsRootPath:
          parsed.documentsRootPath || RuntimeConfigService.DEFAULT_REPO_CONFIG.documentsRootPath,
        manifestPath: parsed.manifestPath || RuntimeConfigService.DEFAULT_REPO_CONFIG.manifestPath,
        publicBaseUrl: parsed.publicBaseUrl || RuntimeConfigService.DEFAULT_REPO_CONFIG.publicBaseUrl
      };
    } catch {
      return RuntimeConfigService.DEFAULT_REPO_CONFIG;
    }
  }

  setGithubRepoConfig(config: GithubRepoConfig): void {
    localStorage.setItem(RuntimeConfigService.GITHUB_REPO_CONFIG_KEY, JSON.stringify(config));
  }
}
