import {describe, it, expect, beforeEach, vi} from 'vitest';
import {FormulaService} from './formula.service';
import {Month} from '../model/Month';
import {MonthLabel, MonthKey} from '../model/MonthLabel';
import {MonthColumn} from '../model/MonthColumn';
import {MonthRow} from '../model/MonthRow';
import {CELL_TYPE} from '../model/CellType';
import {SECTION} from '../model/Section';

function buildMonth(key: MonthKey, rows = 3): Month {
    const columns = [
        new MonthColumn('#', CELL_TYPE.index, SECTION.DEFAULT),
        new MonthColumn('A', CELL_TYPE.number, SECTION.AUSGANG),
        new MonthColumn('B', CELL_TYPE.number, SECTION.AUSGANG),
        new MonthColumn('C', CELL_TYPE.number, SECTION.AUSGANG)
    ];
    const month = new Month(new MonthLabel(key), columns);
    for (let i = 0; i < rows; i++) {
        const row = new MonthRow(i, columns);
        row.cells[0].raw = String(i);
        month.rows.push(row);
    }
    return month;
}

describe('FormulaService', () => {
    let service: FormulaService;

    beforeEach(() => {
        service = new FormulaService();
    });

    describe('adjustFormula — relative refs', () => {
        it('shifts relative references down', () => {
            expect(service.adjustFormula('=B1', 0, 0, 0, 2)).toBe('=B3');
        });

        it('shifts relative references right', () => {
            expect(service.adjustFormula('=B1', 0, 0, 1, 0)).toBe('=C1');
        });

        it('shifts relative references diagonally', () => {
            expect(service.adjustFormula('=B1', 0, 0, 2, 2)).toBe('=D3');
        });

        it('shifts multiple relative references', () => {
            expect(service.adjustFormula('=A1+B2', 0, 0, 0, 1)).toBe('=A2+B3');
        });
    });

    describe('adjustFormula — absolute refs', () => {
        it('keeps column absolute when shifting right', () => {
            expect(service.adjustFormula('=$B1', 0, 0, 1, 0)).toBe('=$B1');
        });

        it('keeps row absolute when shifting down', () => {
            expect(service.adjustFormula('=B$1', 0, 0, 0, 1)).toBe('=B$1');
        });

        it('keeps fully absolute refs', () => {
            expect(service.adjustFormula('=$B$1', 0, 0, 2, 2)).toBe('=$B$1');
        });

        it('shifts row but keeps column absolute', () => {
            expect(service.adjustFormula('=$B1', 0, 0, 0, 2)).toBe('=$B3');
        });

        it('shifts column but keeps row absolute', () => {
            expect(service.adjustFormula('=B$1', 0, 0, 2, 0)).toBe('=D$1');
        });
    });

    describe('adjustFormula — arithmetic', () => {
        it('adjusts + and * with parentheses', () => {
            expect(service.adjustFormula('=A1+(B1*C1)', 0, 0, 0, 1)).toBe('=A2+(B2*C2)');
            expect(service.adjustFormula('=A1*B1', 0, 0, 1, 0)).toBe('=B1*C1');
        });
    });

    describe('parseAddress', () => {
        it('parses relative and absolute forms', () => {
            expect(service.parseAddress('A1', 'Jan')).toMatchObject({col: 0, row: 0, colAbs: false, rowAbs: false});
            expect(service.parseAddress('$B2', 'Jan')).toMatchObject({colAbs: true, rowAbs: false});
            expect(service.parseAddress('C$3', 'Jan')).toMatchObject({colAbs: false, rowAbs: true});
            expect(service.parseAddress('$D$4', 'Jan')).toMatchObject({colAbs: true, rowAbs: true});
        });
    });

    describe('isFormula / columnLetter / toNumber', () => {
        it('detects formulas', () => {
            expect(service.isFormula('=A1')).toBe(true);
            expect(service.isFormula('  =A1')).toBe(true);
            expect(service.isFormula('A1')).toBe(false);
            expect(service.isFormula('')).toBe(false);
            expect(service.isFormula(null)).toBe(false);
        });

        it('maps column letters', () => {
            expect(service.columnLetter(0)).toBe('A');
            expect(service.columnLetter(25)).toBe('Z');
            expect(service.columnLetter(26)).toBe('AA');
        });

        it('parses swiss and german locale numbers', () => {
            expect(service.toNumber("1'000.50")).toBe(1000.5);
            expect(service.toNumber("1'000,50")).toBe(1000.5);
            expect(service.toNumber('1.234,56')).toBe(1234.56);
            expect(service.toNumber('1.234.567,89')).toBe(1234567.89);
            expect(service.toNumber('1.234')).toBe(1234);
            expect(service.toNumber('1,234.56')).toBe(1234.56);
            expect(service.toNumber('12,5')).toBe(12.5);
            expect(service.toNumber('12.5')).toBe(12.5);
            expect(service.toNumber('=A1')).toBeNull();
        });
    });

    describe('copyFormula / pasteFormula (single)', () => {
        it('pastes with relative adjust from clipboard origin', () => {
            service.copyFormula('=A1', 0, 0);
            expect(service.pasteFormula(1, 1)).toBe('=B2');
        });

        it('pastes plain text unchanged', () => {
            service.copyFormula('Hello', 0, 0);
            expect(service.pasteFormula(1, 1)).toBe('Hello');
        });

        it('leaves external formula text unchanged when no matching origin', () => {
            service.clipboard = null;
            service.gridClipboard = null;
            expect(service.pasteFormula(2, 2, '=A1+B1')).toBe('=A1+B1');
        });

        it('respects $ on single paste', () => {
            service.copyFormula('=$A1+B$1', 0, 0);
            expect(service.pasteFormula(2, 3)).toBe('=$A4+D$1');
        });
    });

    describe('copyGrid / multi-paste origin', () => {
        it('records grid origin for relative multi-paste', () => {
            const tsv = '=A1\t=$B$1\n=A2\t=B$1';
            service.copyGrid(tsv, 2, 4);
            expect(service.pasteSource(tsv)).toEqual({col: 2, row: 4});
            expect(service.adjustFormula('=A2', 3, 4, 5, 6)).toBe('=C4');
        });

        it('clears grid clipboard on single copyFormula', () => {
            service.copyGrid('=A1\t=B1', 0, 0);
            service.copyFormula('=C1', 1, 1);
            expect(service.gridClipboard).toBeNull();
            expect(service.pasteFormula(2, 2)).toBe('=D2');
        });
    });

    describe('recalculateDirty', () => {
        it('updates local dependents without sweeping unrelated cells', () => {
            const jan = buildMonth(MonthKey.JAN);
            jan.rows[0].cells[1].raw = '10';
            jan.rows[0].cells[2].raw = '=A1';
            jan.rows[0].cells[3].raw = '99';
            service.setMonths([jan]);
            expect(jan.rows[0].cells[2].display).toBe("10.00");
            expect(jan.rows[0].cells[3].display).toBe("99.00");

            const untouched = jan.rows[0].cells[3];
            const sentinel = untouched.display;
            const spy = vi.spyOn(service, 'evaluateCell');

            jan.rows[0].cells[1].raw = '25';
            service.recalculateDirty([{monthTitle: 'Jan', col: 1, row: 0}]);

            expect(jan.rows[0].cells[2].display).toBe("25.00");
            expect(untouched.display).toBe(sentinel);
            const evaluated = spy.mock.calls.map(
                ([, cell]) => `${cell.columnIndex}:${cell.rowIndex}`
            );
            expect(evaluated).toContain('1:0');
            expect(evaluated).toContain('2:0');
            expect(evaluated).not.toContain('3:0');
            spy.mockRestore();
        });

        it('updates cross-month refs and leaves Dez cells without formulas alone', () => {
            const jan = buildMonth(MonthKey.JAN);
            const dez = buildMonth(MonthKey.DEZ);
            jan.rows[1].cells[2].raw = '7';
            dez.rows[1].cells[2].raw = '42';
            dez.rows[1].cells[3].raw = '=Jan!B2';
            service.setMonths([jan, dez]);
            expect(dez.rows[1].cells[3].display).toBe("7.00");
            expect(dez.rows[1].cells[2].display).toBe("42.00");

            const plainDez = dez.rows[1].cells[2];
            const sentinel = plainDez.display;
            const spy = vi.spyOn(service, 'evaluateCell');

            jan.rows[1].cells[2].raw = '15';
            service.recalculateDirty([{monthTitle: 'Jan', col: 2, row: 1}]);

            expect(dez.rows[1].cells[3].display).toBe("15.00");
            expect(plainDez.display).toBe(sentinel);
            const evaluated = spy.mock.calls.map(
                ([month, cell]) => `${month.label.title}:${cell.columnIndex}:${cell.rowIndex}`
            );
            expect(evaluated).toContain('Jan:2:1');
            expect(evaluated).toContain('Dez:3:1');
            expect(evaluated).not.toContain('Dez:2:1');
            spy.mockRestore();
        });

        it('keeps #ZYKLUS! and #BEZUG! on dirty path', () => {
            const jan = buildMonth(MonthKey.JAN);
            // Self-ref is the reliable cycle (mutual A↔B can surface as #WERT!).
            jan.rows[0].cells[1].raw = '=A1';
            service.setMonths([jan]);
            expect(jan.rows[0].cells[1].display).toBe('#ZYKLUS!');

            service.recalculateDirty([{monthTitle: 'Jan', col: 1, row: 0}]);
            expect(jan.rows[0].cells[1].display).toBe('#ZYKLUS!');

            jan.rows[0].cells[3].raw = '=Xxx!A1';
            service.recalculateDirty([{monthTitle: 'Jan', col: 3, row: 0}]);
            expect(jan.rows[0].cells[3].display).toBe('#BEZUG!');
        });
    });

});
