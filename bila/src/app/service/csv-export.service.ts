import {Injectable} from '@angular/core';
import {Month} from '../model/Month';
import {MonthColumn} from '../model/MonthColumn';
import {SECTION} from '../model/Section';

@Injectable({
    providedIn: 'root'
})
export class CsvExportService {

    static convertToCSV(months: Month[], columns: MonthColumn[]): string {
        const header = columns.map((column) => CsvExportService.headerToken(column)).join(';');
        const rows: string[] = [header];

        months.forEach((month) => {
            month.rows.forEach((row) => {
                const cells = row.cells.map((cell) => CsvExportService.escape(cell.raw ?? cell.value ?? ''));
                rows.push(cells.join(';'));
            });
        });

        return `\uFEFF${rows.join('\n')}\n`;
    }

    private static headerToken(column: MonthColumn): string {
        const section = column.section && column.section !== SECTION.DEFAULT
            ? `_${column.section}`
            : '';
        return `${column.title}${section}::${column.type}`;
    }

    private static escape(value: string): string {
        if (value === null || value === undefined) {
            return '';
        }
        const text = String(value);
        if (/[;"\n\r]/.test(text)) {
            return `"${text.replace(/"/g, '""')}"`;
        }
        return text;
    }
}
