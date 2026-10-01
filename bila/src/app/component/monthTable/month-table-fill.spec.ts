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
import {
    FILL_EDGE_PX,
    FILL_LETTER_ROW_HEIGHT,
    FILL_ROW_HEIGHT,
    FILL_SCROLL_PX,
    colFromOffsets,
    edgeScrollDelta,
    rowFromScroll
} from './month-table-fill-hit';

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

/** Matches VIEW_SIZE_MIN — rows at/above this index are outside a viewStart=0 window. */
const VIEW_SIZE_MIN = 48;

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

    /**
     * Issue #29: fill past the virt window (viewStart≈0, target not in DOM).
     * Timeout guard mirrors #26 — artificial 2s delay would fail this bound.
     */
    it('fill 2→80 writes unrendered rows in one undo under 800ms', () => {
        month = buildMonth(100);
        formula.setMonths([month]);
        const workbook = {touch: vi.fn(), history} as unknown as WorkbookService;
        edit = new EditProbe(formula, workbook, () => month, () => undefined, () => undefined);

        const viewStart = 0;
        expect(80).toBeGreaterThanOrEqual(viewStart + VIEW_SIZE_MIN);

        const headerH = FILL_LETTER_ROW_HEIGHT + 84;
        const pointerY = headerH + 80 * FILL_ROW_HEIGHT;
        expect(rowFromScroll(0, pointerY, headerH, FILL_ROW_HEIGHT, month.rows.length)).toBe(80);

        month.rows[2].cells[1].raw = '9,00';
        const t0 = performance.now();
        edit.runFill(2, 1, 80, 1);
        expect(performance.now() - t0).toBeLessThan(800);

        for (let r = 2; r <= 80; r++) {
            expect(month.rows[r].cells[1].raw).toBe('9,00');
        }
        history.undo(month);
        expect(month.rows[2].cells[1].raw).toBe('9,00');
        for (let r = 3; r <= 80; r++) {
            expect(month.rows[r].cells[1].raw).toBe('');
        }
    });
});

describe('fill-hit scroll geometry (#29)', () => {
    it('resolves a row past VIEW_SIZE_MIN with viewStart/scrollTop at 0', () => {
        const headerH = FILL_LETTER_ROW_HEIGHT + 84;
        const viewStart = 0;
        const target = 80;
        expect(target).toBeGreaterThanOrEqual(viewStart + VIEW_SIZE_MIN);
        const y = headerH + target * FILL_ROW_HEIGHT;
        expect(rowFromScroll(0, y, headerH, FILL_ROW_HEIGHT, 100)).toBe(80);
        expect(rowFromScroll(0, headerH + 2 * FILL_ROW_HEIGHT, headerH, FILL_ROW_HEIGHT, 100)).toBe(2);
    });

    it('maps column from cumulative widths and scrollLeft', () => {
        const widths = [20, 46, 46, 46];
        expect(colFromOffsets(0, 10, widths)).toBe(0);
        expect(colFromOffsets(0, 25, widths)).toBe(1);
        expect(colFromOffsets(40, 30, widths)).toBe(2);
        expect(colFromOffsets(0, 999, widths)).toBe(3);
    });

    it('emits edge scroll deltas inside the FILL_EDGE_PX band', () => {
        const rect = {top: 100, bottom: 400, left: 50, right: 500};
        expect(edgeScrollDelta(200, 395, rect, FILL_EDGE_PX, FILL_SCROLL_PX)).toEqual({
            dx: 0,
            dy: FILL_SCROLL_PX
        });
        expect(edgeScrollDelta(200, 105, rect, FILL_EDGE_PX, FILL_SCROLL_PX)).toEqual({
            dx: 0,
            dy: -FILL_SCROLL_PX
        });
        expect(edgeScrollDelta(490, 250, rect, FILL_EDGE_PX, FILL_SCROLL_PX)).toEqual({
            dx: FILL_SCROLL_PX,
            dy: 0
        });
        expect(edgeScrollDelta(250, 250, rect, FILL_EDGE_PX, FILL_SCROLL_PX)).toEqual({
            dx: 0,
            dy: 0
        });
    });
});
