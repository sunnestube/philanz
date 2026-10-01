import {CellType} from './CellType';

export class MonthCell {
    rowIndex: number;
    columnIndex: number;
    columnTitle: string;
    type: CellType;
    raw: string;
    display: string = '';
    error: string | null = null;
    /**
     * FX display-string cache (issue #30).
     * Key = displayCurrency | (display||raw) | dayIndex | rate@day
     * (not workbook.revision — see MonthTable.cellDisplay).
     */
    fxDisplayKey: string | null = null;
    fxDisplayText: string | null = null;

    constructor(rowIndex: number, columnIndex: number, columnTitle: string, type: CellType, value: string) {
        this.rowIndex = rowIndex;
        this.columnIndex = columnIndex;
        this.columnTitle = columnTitle;
        this.type = type;
        this.raw = value ?? '';
        this.display = this.raw;
    }

    get value(): string {
        return this.raw;
    }

    set value(next: string) {
        this.raw = next ?? '';
    }
}
