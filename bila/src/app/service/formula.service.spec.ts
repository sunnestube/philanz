import {describe, it, expect, beforeEach} from 'vitest';
import {FormulaService} from './formula.service';

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

        it('parses swiss numbers', () => {
            expect(service.toNumber("1'000.50")).toBe(1000.5);
            expect(service.toNumber("1'000,50")).toBe(1000.5);
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
            // cell at offset (1,0) from origin (2,4) → source (3,4); paste to (5,6)
            expect(service.adjustFormula('=A2', 3, 4, 5, 6)).toBe('=C4');
        });

        it('clears grid clipboard on single copyFormula', () => {
            service.copyGrid('=A1\t=B1', 0, 0);
            service.copyFormula('=C1', 1, 1);
            expect(service.gridClipboard).toBeNull();
            expect(service.pasteFormula(2, 2)).toBe('=D2');
        });
    });
});
