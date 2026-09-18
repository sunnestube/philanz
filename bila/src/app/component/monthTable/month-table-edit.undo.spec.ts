import {describe, it, expect, beforeEach, vi} from 'vitest';
import {MonthTableEdit} from './month-table-edit';
import {MonthTableEditX} from './month-table-edit-x';
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
    runPasteGrid(grid: string[][], startRow: number, startCol: number, clip?: string): void {
        this.pasteGrid(grid, startRow, startCol, clip);
    }
}

function buildMonth(rows = 6): Month {
    const columns = [
        new MonthColumn('#', CELL_TYPE.index, SECTION.DEFAULT),
        new MonthColumn('A', CELL_TYPE.number, SECTION.AUSGANG),
        new MonthColumn('B', CELL_TYPE.number, SECTION.AUSGANG),
        new MonthColumn('Pers', CELL_TYPE.select_person, SECTION.DEFAULT)
    ];
    const month = new Month(new MonthLabel(MonthKey.JAN), columns);
    for (let i = 0; i < rows; i++) {
        const row = new MonthRow(i, columns);
        row.cells[0].raw = String(i);
        row.cells[1].raw = `v${i}`;
        row.cells[2].raw = `=A${i + 1}`;
        row.cells[3].raw = 'P';
        row.cells[3].value = 'P';
        row.color = 'p';
        month.rows.push(row);
    }
    return month;
}

describe('MonthTableEdit undo/redo', () => {
    let formula: FormulaService;
    let history: TableHistoryService;
    let month: Month;
    let edit: EditProbe;
    let editX: MonthTableEditX;

    beforeEach(() => {
        formula = new FormulaService();
        history = new TableHistoryService();
        month = buildMonth();
        formula.setMonths([month]);
        const workbook = {
            touch: vi.fn(),
            history
        } as unknown as WorkbookService;
        edit = new EditProbe(formula, workbook, () => month, () => undefined, () => undefined);
        editX = new MonthTableEditX(formula, workbook, () => month, () => undefined, () => undefined);
    });

    it('single-cell commit undo/redo restores raw', () => {
        const cell = month.rows[1].cells[1];
        edit.selectCell(1, 1, cell);
        edit.draft = '999';
        edit.commitEdit(cell);
        expect(cell.raw).toBe('999');
        expect(edit.undo()).toBe(true);
        expect(cell.raw).toBe('v1');
        expect(edit.redo()).toBe(true);
        expect(cell.raw).toBe('999');
    });

    it('multi-paste undo restores entire block in one step', () => {
        const tsv = 'x\ty\nz\tw';
        edit.runPasteGrid([['x', 'y'], ['z', 'w']], 1, 1, tsv);
        expect(month.rows[1].cells[1].raw).toBe('x');
        expect(month.rows[1].cells[2].raw).toBe('y');
        expect(month.rows[2].cells[1].raw).toBe('z');
        expect(month.rows[2].cells[2].raw).toBe('w');
        expect(edit.undo()).toBe(true);
        expect(month.rows[1].cells[1].raw).toBe('v1');
        expect(month.rows[1].cells[2].raw).toBe('=A2');
        expect(month.rows[2].cells[1].raw).toBe('v2');
        expect(month.rows[2].cells[2].raw).toBe('=A3');
    });

    it('range Delete undo restores cells and person color', () => {
        editX.range.reset(1, 1);
        editX.range.extend(2, 3); // includes person col
        const event = new KeyboardEvent('keydown', {key: 'Delete'});
        editX.onKeydown(event, 1, 1, month.rows[1].cells[1]);
        expect(month.rows[1].cells[1].raw).toBe('');
        expect(month.rows[1].cells[3].raw).toBe('');
        expect(month.rows[1].color).toBe('');
        expect(editX.undo()).toBe(true);
        expect(month.rows[1].cells[1].raw).toBe('v1');
        expect(month.rows[1].cells[3].raw).toBe('P');
        expect(month.rows[1].color).toBe('p');
        expect(month.rows[2].cells[2].raw).toBe('=A3');
    });

    it('Ctrl+Z / Ctrl+Y keyboard triggers undo/redo', () => {
        const cell = month.rows[0].cells[1];
        edit.selectCell(0, 1, cell);
        edit.draft = 'abc';
        edit.commitEdit(cell);
        const z = new KeyboardEvent('keydown', {key: 'z', ctrlKey: true});
        edit.onKeydown(z, 0, 1, cell);
        expect(cell.raw).toBe('v0');
        const y = new KeyboardEvent('keydown', {key: 'y', ctrlKey: true});
        edit.onKeydown(y, 0, 1, cell);
        expect(cell.raw).toBe('abc');
        // Shift+Z also redo
        edit.undo();
        const sz = new KeyboardEvent('keydown', {key: 'Z', ctrlKey: true, shiftKey: true});
        edit.onKeydown(sz, 0, 1, cell);
        expect(cell.raw).toBe('abc');
    });

    it('commit after live input still undoes to editOriginal (not the typed raw)', () => {
        const cell = month.rows[1].cells[1];
        edit.selectCell(1, 1, cell);
        // Simulate onCellInput writing through to cell.raw before blur/commit
        cell.raw = 'typed';
        edit.draft = 'typed';
        edit.commitEdit(cell);
        expect(cell.raw).toBe('typed');
        expect(edit.undo()).toBe(true);
        expect(cell.raw).toBe('v1');
    });

    it('person select change undoes both value/raw and row color', () => {
        const cell = month.rows[0].cells[3];
        edit.selectCell(0, 3, cell);
        cell.value = 'H';
        edit.applySelectSideEffects(cell, month.rows[0], ['', 'P', 'H', 'L']);
        edit.recordSelectChange(cell, month.rows[0], 0, 3);
        expect(cell.raw).toBe('H');
        expect(month.rows[0].color).toBe('h');
        expect(edit.undo()).toBe(true);
        expect(cell.raw).toBe('P');
        expect(cell.value).toBe('P');
        expect(month.rows[0].color).toBe('p');
        expect(edit.redo()).toBe(true);
        expect(cell.raw).toBe('H');
        expect(cell.value).toBe('H');
        expect(month.rows[0].color).toBe('h');
    });

    it('Ctrl+Z inside an input does not trigger app undo', () => {
        const cell = month.rows[0].cells[1];
        edit.selectCell(0, 1, cell);
        edit.draft = 'keep';
        edit.commitEdit(cell);
        const input = document.createElement('input');
        document.body.appendChild(input);
        const z = new KeyboardEvent('keydown', {key: 'z', ctrlKey: true, bubbles: true});
        Object.defineProperty(z, 'target', {value: input});
        const handled = edit.onKeydown(z, 0, 1, cell);
        expect(cell.raw).toBe('keep');
        expect(history.canUndo(month.label.title)).toBe(true);
        input.remove();
    });

});
