import {Injectable} from '@angular/core';
import {Month} from '../model/Month';
import {MonthColumn} from '../model/MonthColumn';
import {MonthKey, MonthLabel} from '../model/MonthLabel';
import {MonthCell} from '../model/MonthCell';
import {MonthRow} from '../model/MonthRow';
import {CELL_TYPE, CellType} from '../model/CellType';
import {SECTION} from '../model/Section';

@Injectable({
    providedIn: 'root'
})
export class CsvImportService {

    static parseCSV(csvData: string): Month[] {
        const lines = CsvImportService.splitRows(csvData.replace(/^\uFEFF/, ''));
        if (lines.length === 0) {
            return [];
        }
        const header = lines.shift() ?? [];
        let monthsMap: { [key: string]: Month } = {};
        lines.forEach((values) => {
            monthsMap = CsvImportService.parseLine(values, monthsMap, header);
        });
        return Object.values(monthsMap);
    }

    private static parseLine(
        values: string[],
        monthsMap: { [key: string]: Month },
        header: string[]
    ): { [key: string]: Month } {
        if (!values.length || values.every((value) => value === '')) {
            return monthsMap;
        }

        const monthTitle = values[0];
        const lineNumber = parseInt(values[1], 10);

        if (!monthsMap[monthTitle]) {
            const monthLabel = new MonthLabel(CsvImportService.findMonthLabel(monthTitle));
            const monthColumns = header.map((title) => CsvImportService.parseHeader(title));
            monthsMap[monthTitle] = new Month(monthLabel, monthColumns);
        }

        const month = monthsMap[monthTitle];
        const cells = month.columns.map((column, index) => {
            return new MonthCell(
                Number.isFinite(lineNumber) ? lineNumber : month.rows.length,
                index,
                column.title,
                CsvImportService.findCellType(column.type),
                values[index] ?? ''
            );
        });
        month.rows.push(new MonthRow(
            Number.isFinite(lineNumber) ? lineNumber : month.rows.length,
            month.columns,
            cells
        ));
        return monthsMap;
    }

    private static parseHeader(title: string): MonthColumn {
        const [titleSection, colType] = title.split('::');
        const lastUnderscore = titleSection.lastIndexOf('_');
        if (lastUnderscore > 0) {
            const maybeSection = titleSection.slice(lastUnderscore + 1);
            if (Object.values(SECTION).includes(maybeSection as SECTION) || /^A\d+$/.test(maybeSection)) {
                return new MonthColumn(
                    titleSection.slice(0, lastUnderscore),
                    (colType as CELL_TYPE) || CELL_TYPE.number,
                    maybeSection as SECTION
                );
            }
        }
        return new MonthColumn(
            titleSection,
            (colType as CELL_TYPE) || CELL_TYPE.number,
            SECTION.DEFAULT
        );
    }

    static findCellType(needle: string): CellType {
        for (const cellTypeKey in CELL_TYPE) {
            if (CELL_TYPE[cellTypeKey as keyof typeof CELL_TYPE] === needle) {
                return new CellType(CELL_TYPE[cellTypeKey as keyof typeof CELL_TYPE]);
            }
        }
        return new CellType(CELL_TYPE.number);
    }

    private static findMonthLabel(find: string): MonthKey {
        for (const monthKey of Object.values(MonthKey)) {
            if (find === monthKey) {
                return monthKey;
            }
        }
        return MonthKey.JAN;
    }

    private static splitRows(text: string): string[][] {
        const rows: string[][] = [];
        let row: string[] = [];
        let field = '';
        let inQuotes = false;

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const next = text[i + 1];
            if (char === '"') {
                if (inQuotes && next === '"') {
                    field += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
                continue;
            }
            if (char === ';' && !inQuotes) {
                row.push(field);
                field = '';
                continue;
            }
            if ((char === '\n' || char === '\r') && !inQuotes) {
                if (char === '\r' && next === '\n') {
                    i++;
                }
                row.push(field);
                if (row.some((cell) => cell.length > 0)) {
                    rows.push(row);
                }
                row = [];
                field = '';
                continue;
            }
            field += char;
        }
        row.push(field);
        if (row.some((cell) => cell.length > 0)) {
            rows.push(row);
        }
        return rows;
    }
}
