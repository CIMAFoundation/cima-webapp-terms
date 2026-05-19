import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'documents' },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then((m) => m.LoginComponent)
  },
  {
    path: 'documents',
    loadComponent: () =>
      import('./pages/documents/documents-page.component').then((m) => m.DocumentsPageComponent)
  },
  {
    path: 'official-documents',
    loadComponent: () =>
      import('./pages/official/official-documents-page.component').then(
        (m) => m.OfficialDocumentsPageComponent
      )
  },
  {
    path: 'upload',
    loadComponent: () => import('./pages/upload/upload-page.component').then((m) => m.UploadPageComponent)
  },
  { path: '**', redirectTo: 'documents' }
];
