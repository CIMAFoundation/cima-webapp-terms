import { Injectable } from '@angular/core';

export interface GithubRepoConfig {
  owner: string;
  repo: string;
  branch: string;
  documentsRootPath: string;
  publicBaseUrl: string;
}

@Injectable({ providedIn: 'root' })
export class RuntimeConfigService {
  private static readonly CACHED_INDEX_KEY = 'webterms_cached_latest_index';
  private static readonly CACHED_INDEX_TTL_KEY = 'webterms_cached_latest_index_ttl';
  private static readonly GITHUB_REPO_CONFIG_KEY = 'webterms_github_repo_config';
  private static readonly LATEST_INDEX_URL =
    'https://cimafoundation.github.io/cima-legal-public-docs/assets/latest-index.json';

  // Corporate repo defaults
  private static readonly DEFAULT_REPO_CONFIG: GithubRepoConfig = {
    owner: 'CIMAFoundation',
    repo: 'cima-legal-public-docs',
    branch: 'main',
    documentsRootPath: 'latest',
    publicBaseUrl: 'https://cimafoundation.github.io/cima-legal-public-docs'
  };

  private static readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  getLatestIndexUrl(): string {
    return RuntimeConfigService.LATEST_INDEX_URL;
  }

  getCachedLatestIndex(): { value: unknown; timestamp: number } | null {
    try {
      const raw = localStorage.getItem(RuntimeConfigService.CACHED_INDEX_KEY);
      const ttlRaw = localStorage.getItem(RuntimeConfigService.CACHED_INDEX_TTL_KEY);
      if (!raw || !ttlRaw) return null;
      
      const ttl = parseInt(ttlRaw, 10);
      if (Date.now() > ttl) {
        this.clearCachedLatestIndex();
        return null;
      }
      
      return { value: JSON.parse(raw), timestamp: ttl };
    } catch {
      return null;
    }
  }

  setCachedLatestIndex(value: unknown): void {
    const ttl = Date.now() + RuntimeConfigService.CACHE_TTL_MS;
    localStorage.setItem(RuntimeConfigService.CACHED_INDEX_KEY, JSON.stringify(value));
    localStorage.setItem(RuntimeConfigService.CACHED_INDEX_TTL_KEY, ttl.toString());
  }

  clearCachedLatestIndex(): void {
    localStorage.removeItem(RuntimeConfigService.CACHED_INDEX_KEY);
    localStorage.removeItem(RuntimeConfigService.CACHED_INDEX_TTL_KEY);
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

      // Auto-migrate old raw.githubusercontent URLs to the new GH pages URL
      let savedBaseUrl = parsed.publicBaseUrl;
      if (savedBaseUrl && savedBaseUrl.includes('raw.githubusercontent.com')) {
        savedBaseUrl = RuntimeConfigService.DEFAULT_REPO_CONFIG.publicBaseUrl;
      }

      return {
        owner: parsed.owner || RuntimeConfigService.DEFAULT_REPO_CONFIG.owner,
        repo: parsed.repo || RuntimeConfigService.DEFAULT_REPO_CONFIG.repo,
        branch: parsed.branch || RuntimeConfigService.DEFAULT_REPO_CONFIG.branch,
        documentsRootPath:
          parsed.documentsRootPath || RuntimeConfigService.DEFAULT_REPO_CONFIG.documentsRootPath,
        publicBaseUrl: savedBaseUrl || RuntimeConfigService.DEFAULT_REPO_CONFIG.publicBaseUrl
      };
    } catch {
      return RuntimeConfigService.DEFAULT_REPO_CONFIG;
    }
  }

  setGithubRepoConfig(config: GithubRepoConfig): void {
    localStorage.setItem(RuntimeConfigService.GITHUB_REPO_CONFIG_KEY, JSON.stringify(config));
  }
}
