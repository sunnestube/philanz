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
            const last = CsvExportService.lastUsedRow(month);
            if (last < 0) {
                return;
            }
            month.rows.slice(0, last + 1).forEach((row) => {
                const cells = row.cells.map((cell) => CsvExportService.escape(cell.raw ?? cell.value ?? ''));
                rows.push(cells.join(';'));
            });
        });

        return `\uFEFF${rows.join('\n')}\n`;
    }

    private static lastUsedRow(month: Month): number {
        let last = -1;
        month.rows.forEach((row, index) => {
            const hasEntry = row.cells.some((cell) => {
                const type = cell.type?.id;
                if (type === 'none' || type === 'index') {
                    return false;
                }
                return !!(cell.raw ?? cell.value ?? '').trim();
            });
            if (hasEntry) {
                last = index;
            }
        });
        return last < 0 && month.rows.length ? 0 : last;
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
