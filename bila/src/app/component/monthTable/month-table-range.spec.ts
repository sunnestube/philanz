import {describe, it, expect, beforeEach} from 'vitest';
import {MonthTableRange} from './month-table-range';
import {FormulaService} from '../../service/formula.service';
import {Month} from '../../model/Month';
import {MonthLabel, MonthKey} from '../../model/MonthLabel';
import {MonthColumn} from '../../model/MonthColumn';
import {MonthRow} from '../../model/MonthRow';
import {CELL_TYPE} from '../../model/CellType';
import {SECTION} from '../../model/Section';

function buildMonth(): Month {
    const columns = [
        new MonthColumn('#', CELL_TYPE.index, SECTION.DEFAULT),
        new MonthColumn('A', CELL_TYPE.number, SECTION.AUSGANG),
        new MonthColumn('B', CELL_TYPE.number, SECTION.AUSGANG),
        new MonthColumn('C', CELL_TYPE.number, SECTION.AUSGANG)
    ];
    const month = new Month(new MonthLabel(MonthKey.JAN), columns);
    for (let i = 0; i < 5; i++) {
        const row = new MonthRow(i, columns);
        row.cells[0].raw = String(i);
        row.cells[1].raw = i === 0 ? '=B1' : '';
        row.cells[2].raw = i === 0 ? '=$C$1' : String(i * 2);
        row.cells[3].raw = i === 1 ? '=A1' : '';
        month.rows.push(row);
    }
    return month;
}

describe('MonthTableRange', () => {
    let range: MonthTableRange;
    let formula: FormulaService;
    let month: Month;

    beforeEach(() => {
        formula = new FormulaService();
        range = new MonthTableRange(formula);
        month = buildMonth();
    });

    it('reset and contains define a single cell', () => {
        range.reset(2, 1);
        expect(range.contains(2, 1)).toBe(true);
        expect(range.contains(2, 2)).toBe(false);
        expect(range.multi()).toBe(false);
    });

    it('extend grows a rectangular range', () => {
        range.reset(1, 1);
        range.extend(3, 3);
        expect(range.row0).toBe(1);
        expect(range.row1).toBe(3);
        expect(range.col0).toBe(1);
        expect(range.col1).toBe(3);
        expect(range.multi()).toBe(true);
        expect(range.contains(2, 2)).toBe(true);
        expect(range.contains(0, 1)).toBe(false);
    });

    it('step moves by one cell', () => {
        expect(range.step(month, 2, 2, 'ArrowUp')).toEqual({row: 1, col: 2});
        expect(range.step(month, 2, 2, 'ArrowRight')).toEqual({row: 2, col: 3});
    });

    it('copyTsv registers grid clipboard at range origin', () => {
        range.reset(0, 1);
        range.extend(1, 2);
        const tsv = range.copyTsv(month);
        expect(tsv).toBe('=B1\t=$C$1\n\t2');
        expect(range.copyRow).toBe(0);
        expect(range.copyCol).toBe(1);
        expect(formula.gridClipboard).toEqual({text: tsv, col: 1, row: 0});
    });

    it('selectRows enables row mode across columns', () => {
        range.selectRows(2, 3, false);
        expect(range.rowMode).toBe(true);
        expect(range.row0).toBe(2);
        expect(range.col0).toBe(0);
        expect(range.col1).toBe(3);
    });
});
