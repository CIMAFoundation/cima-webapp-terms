import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { QueuedFile } from '../../services/upload-facade.service';

@Component({
  selector: 'app-upload-queue-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './upload-queue-table.component.html'
})
export class UploadQueueTableComponent {
  @Input() queuedFiles: QueuedFile[] = [];
  @Input() canPublish = false;

  @Output() removeRequested = new EventEmitter<string>();
  @Output() publishRequested = new EventEmitter<void>();

  trackById(_: number, item: QueuedFile): string {
    return item.id;
  }
}
