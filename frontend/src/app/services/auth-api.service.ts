import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { LoginResponse, MeResponse } from './api.models';

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly http = inject(HttpClient);
  private readonly infraApiBaseUrl = 'https://mockup.cimafoundation.org/infrastruttura/api/';

  /** Creates a server session after the identity service validates credentials. */
  login(username: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>('api/login.php', { username, password }).pipe(
      catchError(() => of({ token: '', source: 'infrastruttura-api' }))
    );
  }

  getMe(): Observable<MeResponse> {
    return this.http.get<MeResponse>(`${this.infraApiBaseUrl}auth.php`).pipe(
      catchError(() => of({ user: { username: 'local-user' } }))
    );
  }
}
