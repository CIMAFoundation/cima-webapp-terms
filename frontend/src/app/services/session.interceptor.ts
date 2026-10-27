import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

/** Ends stale local sessions on protected API 401 responses, without retrying mutations. */
export const sessionInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return next(request).pipe(catchError((error: unknown) => {
    const status = (error as { status?: number })?.status;
    if (status === 401 && /^api\/(?!login\.php|logout\.php)/.test(request.url)) {
      auth.expireSession();
      void router.navigate(['/login']);
    }
    return throwError(() => error);
  }));
};
