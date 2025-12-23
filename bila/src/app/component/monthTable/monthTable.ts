import {Component, Input} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {Month} from '../../model/Month';
import {NewRowButtonsComponent} from '../newRowButtons/newRowButtons.component';
import {CellFormatPipe} from '../../pipe/cell-format.pipe';
import {MonthCell} from '../../model/MonthCell';
import {MonthRow} from '../../model/MonthRow';
import {TableNavigationService} from '../../service/tableNavigation.service';
import {CELL_TYPE} from '../../model/CellType';
import {MonthLabel} from '../../model/MonthLabel';

interface Options {
    [key: string]: string[]; // Indexsignatur für beliebige Schlüssel
}

const OPTIONS: Options = {
    person: ['', 'P', 'L', 'H', 'E', 'A'],
    account: ['', 'B', 'K', 'S', 'R', 'Y', 'T'],
    default: ['d']
};


@Component({
    selector: 'bal-month-table',
    templateUrl: './monthTable.html',
    imports: [
        FormsModule,
        NewRowButtonsComponent,
        CellFormatPipe,
    ],
    styleUrls: ['./monthTable.css']
})
export class MonthTable {

    private _month?: Month;
    @Input()
    set month(month: Month) {
        month?.rows.forEach(row => {
            row.cells.forEach(cell => {
                this.onSelectChange(cell, row);
            })
        })
        this._month = month;
    };

    get month(): Month | undefined {
        return this._month;
    }

    onSelectChange(cell: MonthCell, row: MonthRow) {
        if (cell.type.id.indexOf(CELL_TYPE.select) != -1) {
            const opt: string = cell.type.id.split('_')[1] as string;
            const options: string[] = OPTIONS[opt ? opt : 'default'];
            if (!options) {
                console.error(`Keine Optionen für den Typ: ${opt}`);
                return;
            }

            if (!options.includes(cell.value)) {
                cell.value = '';
            } else if (opt === 'person') {
                row.color = cell.value.toLowerCase();
            }
        }
    }

    navigate(event: KeyboardEvent, rowIndex: number, cellIndex: number) {
        TableNavigationService.navigate(event.key, rowIndex, cellIndex, this.month?.columns?.length);
    }

    protected readonly OPTIONS = OPTIONS;
}
