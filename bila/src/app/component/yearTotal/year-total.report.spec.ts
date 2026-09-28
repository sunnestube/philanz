import {describe, it, expect, beforeEach} from 'vitest';
import {buildYearTotalReport} from './year-total.report';
import {WorkbookService} from '../../service/workbook.service';
import {FormulaService} from '../../service/formula.service';
import {CurrencyFxService} from '../../service/currency-fx.service';
import {TableHistoryService} from '../../service/table-history.service';

const CSV = [
    '#persons:P',
    '#accounts:B',
    'Month::none;Line::index;Person::select_person;Text::text;Miete_A::number;Lohn_E::number',
    'Jan;0;P;Zeile;95,00;190,00'
].join('\n');

const CSV_YEAR = (expense: string, income: string) => [
    '#persons:P',
    '#accounts:B',
    'Month::none;Line::index;Person::select_person;Text::text;Miete_A::number;Lohn_E::number',
    `Jan;0;P;Zeile;${expense};${income}`
].join('\n');

describe('buildYearTotalReport FX averages', () => {
    let workbook: WorkbookService;

    beforeEach(() => {
        workbook = new WorkbookService(new FormulaService(), new TableHistoryService(), new CurrencyFxService());
        workbook.applyCsv(CSV);
        workbook.fx.setCalendarYear(2025);
        workbook.fx.addCurrency('EUR', 'Euro');
        // Rate = CHF per 1 EUR. 95 CHF / 0.95 = 100 EUR.
        workbook.fx.setRate('EUR', 0, 0.95);
        workbook.touch();
    });

    it('converts Ø Monat when display currency changes (not only fraction digits)', () => {
        const chf = buildYearTotalReport(workbook);
        expect(chf.monthAvg).toBeCloseTo(285, 5); // 95 + 190

        workbook.fx.setDisplayCurrency('EUR');
        workbook.touch();
        const eur = buildYearTotalReport(workbook);
        expect(eur.monthAvg).toBeCloseTo(300, 5); // 100 + 200
        expect(Math.abs(eur.monthAvg - chf.monthAvg)).toBeGreaterThan(1);
    });

    it('exposes stable column keys and byColumn lookups (expense + income)', () => {
        const report = buildYearTotalReport(workbook);
        expect(report.columns.length).toBe(2);
        const keys = report.columns.map((col) => col.key);
        expect(new Set(keys).size).toBe(2);
        expect(keys.every((key) => typeof key === 'string' && key.includes('::'))).toBe(true);

        const miete = report.columns.find((col) => col.title === 'Miete');
        const lohn = report.columns.find((col) => col.title === 'Lohn');
        expect(miete?.kind).toBe('Ausgabe');
        expect(lohn?.kind).toBe('Einnahme');
        expect(report.months[0].byColumn[miete!.key]).toBeCloseTo(95, 5);
        expect(report.months[0].byColumn[lohn!.key]).toBeCloseTo(190, 5);
        expect(report.summaryRows[0].byColumn[miete!.key]).toBeCloseTo(95, 5);
        expect(report.summaryRows[0].byColumn[lohn!.key]).toBeCloseTo(190, 5);
        expect(report.summaryRows[0].total).toBeCloseTo(285, 5);
    });
});

describe('buildYearTotalReport multi-year pack sums', () => {
    it('sums yearExpense/yearIncome across independent year CSVs in display currency', () => {
        const workbook = new WorkbookService(new FormulaService(), new TableHistoryService(), new CurrencyFxService());
        workbook.fx.setCalendarYear(2024);
        workbook.fx.addCurrency('EUR', 'Euro');
        workbook.fx.setRate('EUR', 0, 0.95);

        workbook.applyCsv(CSV_YEAR('100,00', '50,00'));
        workbook.fx.setDisplayCurrency('EUR');
        const y2024 = buildYearTotalReport(workbook);
        // 100/0.95 + 50/0.95
        expect(y2024.yearExpense).toBeCloseTo(100 / 0.95, 5);
        expect(y2024.yearIncome).toBeCloseTo(50 / 0.95, 5);

        workbook.applyCsv(CSV_YEAR('200,00', '80,00'));
        workbook.fx.setCalendarYear(2025);
        workbook.fx.setRate('EUR', 0, 0.95);
        workbook.fx.setDisplayCurrency('EUR');
        const y2025 = buildYearTotalReport(workbook);

        const packExpense = y2024.yearExpense + y2025.yearExpense;
        const packIncome = y2024.yearIncome + y2025.yearIncome;
        expect(packExpense).toBeCloseTo((100 + 200) / 0.95, 5);
        expect(packIncome).toBeCloseTo((50 + 80) / 0.95, 5);

        // Per-column keys stay addressable after each year build (no undefined trackBy collapse).
        for (const slice of [y2024, y2025]) {
            for (const col of slice.columns) {
                expect(col.key).toBeTruthy();
                expect(slice.summaryRows[0].byColumn[col.key]).toBeGreaterThan(0);
            }
        }
    });
});
