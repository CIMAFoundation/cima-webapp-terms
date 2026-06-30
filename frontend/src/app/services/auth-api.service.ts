import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { catchError } from 'rxjs/operators';
import { LoginResponse, MeResponse } from './api.models';

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly http = inject(HttpClient);
  private readonly currentHost = typeof window !== 'undefined' ? window.location.hostname : '';
  private readonly infraApiBaseUrl = this.resolveInfraApiBaseUrl();
  private readonly useSharedCookieSession = this.isSharedCookieHost(this.currentHost);
  private sharedSessionPromise: Promise<LoginResponse> | null = null;

  shouldUseSharedCookieSession(): boolean {
    return this.useSharedCookieSession;
  }

  // Resolve shared session once and reuse result while app bootstraps protected pages.
  async resolveSharedSession(): Promise<LoginResponse> {
    if (!this.useSharedCookieSession) {
      return { token: '', source: 'shared-cookie-disabled' };
    }
    if (!this.sharedSessionPromise) {
      this.sharedSessionPromise = firstValueFrom(this.getSession());
    }
    return this.sharedSessionPromise;
  }

  private isSharedCookieHost(host: string): boolean {
    return host === 'mockup.cimafoundation.org'
      || host.endsWith('.lvh.me')
      || host.endsWith('.localtest.me');
  }

  private resolveInfraApiBaseUrl(): string {
    if (typeof window === 'undefined') {
      return 'https://mockup.cimafoundation.org/infrastruttura/api/';
    }
    const custom = window.localStorage.getItem('infra_api_base_url');
    if (custom) {
      return custom.endsWith('/') ? custom : `${custom}/`;
    }
    return 'https://mockup.cimafoundation.org/infrastruttura/api/';
  }

  login(username: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<{ success?: boolean; id?: number; username?: string; role?: string; message?: string }>(
        `${this.infraApiBaseUrl}auth.php`,
        { username, password },
        { withCredentials: this.useSharedCookieSession }
      )
      .pipe(
        map((response) => {
          if (response?.success) {
            return {
              token: this.useSharedCookieSession
                ? 'shared-cookie-session'
                : `infra-${response.id || 0}-${response.username || username}`,
              user: {
                id: response.id,
                username: response.username || username,
                role: response.role
              },
              source: 'infrastruttura-api'
            } satisfies LoginResponse;
          }

          return {
            token: '',
            source: 'infrastruttura-api'
          } satisfies LoginResponse;
        }),
        catchError(() =>
          of({
            token: '',
            source: 'infrastruttura-api'
          })
        )
      );
  }

  getSession(): Observable<LoginResponse> {
    return this.http
      .get<{ success?: boolean; id?: number; username?: string; role?: string }>(
        `${this.infraApiBaseUrl}session.php`,
        { withCredentials: this.useSharedCookieSession }
      )
      .pipe(
        map((response) => {
          if (response?.success && response.username) {
            return {
              token: 'shared-cookie-session',
              user: {
                id: response.id,
                username: response.username,
                role: response.role
              },
              source: 'infrastruttura-session'
            } satisfies LoginResponse;
          }
          return { token: '', source: 'infrastruttura-session' } satisfies LoginResponse;
        }),
        catchError(() => of({ token: '', source: 'infrastruttura-session' } satisfies LoginResponse))
      );
  }

  logoutSession(): Observable<{ success: boolean }> {
    return this.http
      .post<{ success?: boolean }>(
        `${this.infraApiBaseUrl}logout.php`,
        {},
        { withCredentials: this.useSharedCookieSession }
      )
      .pipe(
        map((response) => ({ success: Boolean(response?.success) })),
        catchError(() => of({ success: false }))
      );
  }

  getMe(): Observable<MeResponse> {
    return this.http.get<MeResponse>(`${this.infraApiBaseUrl}auth.php`).pipe(
      catchError(() => of({ user: { username: 'local-user' } }))
    );
  }
}
