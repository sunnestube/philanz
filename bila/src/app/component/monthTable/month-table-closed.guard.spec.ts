import {describe, it, expect, beforeEach} from 'vitest';
import {WorkbookService} from '../../service/workbook.service';
import {FormulaService} from '../../service/formula.service';
import {TableHistoryService} from '../../service/table-history.service';
import {CurrencyFxService} from '../../service/currency-fx.service';
import {MonthTableEditX} from './month-table-edit-x';
import {Month} from '../../model/Month';
import {MonthLabel, MonthKey} from '../../model/MonthLabel';
import {MonthColumn} from '../../model/MonthColumn';
import {CELL_TYPE} from '../../model/CellType';
import {MonthRow} from '../../model/MonthRow';

function makeMonth(title: MonthKey): Month {
    const columns = [
        new MonthColumn('Month', CELL_TYPE.none),
        new MonthColumn('Line', CELL_TYPE.index),
        new MonthColumn('Text', CELL_TYPE.text),
        new MonthColumn('Amt', CELL_TYPE.number)
    ];
    const month = new Month(new MonthLabel(title), columns);
    const row = new MonthRow(0, columns);
    row.cells[0].raw = title;
    row.cells[1].raw = '0';
    row.cells[2].raw = 'A';
    row.cells[3].raw = '1';
    month.rows.push(row);
    return month;
}

describe('MonthTableEditX closed guards', () => {
    let workbook: WorkbookService;
    let formula: FormulaService;
    let month: Month;
    let edit: MonthTableEditX;

    beforeEach(() => {
        formula = new FormulaService();
        workbook = new WorkbookService(formula, new TableHistoryService(), new CurrencyFxService());
        month = makeMonth(MonthKey.JAN);
        workbook.setMonths([month]);
        edit = new MonthTableEditX(
            formula,
            workbook,
            () => month,
            () => undefined,
            () => undefined
        );
    });

    it('blocks startEdit / paste when month closed', () => {
        const cell = month.rows[0].cells[3];
        workbook.setMonthClosed('Jan', true);
        edit.startEdit(0, 3, cell);
        expect(edit.liveEdit).toBe(false);

        const paste = {
            preventDefault() {},
            clipboardData: {getData: () => '9'}
        } as unknown as ClipboardEvent;
        edit.onPaste(paste, 0, 3, cell);
        expect(cell.raw).toBe('1');

        workbook.setMonthClosed('Jan', false);
        edit.startEdit(0, 3, cell);
        expect(edit.liveEdit).toBe(true);
    });

    it('year closed blocks edits until reopened', () => {
        const cell = month.rows[0].cells[3];
        workbook.setYearClosed(true);
        edit.startEdit(0, 3, cell);
        expect(edit.liveEdit).toBe(false);
        workbook.setYearClosed(false);
        edit.startEdit(0, 3, cell);
        expect(edit.liveEdit).toBe(true);
    });
});
