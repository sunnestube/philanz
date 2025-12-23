import {CellType} from './CellType';
import {CellFormatPipe} from '../pipe/cell-format.pipe';
import {MonthKey, MonthLabel} from './MonthLabel';

export class MonthCell {
    rowIndex: number;
    columnIndex: number;
    columnTitle: string;
    type: CellType;
    value: string;

    private cellFormatPipe: CellFormatPipe = new CellFormatPipe();

    constructor(rowIndex: number, columnIndex: number, columnTitle: string, type: CellType, value: string) {
        this.rowIndex = rowIndex;
        this.columnIndex = columnIndex;
        this.columnTitle = columnTitle;
        this.type = type;

        this.value = this.formatValue(value, type, new MonthLabel(MonthKey.JAN)) ;
    }

    formatValue(value: string, cellType: CellType, monthLabel: MonthLabel): string {
        if(value){
            return this.cellFormatPipe.transform(value, cellType, monthLabel);
        }else{
            return "";
        }

    }

}
