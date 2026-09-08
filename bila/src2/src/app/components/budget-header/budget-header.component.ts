import {Component, input, output} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';

@Component({
    selector: 'app-budget-header',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './budget-header.component.html',
    styleUrl: './budget-header.component.css'
})
export class BudgetHeaderComponent {
    availableYears = input.required<string[]>();
    selectedYear = input<string | null>(null);
    error = input<string | null>(null);

    fileUploaded = output<File>();
    yearSelected = output<string>();

    onFileChange(event: Event): void {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (file) this.fileUploaded.emit(file);
    }

    onYearChange(event: Event): void {
        const year = (event.target as HTMLSelectElement).value;
        if (year) this.yearSelected.emit(year);
    }
}
