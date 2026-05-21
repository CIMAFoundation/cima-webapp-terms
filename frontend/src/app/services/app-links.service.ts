import { Injectable } from '@angular/core';
import { APP_LINKS_CONFIG } from '../config/app-links.config';

@Injectable({ providedIn: 'root' })
export class AppLinksService {
  get webtermsAppUrl(): string {
    return APP_LINKS_CONFIG.webtermsAppUrl.trim();
  }

  get publicDocsPageUrl(): string {
    return APP_LINKS_CONFIG.publicDocsPageUrl.trim();
  }

  get legalPublicRepoUrl(): string {
    return APP_LINKS_CONFIG.legalPublicRepoUrl.trim();
  }
}
