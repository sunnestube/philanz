import {describe, it, expect, beforeEach} from 'vitest';
import {WorkbookService} from './workbook.service';
import {FormulaService} from './formula.service';
import {TableHistoryService} from './table-history.service';
import {CurrencyFxService} from './currency-fx.service';
import {MonthTableSaldo} from '../component/monthTable/month-table-saldo';
import {columnViews, formatSaldo} from '../component/monthTable/month-table.vm';

const CSV = [
    '#persons:P,L',
    '#accounts:B,K',
    'Month::none;Line::index;Person::select_person;Text::text;Lebensmittel_A::number;Lohn_E::number',
    'Jan;0;P;Saldo;;',
    'Jan;1;P;Lohn;;4.200,00',
    'Jan;2;P;Migros;92,50;',
    'Jan;3;L;Markt;1.015,75;',
    'Jan;4;P;Summe;=C3+C4;'
].join('\n');

describe('CSV import → Summenrechnung', () => {
    let workbook: WorkbookService;
    let formula: FormulaService;

    beforeEach(() => {
        formula = new FormulaService();
        workbook = new WorkbookService(formula, new TableHistoryService(), new CurrencyFxService());
    });

    it('footer and formulas sum German-formatted amounts after applyCsv', () => {
        workbook.applyCsv(CSV);
        const month = workbook.months()[0];
        const foodIdx = month.columns.findIndex((c) => c.title === 'Lebensmittel');
        const wageIdx = month.columns.findIndex((c) => c.title === 'Lohn');

        expect(formula.toNumber(month.rows[1].cells[wageIdx].display)).toBeCloseTo(4200, 2);
        expect(formula.toNumber(month.rows[2].cells[foodIdx].display)).toBeCloseTo(92.5, 2);
        expect(formula.toNumber(month.rows[3].cells[foodIdx].display)).toBeCloseTo(1015.75, 2);

        const formulaCell = month.rows[4].cells[foodIdx];
        expect(formulaCell.error).toBeNull();
        expect(formula.toNumber(formulaCell.display)).toBeCloseTo(92.5 + 1015.75, 2);

        const saldo = new MonthTableSaldo(workbook, formula, () => month);
        const grand = saldo.footerViews(columnViews(month.columns, (i) => String(i)), [])
            .find((v) => v.person === null)!;

        expect(grand.cells[foodIdx].text).toBe(formatSaldo(92.5 + 1015.75 + (92.5 + 1015.75)));
        expect(grand.cells[wageIdx].text).toBe(formatSaldo(4200));
    });

    it('round-trip toCsv/applyCsv keeps expense totals', () => {
        workbook.applyCsv(CSV);
        const before = workbook.yearExpenseReport().yearExpense;
        expect(before).toBeCloseTo(92.5 + 1015.75 + (92.5 + 1015.75), 2);
        workbook.applyCsv(workbook.toCsv());
        expect(workbook.yearExpenseReport().yearExpense).toBeCloseTo(before, 2);
    });
});
