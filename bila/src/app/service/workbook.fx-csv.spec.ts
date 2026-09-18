import {describe, it, expect, beforeEach} from 'vitest';
import {WorkbookService} from './workbook.service';
import {FormulaService} from './formula.service';
import {TableHistoryService} from './table-history.service';
import {CurrencyFxService} from './currency-fx.service';
import {daysInYear} from '../model/CurrencyFx';

const BASE_CSV = [
    '#persons:P',
    '#accounts:B',
    'Month::none;Line::index;Person::select_person;Text::text;Lebensmittel_A::number;Lohn_E::number',
    'Jan;0;P;Saldo;;',
    'Jan;1;P;Migros;10,00;'
].join('\n');

describe('WorkbookService CSV FX round-trip', () => {
    let workbook: WorkbookService;

    beforeEach(() => {
        workbook = new WorkbookService(new FormulaService(), new TableHistoryService(), new CurrencyFxService());
        workbook.applyCsv(BASE_CSV);
    });

    it('round-trips currencies, sparse rates, display and year via #fx:', () => {
        workbook.fx.setCalendarYear(2025);
        workbook.fx.addCurrency('EUR', 'Euro');
        workbook.fx.setRate('EUR', 0, 0.95);
        workbook.fx.setRate('EUR', 10, 0.90);
        // leave gaps — fill-forward must survive reload
        workbook.fx.setDisplayCurrency('EUR');
        workbook.persistFx();

        const csv = workbook.toCsv();
        expect(csv).toContain('#fx:');
        const fxLine = csv.split('\n').find((line) => line.startsWith('#fx:'));
        expect(fxLine).toBeTruthy();
        const payload = JSON.parse(fxLine!.slice(4)) as {
            year: number;
            display: string;
            currencies: Array<{code: string; name: string; rates: Array<number | null>}>;
        };
        expect(payload.year).toBe(2025);
        expect(payload.display).toBe('EUR');
        expect(payload.currencies[0].code).toBe('EUR');
        expect(payload.currencies[0].name).toBe('Euro');
        expect(payload.currencies[0].rates).toHaveLength(365);
        expect(payload.currencies[0].rates[0]).toBeCloseTo(0.95);
        expect(payload.currencies[0].rates[1]).toBeNull();
        expect(payload.currencies[0].rates[10]).toBeCloseTo(0.90);

        const other = new WorkbookService(new FormulaService(), new TableHistoryService(), new CurrencyFxService());
        other.applyCsv(csv);
        expect(other.fx.calendarYear()).toBe(2025);
        expect(other.fx.displayCurrency()).toBe('EUR');
        expect(other.fx.currencies()[0].code).toBe('EUR');
        expect(other.fx.currencies()[0].name).toBe('Euro');
        expect(other.fx.currencies()[0].rates).toHaveLength(daysInYear(2025));
        expect(other.fx.rate(0, 'EUR')).toBeCloseTo(0.95);
        expect(other.fx.rate(5, 'EUR')).toBeCloseTo(0.95); // fill-forward
        expect(other.fx.rate(10, 'EUR')).toBeCloseTo(0.90);
        expect(other.fx.rate(40, 'EUR')).toBeCloseTo(0.90);
    });

    it('round-trips leap-year 366 rates', () => {
        workbook.fx.setCalendarYear(2024);
        workbook.fx.addCurrency('USD');
        workbook.fx.setRate('USD', 59, 0.88); // Feb 29 index in leap year
        workbook.fx.setRate('USD', 365, 0.87);
        workbook.persistFx();

        const other = new WorkbookService(new FormulaService(), new TableHistoryService(), new CurrencyFxService());
        other.applyCsv(workbook.toCsv());
        expect(other.fx.calendarYear()).toBe(2024);
        expect(other.fx.currencies()[0].rates).toHaveLength(366);
        expect(other.fx.rate(59, 'USD')).toBeCloseTo(0.88);
        expect(other.fx.rate(365, 'USD')).toBeCloseTo(0.87);
    });

    it('loads empty rates array resized to year length', () => {
        const csv = [
            '#persons:P',
            '#accounts:B',
            '#fx:{"year":2025,"currencies":[{"code":"EUR","name":"","rates":[]}],"display":"CHF"}',
            'Month::none;Line::index;Person::select_person;Text::text;Lebensmittel_A::number;Lohn_E::number',
            'Jan;0;P;Saldo;;'
        ].join('\n');
        workbook.applyCsv(csv);
        expect(workbook.fx.currencies()[0].rates).toHaveLength(365);
        expect(workbook.fx.currencies()[0].rates.every((r) => r == null)).toBe(true);
    });
});
