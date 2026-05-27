import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './services/auth.service';
import {NgTemplateOutlet} from "@angular/common";
import { AuthApiService } from './services/auth-api.service';

@Component({
  selector: 'app-root',
    imports: [RouterOutlet, RouterLink, RouterLinkActive, NgTemplateOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly auth = inject(AuthService);
  private readonly authApi = inject(AuthApiService);
  private readonly router = inject(Router);

  constructor() {
    this.bootstrapSharedSession();
  }

  isAuthenticated(): boolean {
    return this.auth.isAuthenticated();
  }

  userRoleLabel(): string {
    const role = this.auth.getUserRole();
    return role ? role.toUpperCase() : 'USER';
  }

  logout(): void {
    if (this.authApi.shouldUseSharedCookieSession()) {
      this.authApi.logoutSession().subscribe({
        complete: () => {
          this.auth.clearToken();
          this.router.navigate(['/documents']);
        }
      });
      return;
    }
    this.auth.clearToken();
    this.router.navigate(['/documents']);
  }

  private async bootstrapSharedSession(): Promise<void> {
    if (!this.authApi.shouldUseSharedCookieSession()) {
      return;
    }
    if (this.auth.isAuthenticated()) {
      return;
    }
    const session = await firstValueFrom(this.authApi.getSession());
    if (session?.token && session.user?.username) {
      this.auth.setSession(session.token, session.user);
    }
  }
}
