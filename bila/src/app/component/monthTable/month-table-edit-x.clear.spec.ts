import {describe, it, expect, beforeEach, vi} from 'vitest';
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

describe('MonthTableEditX clear + keyboard range', () => {
    let formula: FormulaService;
    let month: Month;
    let edit: MonthTableEditX;

    beforeEach(() => {
        formula = new FormulaService();
        const columns = [
            new MonthColumn('#', CELL_TYPE.index, SECTION.DEFAULT),
            new MonthColumn('A', CELL_TYPE.number, SECTION.AUSGANG),
            new MonthColumn('B', CELL_TYPE.number, SECTION.AUSGANG),
            new MonthColumn('Pers', CELL_TYPE.select_person, SECTION.DEFAULT)
        ];
        month = new Month(new MonthLabel(MonthKey.JAN), columns);
        for (let i = 0; i < 4; i++) {
            const row = new MonthRow(i, columns);
            row.cells[0].raw = String(i);
            row.cells[1].raw = `v${i}`;
            row.cells[2].raw = `=A${i + 1}`;
            row.cells[3].raw = 'P';
            row.cells[3].value = 'P';
            row.color = 'p';
            month.rows.push(row);
        }
        formula.setMonths([month]);
        const workbook = {touch: vi.fn(), history: new TableHistoryService()} as unknown as WorkbookService;
        edit = new MonthTableEditX(formula, workbook, () => month, () => undefined, () => undefined);
    });

    it('Delete clears the selected range and refreshes person color', () => {
        edit.range.reset(1, 1);
        edit.range.extend(2, 2);
        const event = new KeyboardEvent('keydown', {key: 'Delete'});
        edit.onKeydown(event, 1, 1, month.rows[1].cells[1]);
        expect(month.rows[1].cells[1].raw).toBe('');
        expect(month.rows[1].cells[2].raw).toBe('');
        expect(month.rows[2].cells[1].raw).toBe('');
        expect(month.rows[2].cells[2].raw).toBe('');
        // person cell outside clear range stays; color synced from person
        expect(month.rows[1].color).toBe('p');
    });

    it('Shift+Arrow extends the range', () => {
        edit.range.reset(0, 1);
        const event = new KeyboardEvent('keydown', {key: 'ArrowDown', shiftKey: true});
        // stub focus to avoid DOM
        edit.range.focusCell = () => undefined;
        edit.onKeydown(event, 0, 1, month.rows[0].cells[1]);
        expect(edit.range.row0).toBe(0);
        expect(edit.range.row1).toBe(1);
        expect(edit.range.col0).toBe(1);
        expect(edit.range.col1).toBe(1);
    });
});
