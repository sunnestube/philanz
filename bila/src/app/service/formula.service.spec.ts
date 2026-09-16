import { describe, it, expect, beforeEach } from 'vitest';
import { FormulaService } from './formula.service';
import { Month } from '../model/Month';
import { MonthLabel } from '../model/MonthLabel';
import { MonthColumn } from '../model/MonthColumn';
import { MonthRow } from '../model/MonthRow';
import { MonthCell } from '../model/MonthCell';
import { CELL_TYPE } from '../model/CellType';
import { SECTION } from '../model/Section';
import { CellType } from '../model/CellType';

describe('FormulaService', () => {
    let service: FormulaService;
    let testMonth: Month;

    beforeEach(() => {
        service = new FormulaService();
        
        // Setup test month with columns
        testMonth = new Month(new MonthLabel('Jan', 0));
        testMonth.columns = [
            new MonthColumn('Index', CELL_TYPE.index, SECTION.NONE),
            new MonthColumn('A', CELL_TYPE.number, SECTION.AUSGANG),
            new MonthColumn('B', CELL_TYPE.number, SECTION.AUSGANG),
            new MonthColumn('C', CELL_TYPE.number, SECTION.AUSGANG)
        ];
        
        // Add test rows
        for (let i = 0; i < 3; i++) {
            const row = new MonthRow(i, testMonth.columns);
            row.cells[0].raw = String(i);
            row.cells[1].raw = String(i + 1);
            row.cells[2].raw = String((i + 1) * 2);
            row.cells[3].raw = '';
            testMonth.rows.push(row);
        }
        
        service.setMonths([testMonth]);
    });

    describe('adjustFormula - Relative References', () => {
        it('should shift relative references down', () => {
            // Formula at A1: =B1
            const formula = '=B1';
            const adjusted = service.adjustFormula(formula, 0, 0, 0, 2);
            expect(adjusted).toBe('=B3');
        });

        it('should shift relative references right', () => {
            // Formula at A1: =B1
            const formula = '=B1';
            const adjusted = service.adjustFormula(formula, 0, 0, 1, 0);
            expect(adjusted).toBe('=C1');
        });

        it('should shift relative references diagonally', () => {
            // Formula at A1: =B1 pasted to C3
            const formula = '=B1';
            const adjusted = service.adjustFormula(formula, 0, 0, 2, 2);
            expect(adjusted).toBe('=D3');
        });

        it('should handle multiple relative references', () => {
            // Formula: =A1+B2 pasted down by 1 row
            const formula = '=A1+B2';
            const adjusted = service.adjustFormula(formula, 0, 0, 0, 1);
            expect(adjusted).toBe('=A2+B3');
        });
    });

    describe('adjustFormula - Absolute References', () => {
        it('should preserve column absolute references', () => {
            // Formula: =$B1 pasted right
            const formula '=$B1';
            const adjusted = service.adjustFormula(formula, 0, 0, 1, 0);
            expect(adjusted).toBe('=$B1');
        });

        it('should preserve row absolute references', () => {
            // Formula: =B$1 pasted down
            const formula = '=B$1';
            const adjusted = service.adjustFormula(formula, 0, 0, 0, 1);
            expect(adjusted).toBe('=B$1');
        });

        it('should preserve both absolute references', () => {
            // Formula: =$B$1 pasted anywhere
            const formula = '=$B$1';
            const adjusted = service.adjustFormula(formula, 0, 0, 2, 2);
            expect(adjusted).toBe('=$B$1');
        });

        it('should shift row but keep column absolute', () => {
            // Formula: =$B1 pasted down
            const formula = '=$B1';
            const adjusted = service.adjustFormula(formula, 0, 0, 0, 2);
            expect(adjusted).toBe('=$B3');
        });

        it('should shift column but keep row absolute', () => {
            // Formula: =B$1 pasted right
            const formula = '=B$1';
            const adjusted = service.adjustFormula(formula, 0, 0, 2, 0);
            expect(adjusted).toBe('=D$1');
        });
    });

    describe('adjustFormula - Mixed Operations', () => {
        it('should adjust arithmetic formulas', () => {
            // Formula: =A1+B1 pasted down
            const formula = '=A1+B1';
            const adjusted = service.adjustFormula(formula, 0, 0, 0, 1);
            expect(adjusted).toBe('=A2+B2');
        });

        it('should adjust multiplication formulas', () => {
            // Formula: =A1*B1 pasted right
            const formula = '=A1*B1';
            const adjusted = service.adjustFormula(formula, 0, 0, 1, 0);
            expect(adjusted).toBe('=B1*C1');
        });

        it('should adjust complex formulas', () => {
            // Formula: =A1+(B1*C1) pasted down
            const formula = '=A1+(B1*C1)';
            const adjusted = service.adjustFormula(formula, 0, 0, 0, 1);
            expect(adjusted).toBe('=A2+(B2*C2)');
        });
    });

    describe('parseAddress', () => {
        it('should parse simple cell reference', () => {
            const addr = service.parseAddress('A1', 'Jan');
            expect(addr).not.toBeNull();
            expect(addr?.col).toBe(0);
            expect(addr?.row).toBe(0);
            expect(addr?.colAbs).toBe(false);
            expect(addr?.rowAbs).toBe(false);
        });

        it('should parse column absolute reference', () => {
            const addr = service.parseAddress('$B2', 'Jan');
            expect(addr?.colAbs).toBe(true);
            expect(addr?.rowAbs).toBe(false);
        });

        it('should parse row absolute reference', () => {
            const addr = service.parseAddress('C$3', 'Jan');
            expect(addr?.colAbs).toBe(false);
            expect(addr?.rowAbs).toBe(true);
        });

        it('should parse both absolute reference', () => {
            const addr = service.parseAddress('$D$4', 'Jan');
            expect(addr?.colAbs).toBe(true);
            expect(addr?.rowAbs).toBe(true);
        });
    });

    describe('isFormula', () => {
        it('should identify formulas', () => {
            expect(service.isFormula('=A1')).toBe(true);
            expect(service.isFormula('=A1+B1')).toBe(true);
            expect(service.isFormula('  =A1')).toBe(true);
        });

        it('should reject non-formulas', () => {
            expect(service.isFormula('A1')).toBe(false);
            expect(service.isFormula('123')).toBe(false);
            expect(service.isFormula('')).toBe(false);
            expect(service.isFormula(null)).toBe(false);
        });
    });

    describe('toNumber', () => {
        it('should convert valid numbers', () => {
            expect(service.toNumber('123')).toBe(123);
            expect(service.toNumber('123.45')).toBe(123.45);
            expect(service.toNumber('-50')).toBe(-50);
        });

        it('should handle Swiss formatting', () => {
            expect(service.toNumber("1'000.50")).toBe(1000.50);
            expect(service.toNumber("1'000,50")).toBe(1000.50);
        });

        it('should reject formulas', () => {
            expect(service.toNumber('=A1')).toBeNull();
        });

        it('should reject empty strings', () => {
            expect(service.toNumber('')).toBeNull();
            expect(service.toNumber('   ')).toBeNull();
        });
    });

    describe('columnLetter', () => {
        it('should convert index to letters', () => {
            expect(service.columnLetter(0)).toBe('A');
            expect(service.columnLetter(1)).toBe('B');
            expect(service.columnLetter(25)).toBe('Z');
            expect(service.columnLetter(26)).toBe('AA');
        });
    });

    describe('copyFormula and pasteFormula', () => {
        it('should track clipboard', () => {
            service.copyFormula('=A1', 0, 0);
            expect(service.clipboard).not.toBeNull();
            expect(service.clipboard?.raw).toBe('=A1');
            expect(service.clipboard?.col).toBe(0);
            expect(service.clipboard?.row).toBe(0);
        });

        it('should paste formula with adjustment', () => {
            service.copyFormula('=A1', 0, 0);
            const pasted = service.pasteFormula(1, 1);
            expect(pasted).toBe('=B2');
        });

        it('should paste plain text unchanged', () => {
            service.copyFormula('Hello', 0, 0);
            const pasted = service.pasteFormula(1, 1);
            expect(pasted).toBe('Hello');
        });
    });
});
