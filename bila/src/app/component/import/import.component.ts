import {Component, ElementRef, EventEmitter, Output, ViewChild} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {Month} from '../../model/Month';
import {HttpClient} from '@angular/common/http';
import {WorkbookService} from '../../service/workbook.service';

@Component({
    selector: 'bal-import',
    templateUrl: './import.component.html',
    imports: [
        FormsModule
    ],
    styleUrls: ['./import.component.css']
})
export class ImportComponent {

    @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
    @Output() dataLoaded: EventEmitter<Month[]> = new EventEmitter<Month[]>();

    constructor(private http: HttpClient, private workbook: WorkbookService) {
    }

    protected onDragOver(event: DragEvent): void {
        event.preventDefault();
        event.stopPropagation();
    }

    protected onDragLeave(event: DragEvent): void {
        event.preventDefault();
        event.stopPropagation();
    }

    protected onDrop(event: DragEvent): void {
        event.preventDefault();
        event.stopPropagation();
        if (event.dataTransfer && event.dataTransfer.files.length > 0) {
            this.handleFiles(event.dataTransfer.files);
        }
    }

    protected onFileChange(event: Event): void {
        const input = event.target as HTMLInputElement;
        if (input.files && input.files.length > 0) {
            this.handleFiles(input.files);
        }
    }

    private handleFiles(fileList: FileList): void {
        const file = fileList[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const csvData = e.target?.result as string;
                this.initMonths(csvData);
            };
            reader.readAsText(file);
        }
    }

    initMonths(csvData: string): void {
        const months: Month[] = this.workbook.applyCsv(csvData);
        this.dataLoaded.emit(months);
    }

    loadExample(): void {
        this.http.get('assets/example.csv', {responseType: 'text'}).subscribe((csvData) => {
            this.initMonths(csvData);
        });
    }
}
