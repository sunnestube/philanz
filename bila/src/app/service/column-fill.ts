import {CELL_TYPE} from '../model/CellType';
import {Month} from '../model/Month';
import {MonthRow} from '../model/MonthRow';
import {ConstantDef, WorkbookService} from './workbook.service';

export type RichConstant = ConstantDef & {kind?: 'transfer' | 'column'; columnTitle?: string};

export function isColumnConstant(item: ConstantDef): boolean {
    const rich = item as RichConstant;
    return rich.kind === 'column' || item.person === '§COL';
}

export function columnFillAmount(
    workbook: WorkbookService,
    month: Month,
    row: MonthRow,
    colIndex: number
): number | null {
    const column = month.columns[colIndex];
    if (!column) {
        return null;
    }
    const textIdx = month.columns.findIndex((item) => item.type === CELL_TYPE.text);
    const cell = row.cells[textIdx];
    const raw = (cell?.raw ?? '').trim();
    const display = (cell?.display ?? '').trim();
    const labels = raw.startsWith('=') ? [display] : [raw, display];
    const match = workbook.constants().find((item) => {
        const name = item.name.trim();
        const title = ((item as RichConstant).columnTitle || '').trim();
        return isColumnConstant(item) && !!name && !!title && title === column.title && labels.some((label) => label === name);
    });
    if (!match) {
        return null;
    }
    return workbook.constantAmount(match, month.label.title);
}

export function applyColumnFills(workbook: WorkbookService): void {
    workbook.months().forEach((month) => {
        month.rows.forEach((row) => {
            month.columns.forEach((_column, index) => {
                const filled = columnFillAmount(workbook, month, row, index);
                if (filled == null) {
                    return;
                }
                const cell = row.cells[index];
                if (!cell) {
                    return;
                }
                const text = String(filled);
                if (cell.raw !== text) {
                    cell.raw = text;
                    cell.display = text;
                }
            });
        });
    });
}
