import {MonthRow} from './MonthRow';
import {MonthLabel} from './MonthLabel';
import {MonthColumn} from './MonthColumn';


export class Month {
    label: MonthLabel;
    columns: MonthColumn[] = [];
    rows: MonthRow[] = [];

    constructor(label: MonthLabel, columns: MonthColumn[] = []) {
        this.label = label;
        this.columns = columns;
    }

}
