import {Component, Input} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {Month} from '../../model/Month';
import {MonthRow} from '../../model/MonthRow';
import {Button} from 'primeng/button';
import {CellFormatPipe} from '../../pipe/cell-format.pipe';
import {FRACTION_DIGITS} from '../../model/CellType';

@Component({
    selector: 'bal-new-row-buttons',
    templateUrl: './newRowButtons.component.html',
    imports: [
        FormsModule,
        Button
    ],
    styleUrls: ['./newRowButtons.component.css']
})
export class NewRowButtonsComponent {

    @Input() month?: Month

    addRows(count: number): void {
        const currentLength: number = this.month?.rows.length ? this.month?.rows.length : 0;
        for (let i = currentLength; i < currentLength + count; i++) {
            this.addRow(i);
        }
    }

    addRow(line: number): void {
        if (this.month) {
            this.month.rows.push(new MonthRow(line, this.month.columns));
        }
    }

}
