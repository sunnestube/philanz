import {Injectable} from "@angular/core";
import {Month} from '../model/Month';
import {MonthColumn} from '../model/MonthColumn';
import {MonthKey, MonthLabel} from '../model/MonthLabel';
import {MonthCell} from '../model/MonthCell';
import {MonthRow} from '../model/MonthRow';
import {CELL_TYPE, CellType} from '../model/CellType';
import {SECTION} from '../model/Section';

@Injectable({
    providedIn: "root",
})
export class CsvImportService {

    static parseCSV(csvData: string): Month[] {
        const lines: string[] = csvData.split('\n');
        const header: string[] = lines.shift()!!.split(';');

        let monthsMap: { [key: string]: Month } = {};
        lines.forEach(line => {
            monthsMap = this.parseLine(line.trim(), monthsMap, header);
        });
        return Object.values(monthsMap);
    }

    private static parseLine(line: string, monthsMap: { [key: string]: Month }, header: string[]) {
        if (line) {
            const values = line.split(';');

            const monthTitle = values[0];
            const lineNumber = parseInt(values[1], 10);
            const cellValues = values;

            //console.log("values", monthTitle, lineNumber, cellValues, values);

            if (!monthsMap[monthTitle]) {
                const monthLabel = new MonthLabel(CsvImportService.findMonthLabel(monthTitle));
                const monthColumns = header.map((title) => {
                    const [colTitleSection, colType] = title.split('::');

                    console.log("type", colType);

                    const [colTitle, colSection] = colTitleSection.split('_');
                    return new MonthColumn(colTitle, colType as CELL_TYPE, colSection as SECTION);
                });
                monthsMap[monthTitle] = new Month(monthLabel, monthColumns);
            }

            const month = monthsMap[monthTitle];

            const cells = month.columns.map((column, index) => {
                return new MonthCell(lineNumber, index, column.title, this.findCellType(column.type), cellValues[index] || '');
            });
            month.rows.push(new MonthRow(lineNumber, month.columns, cells));
        }
        return monthsMap;
    }

    static findCellType(needle: string): CellType {
        for (let cellTypeKey in CELL_TYPE) {
            if (CELL_TYPE[cellTypeKey as keyof typeof CELL_TYPE] === needle) {
                return new CellType(CELL_TYPE[cellTypeKey as keyof typeof CELL_TYPE]);
            }
        }
        return new CellType(CELL_TYPE.number);
    }

    private static findMonthLabel(find: string): MonthKey {
        for (let monthKeyKey of Object.values(MonthKey)) {
            if (find === monthKeyKey) {
                return monthKeyKey;
            }
        }
        return MonthKey.JAN;
    }

}
