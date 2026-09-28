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
});
