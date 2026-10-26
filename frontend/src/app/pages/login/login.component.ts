import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthApiService } from '../../services/auth-api.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  private readonly api = inject(AuthApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  username = '';
  password = '';
  error = false;
  errorMessage = '';

  /** Creates the local session and reports authentication service failures separately. */
  async login(): Promise<void> {
    this.error = false;
    try {
      const response = await firstValueFrom(this.api.login(this.username, this.password));
      if (!response?.token) {
        this.showError();
        return;
      }
      this.auth.setSession(response.token, response.user);
      this.router.navigate(['/upload']);
    } catch (error: unknown) {
      const message = error instanceof HttpErrorResponse && typeof error.error?.error === 'string'
        ? error.error.error
        : 'Impossibile contattare il servizio di autenticazione.';
      this.showError(message);
    }
  }

  /** Displays the login failure returned by the API. */
  private showError(message = 'Username o password non corretti.'): void {
    this.errorMessage = message;
    this.error = true;
    setTimeout(() => {
      this.error = false;
    }, 3000);
  }
}
