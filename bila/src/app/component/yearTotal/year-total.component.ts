import {Component, computed, inject} from '@angular/core';
import {WorkbookService} from '../../service/workbook.service';

@Component({
    selector: 'bal-year-total',
    standalone: true,
    templateUrl: './year-total.component.html',
    styleUrl: './year-total.component.css'
})
export class YearTotalComponent {
    readonly workbook = inject(WorkbookService);
    readonly report = computed(() => {
        this.workbook.revision();
        return this.workbook.yearExpenseReport();
    });

    format(value: number): string {
        return value.toLocaleString('de-CH', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    }
}
