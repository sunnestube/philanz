import {Component, Input, inject} from '@angular/core';
import {Month} from '../../model/Month';
import {Button} from 'primeng/button';
import {WorkbookService} from '../../service/workbook.service';

@Component({
    selector: 'bal-new-row-buttons',
    templateUrl: './newRowButtons.component.html',
    imports: [Button],
    styleUrls: ['./newRowButtons.component.css']
})
export class NewRowButtonsComponent {
    @Input() month?: Month | null;
    private readonly workbook = inject(WorkbookService);

    addRow(): void {
        this.workbook.addRow(this.month ?? this.workbook.selectedMonth());
    }

    addRows(count: number): void {
        this.workbook.addRows(this.month ?? this.workbook.selectedMonth(), count);
    }

    workbookHasMonth(): boolean {
        return !!this.workbook.selectedMonth();
    }
}
