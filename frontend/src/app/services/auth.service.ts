import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { LoginResponse } from './api.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private static readonly TOKEN_KEY = 'webterms_token';
  private static readonly USER_KEY = 'webterms_user';

  getToken(): string {
    return localStorage.getItem(AuthService.TOKEN_KEY) || '';
  }

  setToken(token: string): void {
    localStorage.setItem(AuthService.TOKEN_KEY, token);
  }

  setSession(token: string, user?: LoginResponse['user']): void {
    this.setToken(token);
    if (user?.username) {
      localStorage.setItem(AuthService.USER_KEY, JSON.stringify(user));
    }
  }

  /** Ends the server session as well as clearing the local login state. */
  clearToken(): void {
    this.http.post('api/logout.php', {}, {
      headers: { 'X-Webterms-CSRF': this.getToken() }
    }).subscribe({ error: () => undefined });
    localStorage.removeItem(AuthService.TOKEN_KEY);
    localStorage.removeItem(AuthService.USER_KEY);
  }

  isAuthenticated(): boolean {
    return Boolean(this.getToken());
  }

  getUserRole(): string {
    try {
      const raw = localStorage.getItem(AuthService.USER_KEY);
      if (!raw) return '';
      const parsed = JSON.parse(raw) as LoginResponse['user'];
      return String(parsed?.role || '').trim().toLowerCase();
    } catch {
      return '';
    }
  }

  canViewConfiguration(): boolean {
    const role = this.getUserRole();
    return role === 'admin' || role === 'dev';
  }

  canEditConfiguration(): boolean {
    return this.getUserRole() === 'admin';
  }

  buildAuthHeaders(): HttpHeaders | undefined {
    const token = this.getToken();
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;
  }
}
