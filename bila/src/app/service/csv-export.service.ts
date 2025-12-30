import {Injectable} from "@angular/core";
import {Month} from '../model/Month';
import {MonthColumn} from '../model/MonthColumn';

@Injectable({
    providedIn: "root",
})
export class CsvExportService {

    static convertToCSV(months: Month[], columns: MonthColumn[]): string {
        const rows: string[] = [];
        const header: string[] = [];
        columns.forEach(column => {
            header.push(`${column.title}_${column.section}::${column.type}`);
        })
        rows.push(header.join(';'));
        months.forEach(month => {
            month.rows.forEach(row => {
                const cells: string[] = [];
                row.cells.forEach(cell => {
                    cells.push(`${cell.value};`);
                });
                rows.push(`${cells.join('')}`);
            });
        });
        return rows.join('\n');
    }


}
