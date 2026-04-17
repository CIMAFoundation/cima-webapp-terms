import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DocumentDto } from '../../services/api.models';

@Component({
  selector: 'app-documents-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './documents-list.component.html'
})
export class DocumentsListComponent {
  @Input() documents: DocumentDto[] = [];
  @Input() canDelete = false;
  @Input() canHardDelete = false;
  @Output() deleteRequested = new EventEmitter<string>();
  @Output() restoreRequested = new EventEmitter<string>();
  @Output() hardDeleteRequested = new EventEmitter<string>();

  trackById(_: number, item: DocumentDto): string {
    return item.id;
  }

  isDeleted(doc: DocumentDto): boolean {
    return Boolean(doc.deletedAt);
  }

  formatDeletedDate(deletedAt: string | null): string {
    if (!deletedAt) return '';
    return new Date(deletedAt).toLocaleDateString('it-IT');
  }

  protected readonly String = String;
}
