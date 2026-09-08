import {Component, input, output} from '@angular/core';

@Component({
    selector: 'bal-budget-header',
    standalone: true,
    templateUrl: './budget-header.component.html',
    styleUrl: './budget-header.component.css'
})
export class BudgetHeaderComponent {
    readonly availableYears = input.required<string[]>();
    readonly selectedYear = input<string | null>(null);
    readonly error = input<string | null>(null);

    readonly fileUploaded = output<File>();
    readonly yearSelected = output<string>();

    onFileChange(event: Event): void {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (file) {
            this.fileUploaded.emit(file);
        }
    }

    onYearChange(event: Event): void {
        const year = (event.target as HTMLSelectElement).value;
        if (year) {
            this.yearSelected.emit(year);
        }
    }
}
