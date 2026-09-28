import {describe, it, expect, beforeEach} from 'vitest';
import {WorkbookService} from './workbook.service';
import {FormulaService} from './formula.service';
import {TableHistoryService} from './table-history.service';
import {CurrencyFxService} from './currency-fx.service';

const BASE_CSV = [
    '#persons:P',
    '#accounts:B',
    'Month::none;Line::index;Person::select_person;Text::text;Lebensmittel_A::number;Lohn_E::number',
    'Jan;0;P;Saldo;;',
    'Jan;1;P;Migros;10,00;',
    'Feb;0;P;Saldo;;',
    'Feb;1;P;Coop;5,00;'
].join('\n');

describe('WorkbookService closed months/year', () => {
    let workbook: WorkbookService;

    beforeEach(() => {
        workbook = new WorkbookService(new FormulaService(), new TableHistoryService(), new CurrencyFxService());
        workbook.applyCsv(BASE_CSV);
    });

    it('persists and loads #closed month flags', () => {
        workbook.setMonthClosed('Jan', true);
        expect(workbook.isMonthClosed('Jan')).toBe(true);
        expect(workbook.isMonthClosed('Feb')).toBe(false);

        const csv = workbook.toCsv();
        expect(csv).toContain('#closed:');
        const line = csv.split('\n').find((l) => l.startsWith('#closed:'));
        expect(line).toBeTruthy();
        const payload = JSON.parse(line!.slice(8)) as {months: string[]; year: boolean};
        expect(payload.months).toEqual(['Jan']);
        expect(payload.year).toBe(false);

        const other = new WorkbookService(new FormulaService(), new TableHistoryService(), new CurrencyFxService());
        other.applyCsv(csv);
        expect(other.isMonthClosed('Jan')).toBe(true);
        expect(other.isMonthClosed('Feb')).toBe(false);
        expect(other.isYearClosed()).toBe(false);
    });

    it('year closed makes every month closed and is reversible', () => {
        workbook.setYearClosed(true);
        expect(workbook.isYearClosed()).toBe(true);
        expect(workbook.isMonthClosed('Jan')).toBe(true);
        expect(workbook.isMonthClosed('Feb')).toBe(true);

        const csv = workbook.toCsv();
        const payload = JSON.parse(csv.split('\n').find((l) => l.startsWith('#closed:'))!.slice(8));
        expect(payload.year).toBe(true);

        workbook.setYearClosed(false);
        expect(workbook.isYearClosed()).toBe(false);
        expect(workbook.isMonthClosed('Jan')).toBe(false);

        const other = new WorkbookService(new FormulaService(), new TableHistoryService(), new CurrencyFxService());
        other.applyCsv(csv);
        expect(other.isYearClosed()).toBe(true);
        expect(other.isMonthClosed('Feb')).toBe(true);
        other.toggleYearClosed();
        expect(other.isYearClosed()).toBe(false);
    });

    it('toggleMonthClosed reopens a month when year is closed', () => {
        workbook.setMonthClosed('Feb', true);
        workbook.setYearClosed(true);
        expect(workbook.isMonthClosed('Jan')).toBe(true);
        workbook.toggleMonthClosed('Jan');
        expect(workbook.isYearClosed()).toBe(false);
        expect(workbook.isMonthClosed('Jan')).toBe(false);
        expect(workbook.isMonthClosed('Feb')).toBe(true);
    });

    it('applyCsv without #closed resets to open', () => {
        workbook.setMonthClosed('Jan', true);
        workbook.setYearClosed(true);
        workbook.applyCsv(BASE_CSV);
        expect(workbook.isYearClosed()).toBe(false);
        expect(workbook.closedMonths()).toEqual([]);
        expect(workbook.isMonthClosed('Jan')).toBe(false);
    });

    it('loads #closed from raw CSV marker', () => {
        const csv = [
            '#persons:P',
            '#accounts:B',
            '#closed:{"months":["Mär"],"year":false}',
            'Month::none;Line::index;Person::select_person;Text::text;Lebensmittel_A::number;Lohn_E::number',
            'Mär;0;P;Saldo;;'
        ].join('\n');
        workbook.applyCsv(csv);
        expect(workbook.closedMonths()).toEqual(['Mär']);
        expect(workbook.isMonthClosed('Mär')).toBe(true);
    });
});
