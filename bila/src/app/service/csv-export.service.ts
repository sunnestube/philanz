import {Injectable} from "@angular/core";
import {Month} from '../model/Month';
import {MonthColumn} from '../model/MonthColumn';

@Injectable({
    providedIn: "root",
})
export class CsvExportService {

    static convertToCSV(months: Month[], columns: MonthColumn[]): string {
        const rows: string[] = [];
        const header: string[] = ['Month'];
        columns.forEach(column => {
            header.push(`${column.title}::${column.type}`);
        })
        rows.push(header.join(';'));
        months.forEach(month => {
            month.rows.forEach(row => {
                const cells: string[] = [];
                row.cells.forEach(cell => {
                    cells.push(`;${cell.value}`);
                });
                rows.push(`${month.label.title}${cells.join('')}`);
            });
        });
        return rows.join('\n');
    }


}
