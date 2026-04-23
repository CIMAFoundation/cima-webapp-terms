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
  @Output() deleteRequested = new EventEmitter<string[]>();
  @Output() restoreRequested = new EventEmitter<string[]>();
  @Output() hardDeleteRequested = new EventEmitter<string[]>();

  selectedIds = new Set<string>();

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

  get allSelected(): boolean {
    return this.documents.length > 0 && this.selectedIds.size === this.documents.length;
  }

  toggleAll(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      this.selectedIds = new Set(this.documents.map(d => d.id));
    } else {
      this.selectedIds.clear();
    }
  }

  toggleSelection(id: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      this.selectedIds.add(id);
    } else {
      this.selectedIds.delete(id);
    }
  }

  onDeleteSelected(): void {
    this.deleteRequested.emit(Array.from(this.selectedIds));
    this.selectedIds.clear();
  }

  onRestoreSelected(): void {
    this.restoreRequested.emit(Array.from(this.selectedIds));
    this.selectedIds.clear();
  }

  onHardDeleteSelected(): void {
    this.hardDeleteRequested.emit(Array.from(this.selectedIds));
    this.selectedIds.clear();
  }

  protected readonly String = String;
}
