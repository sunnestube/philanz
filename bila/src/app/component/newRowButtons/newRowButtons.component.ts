import {Component, Input, inject} from '@angular/core';
import {Month} from '../../model/Month';
import {MonthRow} from '../../model/MonthRow';
import {CELL_TYPE} from '../../model/CellType';
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
        const target = this.month ?? this.workbook.selectedMonth();
        if (!target) {
            return;
        }
        this.appendEmptyRow(target);
        this.workbook.touch();
    }

    addRows(count: number): void {
        const target = this.month ?? this.workbook.selectedMonth();
        if (!target) {
            return;
        }
        for (let i = 0; i < count; i++) {
            this.appendEmptyRow(target);
        }
        this.workbook.touch();
    }

    workbookHasMonth(): boolean {
        return !!this.workbook.selectedMonth();
    }

    private appendEmptyRow(month: Month): void {
        const rowIndex = month.rows.length;
        const row = new MonthRow(rowIndex, month.columns);
        row.cells.forEach((cell) => {
            if (cell.type.id === CELL_TYPE.none) {
                cell.raw = month.label.title;
            }
            if (cell.type.id === CELL_TYPE.index) {
                cell.raw = String(rowIndex);
            }
        });
        month.rows.push(row);
    }
}
