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

/** Exposes protected paste/clear helpers for unit tests. */
class EditProbe extends MonthTableEdit {
    runPasteGrid(grid: string[][], startRow: number, startCol: number, clip?: string): void {
        this.pasteGrid(grid, startRow, startCol, clip);
    }
}

function buildMonth(rows = 6): Month {
    const columns = [
        new MonthColumn('#', CELL_TYPE.index, SECTION.DEFAULT),
        new MonthColumn('A', CELL_TYPE.number, SECTION.AUSGANG),
        new MonthColumn('B', CELL_TYPE.number, SECTION.AUSGANG),
        new MonthColumn('C', CELL_TYPE.number, SECTION.AUSGANG)
    ];
    const month = new Month(new MonthLabel(MonthKey.JAN), columns);
    for (let i = 0; i < rows; i++) {
        const row = new MonthRow(i, columns);
        row.cells[0].raw = String(i);
        month.rows.push(row);
    }
    return month;
}

describe('MonthTableEdit paste / clear', () => {
    let formula: FormulaService;
    let month: Month;
    let edit: EditProbe;

    beforeEach(() => {
        formula = new FormulaService();
        month = buildMonth();
        formula.setMonths([month]);
        const workbook = {
            touch: vi.fn(),
            history: new TableHistoryService()
        } as unknown as WorkbookService;
        edit = new EditProbe(formula, workbook, () => month, () => undefined, () => undefined);
    });

    it('single pasteFormula shifts relative refs', () => {
        formula.copyFormula('=A1+B1', 1, 0);
        const next = formula.pasteFormula(1, 2);
        expect(next).toBe('=A3+B3');
    });

    it('multi-paste adjusts each formula relative to copy origin', () => {
        const tsv = '=B1\t=$C$1\n=A1\t=B$1';
        formula.copyGrid(tsv, 1, 0);
        // paste block at (row 3, col 1) — delta +3 rows, +0 cols
        edit.runPasteGrid(
            [['=B1', '=$C$1'], ['=A1', '=B$1']],
            3,
            1,
            tsv
        );
        expect(month.rows[3].cells[1].raw).toBe('=B4');
        expect(month.rows[3].cells[2].raw).toBe('=$C$1');
        expect(month.rows[4].cells[1].raw).toBe('=A4');
        expect(month.rows[4].cells[2].raw).toBe('=B$1');
    });

    it('multi-paste without known origin leaves formulas raw', () => {
        formula.clipboard = null;
        formula.gridClipboard = null;
        edit.runPasteGrid([['=A1', '=B1']], 2, 1, '=A1\t=B1');
        expect(month.rows[2].cells[1].raw).toBe('=A1');
        expect(month.rows[2].cells[2].raw).toBe('=B1');
    });
});
