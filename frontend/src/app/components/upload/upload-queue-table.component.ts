import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { UploadDocType } from '../../services/api.models';
import { QueuedFile, UploadMetadataField } from '../../services/upload-facade.service';

@Component({
  selector: 'app-upload-queue-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './upload-queue-table.component.html'
})
export class UploadQueueTableComponent {
  @Input() queuedFiles: QueuedFile[] = [];
  @Input() lineOptions: string[] = [];
  @Input() langOptions: Array<'it' | 'en' | 'fr' | 'es' | 'pt'> = [];
  @Input() docTypeOptions: UploadDocType[] = [];
  @Input() canPublish = false;

  @Output() removeRequested = new EventEmitter<string>();
  @Output() metadataChanged = new EventEmitter<{ id: string; field: UploadMetadataField; value: string }>();
  @Output() publishRequested = new EventEmitter<void>();

  trackById(_: number, item: QueuedFile): string {
    return item.id;
  }

  onMetadataChange(
    id: string,
    field: UploadMetadataField,
    value: string
  ): void {
    this.metadataChanged.emit({ id, field, value });
  }

  isMetadataInvalid(item: QueuedFile): boolean {
    return !(item.line && item.lang && item.docType && item.date);
  }
}
