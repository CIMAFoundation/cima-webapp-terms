import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

export interface UploadSnackbarMessage {
  text: string;
  type: 'success' | 'error' | 'info';
}

@Component({
  selector: 'app-upload-snackbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './upload-snackbar.component.html'
})
export class UploadSnackbarComponent {
  @Input() snackbar: UploadSnackbarMessage | null = null;
  @Output() dismissed = new EventEmitter<void>();
}

