import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';
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

        expect(report!.compares.length).toBeGreaterThan(0);
        const months = report!.months as PackMonthBlock[];
        const jan = months.find((block) => block.year === '2025' && block.monthKey === 'Jan');
        expect(jan?.compare).toBeTruthy();
        expect(jan!.compare!.total).toBeCloseTo(120, 5);
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
        expect(pack.report()!.yearExpense).toBeCloseTo(200, 5);
    });

    it('opening Total/Graf refresh stays finite and does not save the archive', () => {
        // Hang scenario 22.09: collect() called archive.save(), years() retriggered the effect.
        archive.save('2024', yearCsv('10,00', '1,00'));
        archive.save('2025', yearCsv('20,00', '2,00'));
        const save = vi.spyOn(archive, 'save');
        for (let i = 0; i < 8; i++) {
            pack.refresh();
        }
        expect(save).not.toHaveBeenCalled();
        expect(pack.report()).toBeTruthy();
        expect(pack.charts()).toBeTruthy();
    });
});
