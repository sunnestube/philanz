import {describe, it, expect, beforeEach} from 'vitest';
import {TableHistoryService} from './table-history.service';
import {Month} from '../model/Month';
import {MonthLabel, MonthKey} from '../model/MonthLabel';
import {MonthColumn} from '../model/MonthColumn';
import {MonthRow} from '../model/MonthRow';
import {CELL_TYPE} from '../model/CellType';
import {SECTION} from '../model/Section';

function buildMonth(): Month {
    const columns = [
        new MonthColumn('#', CELL_TYPE.index, SECTION.DEFAULT),
        new MonthColumn('A', CELL_TYPE.number, SECTION.AUSGANG),
        new MonthColumn('B', CELL_TYPE.number, SECTION.AUSGANG)
    ];
    const month = new Month(new MonthLabel(MonthKey.JAN), columns);
    for (let i = 0; i < 3; i++) {
        const row = new MonthRow(i, columns);
        row.cells[0].raw = String(i);
        row.cells[1].raw = `a${i}`;
        row.cells[2].raw = `b${i}`;
        month.rows.push(row);
    }
    return month;
}

describe('TableHistoryService', () => {
    let history: TableHistoryService;
    let month: Month;

    beforeEach(() => {
        history = new TableHistoryService();
        month = buildMonth();
    });

    it('undo/redo restores cell raw via inverse-diff', () => {
        history.record(month, [{row: 0, col: 1}], [0], () => {
            month.rows[0].cells[1].raw = 'changed';
        });
        expect(month.rows[0].cells[1].raw).toBe('changed');
        expect(history.undo(month)).toBe(true);
        expect(month.rows[0].cells[1].raw).toBe('a0');
        expect(history.redo(month)).toBe(true);
        expect(month.rows[0].cells[1].raw).toBe('changed');
    });

    it('caps stack depth at MAX_DEPTH', () => {
        for (let i = 0; i < TableHistoryService.MAX_DEPTH + 10; i++) {
            history.record(month, [{row: 0, col: 1}], [], () => {
                month.rows[0].cells[1].raw = `v${i}`;
            });
        }
        let count = 0;
        while (history.undo(month)) {
            count++;
        }
        expect(count).toBe(TableHistoryService.MAX_DEPTH);
    });

    it('clears redo stack on new push', () => {
        history.record(month, [{row: 0, col: 1}], [], () => {
            month.rows[0].cells[1].raw = 'one';
        });
        history.undo(month);
        expect(history.canRedo(month.label.title)).toBe(true);
        history.record(month, [{row: 0, col: 1}], [], () => {
            month.rows[0].cells[1].raw = 'two';
        });
        expect(history.canRedo(month.label.title)).toBe(false);
    });
});
