import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {TestBed} from '@angular/core/testing';
import {PackMonthBlock, PackReportService} from './pack-report.service';
import {WorkbookService} from './workbook.service';
import {YearArchiveService} from './year-archive.service';
import {FormulaService} from './formula.service';
import {CurrencyFxService} from './currency-fx.service';
import {TableHistoryService} from './table-history.service';

function yearCsv(expense: string, income: string): string {
    return [
        '#persons:P',
        '#accounts:B',
        'Month::none;Line::index;Person::select_person;Text::text;Miete_A::number;Lohn_E::number',
        `Jan;0;P;Zeile;${expense};${income}`
    ].join('\n');
}

describe('PackReportService multi-year totals', () => {
    let pack: PackReportService;
    let workbook: WorkbookService;
    let archive: YearArchiveService;

    beforeEach(() => {
        localStorage.clear();
        TestBed.configureTestingModule({
            providers: [
                FormulaService,
                TableHistoryService,
                CurrencyFxService,
                WorkbookService,
                YearArchiveService,
                PackReportService
            ]
        });
        workbook = TestBed.inject(WorkbookService);
        archive = TestBed.inject(YearArchiveService);
        pack = TestBed.inject(PackReportService);
        workbook.fx.setCalendarYear(2025);
        workbook.fx.addCurrency('EUR', 'Euro');
        workbook.fx.setRate('EUR', 0, 0.95);
    });

    afterEach(() => {
        localStorage.clear();
    });

    it('merges two years with stable column keys and summed Set totals', () => {
        archive.save('2024', yearCsv('100,00', '40,00'));
        archive.save('2025', yearCsv('200,00', '60,00'));
        workbook.applyCsv(yearCsv('200,00', '60,00'));
        workbook.fx.setDisplayCurrency('CHF');
        pack.refresh();
        const report = pack.report();
        expect(report).toBeTruthy();
        expect(report!.months.length).toBeGreaterThanOrEqual(2);
        expect(report!.yearExpense).toBeCloseTo(300, 5);
        expect(report!.yearIncome).toBeCloseTo(100, 5);
        expect(report!.summaryRows[0].total).toBeCloseTo(400, 5);
        expect(report!.monthAvg).toBeCloseTo(400 / report!.months.length, 5);

        const keys = report!.columns.map((col) => col.key);
        expect(new Set(keys).size).toBe(keys.length);
        for (const col of report!.columns) {
            expect(report!.summaryRows[0].byColumn[col.key]).toBeGreaterThan(0);
        }

        // YoY compare present for overlapping calendar months
        expect(report!.compares.length).toBeGreaterThan(0);
        const months = report!.months as PackMonthBlock[];
        const jan = months.find((block) => block.year === '2025' && block.monthKey === 'Jan');
        expect(jan?.compare).toBeTruthy();
        expect(jan!.compare!.total).toBeCloseTo(120, 5); // (200+60) - (100+40)
    });

    it('converts pack Set totals when display currency switches', () => {
        archive.save('2024', yearCsv('95,00', '0'));
        archive.save('2025', yearCsv('95,00', '0'));
        workbook.applyCsv(yearCsv('95,00', '0'));
        workbook.fx.setDisplayCurrency('CHF');
        pack.refresh();
        expect(pack.report()!.yearExpense).toBeCloseTo(190, 5);

        workbook.fx.setDisplayCurrency('EUR');
        pack.refresh();
        expect(pack.report()!.yearExpense).toBeCloseTo(200, 5); // 95/0.95 * 2
    });
});
