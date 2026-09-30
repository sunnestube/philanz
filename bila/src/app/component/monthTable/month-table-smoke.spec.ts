import {describe, it, expect, beforeEach, vi} from 'vitest';
import {MonthTableEdit} from './month-table-edit';
import {FormulaService} from '../../service/formula.service';
import {WorkbookService} from '../../service/workbook.service';
import {TableHistoryService} from '../../service/table-history.service';
import {Month} from '../../model/Month';
import {MonthLabel, MonthKey} from '../../model/MonthLabel';
import {MonthColumn} from '../../model/MonthColumn';
import {MonthRow} from '../../model/MonthRow';
import {CELL_TYPE} from '../../model/CellType';
import {SECTION} from '../../model/Section';

/**
 * Smoke for issue #11: 200-row month, virtual window slice, multi-paste, undo.
 * Fail = unhandled exception or wrong restore. No FPS benchmark.
 * Run: cd bila && npm test
 */

class EditProbe extends MonthTableEdit {
    runPasteGrid(grid: string[][], startRow: number, startCol: number, clip?: string): void {
        this.pasteGrid(grid, startRow, startCol, clip);
    }
}

const ROW_HEIGHT = 18;
const VIEW_OVERSCAN = 16;

function windowOf(scrollTop: number, clientHeight: number, rowCount: number): {start: number; end: number} {
    const first = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - VIEW_OVERSCAN);
    const visible = Math.ceil(clientHeight / ROW_HEIGHT) + VIEW_OVERSCAN * 2;
    const end = Math.min(rowCount, first + visible);
    return {start: first, end};
}

function buildMonth(rows: number): Month {
    const columns = [
        new MonthColumn('#', CELL_TYPE.index, SECTION.DEFAULT),
        new MonthColumn('A', CELL_TYPE.number, SECTION.AUSGANG),
        new MonthColumn('B', CELL_TYPE.number, SECTION.AUSGANG)
    ];
    const month = new Month(new MonthLabel(MonthKey.JAN), columns);
    for (let i = 0; i < rows; i++) {
        const row = new MonthRow(i, columns);
        row.cells[0].raw = String(i);
        row.cells[1].raw = String(i);
        month.rows.push(row);
    }
    return month;
}

describe('200-row month smoke', () => {
    let formula: FormulaService;
    let month: Month;
    let history: TableHistoryService;
    let edit: EditProbe;

    beforeEach(() => {
        formula = new FormulaService();
        month = buildMonth(200);
        formula.setMonths([month]);
        history = new TableHistoryService();
        const workbook = {touch: vi.fn(), history} as unknown as WorkbookService;
        edit = new EditProbe(formula, workbook, () => month, () => undefined, () => undefined);
    });

    it('scrolls a virt window, pastes relative formulas, and undoes without throwing', () => {
        expect(month.rows.length).toBe(200);
        const nearEnd = windowOf(180 * ROW_HEIGHT, 400, month.rows.length);
        expect(nearEnd.end).toBe(200);
        expect(nearEnd.start).toBeLessThan(180);
        const slice = month.rows.slice(nearEnd.start, nearEnd.end);
        expect(slice.length).toBeGreaterThan(0);
        expect(slice[slice.length - 1].cells[1].raw).toBe('199');

        const tsv = '=A1\t=$A$1';
        formula.copyGrid(tsv, 1, 0);
        edit.runPasteGrid([['=A1', '=$A$1']], 150, 1, tsv);
        expect(month.rows[150].cells[1].raw).toBe('=A151');
        expect(month.rows[150].cells[2].raw).toBe('=$A$1');

        history.undo(month);
        expect(month.rows[150].cells[1].raw).toBe('150');
        expect(month.rows[150].cells[2].raw).toBe('');
    });
});
