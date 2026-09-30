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

class EditProbe extends MonthTableEdit {
    runFill(fromRow: number, fromCol: number, toRow: number, toCol: number): void {
        this.fillRange(fromRow, fromCol, toRow, toCol);
    }
}

function buildMonth(rows = 8): Month {
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

describe('MonthTableEdit fill-handle', () => {
    let formula: FormulaService;
    let month: Month;
    let history: TableHistoryService;
    let edit: EditProbe;

    beforeEach(() => {
        formula = new FormulaService();
        month = buildMonth();
        formula.setMonths([month]);
        history = new TableHistoryService();
        const workbook = {touch: vi.fn(), history} as unknown as WorkbookService;
        edit = new EditProbe(formula, workbook, () => month, () => undefined, () => undefined);
    });

    it('copies a value down and across in one history step', () => {
        month.rows[1].cells[1].raw = '12,50';
        edit.runFill(1, 1, 3, 2);
        expect(month.rows[1].cells[1].raw).toBe('12,50');
        expect(month.rows[2].cells[1].raw).toBe('12,50');
        expect(month.rows[3].cells[1].raw).toBe('12,50');
        expect(month.rows[3].cells[2].raw).toBe('12,50');
        expect(month.rows[1].cells[2].raw).toBe('12,50');
        expect(history.canUndo(month.label.title)).toBe(true);
    });

    it('shifts relative formulas and keeps $ absolute', () => {
        month.rows[0].cells[1].raw = '=$A1+B$1';
        edit.runFill(0, 1, 2, 2);
        expect(month.rows[1].cells[1].raw).toBe('=$A2+B$1');
        expect(month.rows[2].cells[1].raw).toBe('=$A3+B$1');
        expect(month.rows[0].cells[2].raw).toBe('=$A1+C$1');
        expect(month.rows[2].cells[2].raw).toBe('=$A3+C$1');
    });

    it('undo restores the sheet before the fill', () => {
        month.rows[0].cells[1].raw = '=B1';
        month.rows[1].cells[1].raw = 'keep';
        edit.runFill(0, 1, 2, 1);
        expect(month.rows[1].cells[1].raw).toBe('=B2');
        expect(month.rows[2].cells[1].raw).toBe('=B3');
        history.undo(month);
        expect(month.rows[1].cells[1].raw).toBe('keep');
        expect(month.rows[2].cells[1].raw).toBe('');
        expect(month.rows[0].cells[1].raw).toBe('=B1');
    });
});
