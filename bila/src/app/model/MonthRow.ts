import {MonthColumn} from './MonthColumn';
import {MonthCell} from './MonthCell';
import {CELL_TYPE} from './CellType';
import {CsvImportService} from '../service/csv-import.service';

export class MonthRow {
    cells: MonthCell[] = [];
    color: string = '';

    constructor(line: number, columns: MonthColumn[], cells: MonthCell[] = []) {
        if (cells.length === columns.length) {
            cells.forEach((cell) => {
                this.cells.push(new MonthCell(line, cell.columnIndex, cell.columnTitle, cell.type, cell.value));
            });
        } else {
            columns.forEach((column, index) => {
                this.cells.push(new MonthCell(line, index, column.title, CsvImportService.findCellType(column.type), ''));
            });
        }
        this.syncColor();
    }

    syncColor(): void {
        const person = this.cells.find((cell) => cell.type.id === CELL_TYPE.select_person);
        const code = (person?.raw || '').trim();
        this.color = code ? code.toLowerCase() : '';
    }
}
