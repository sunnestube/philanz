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

/** ~36 data rows (12 months × 3) for multi-year refresh timing. */
function fatYearCsv(expense: string, income: string): string {
    const months = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
    const rows: string[] = [
        '#persons:P',
        '#accounts:B',
        'Month::none;Line::index;Person::select_person;Text::text;Miete_A::number;Lohn_E::number'
    ];
    let line = 0;
    for (const month of months) {
        for (let r = 0; r < 3; r++) {
            rows.push(`${month};${line};P;Zeile${line};${expense};${income}`);
            line++;
        }
    }
    return rows.join('\n');
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

    it('refresh leaves live workbook CSV, view and selectedMonth unchanged', () => {
        archive.save('2024', yearCsv('100,00', '40,00'));
        archive.save('2025', yearCsv('200,00', '60,00'));
        workbook.applyCsv(yearCsv('200,00', '60,00'));
        workbook.setView('total');
        const monthTitle = workbook.selectedMonth()?.label.title;
        const beforeCsv = workbook.toCsv();
        const beforeView = workbook.view();
        const applySpy = vi.spyOn(workbook, 'applyCsv');

        pack.refresh();

        expect(workbook.toCsv()).toBe(beforeCsv);
        expect(workbook.view()).toBe(beforeView);
        expect(workbook.selectedMonth()?.label.title).toBe(monthTitle);
        expect(applySpy).not.toHaveBeenCalled();
        expect(pack.report()).toBeTruthy();
    });

    it('cache stamp misses when two years share CSV length but differ in content', () => {
        const a = yearCsv('100,00', '40,00');
        const b = yearCsv('100,00', '41,00');
        expect(a.length).toBe(b.length);

        archive.save('2024', a);
        archive.save('2025', yearCsv('200,00', '60,00'));
        workbook.applyCsv(yearCsv('200,00', '60,00'));
        workbook.fx.setDisplayCurrency('CHF');
        pack.refresh();
        const firstIncome = pack.report()!.yearIncome;
        const firstTotal = pack.report()!.summaryRows[0].total;

        archive.save('2024', b);
        pack.refresh();
        const secondIncome = pack.report()!.yearIncome;
        const secondTotal = pack.report()!.summaryRows[0].total;

        expect(secondIncome).not.toBeCloseTo(firstIncome, 5);
        expect(secondIncome).toBeCloseTo(firstIncome + 1, 5);
        expect(secondTotal).toBeCloseTo(firstTotal + 1, 5);
    });

    it('refresh of 5 fat years finishes under 500ms', () => {
        for (let year = 2020; year < 2025; year++) {
            archive.save(String(year), fatYearCsv('10,00', '5,00'));
        }
        workbook.applyCsv(fatYearCsv('10,00', '5,00'));
        workbook.fx.setDisplayCurrency('CHF');

        const t0 = performance.now();
        pack.refresh();
        const elapsed = performance.now() - t0;

        expect(pack.report()).toBeTruthy();
        expect(pack.report()!.months.length).toBeGreaterThanOrEqual(60);
        expect(elapsed).toBeLessThan(500);
    });

    it('one broken of three years yields two-year report and visible skip', () => {
        archive.save('2022', yearCsv('100,00', '10,00'));
        // Intentionally invalid: meta only, no month rows → loadYear throws "kein Monat".
        archive.save('2023', '#persons:P\n#accounts:B\n');
        archive.save('2024', yearCsv('200,00', '20,00'));
        workbook.applyCsv(yearCsv('200,00', '20,00'));
        workbook.fx.setDisplayCurrency('CHF');

        pack.refresh();

        const report = pack.report();
        expect(report).toBeTruthy();
        expect(report!.yearExpense).toBeCloseTo(300, 5);
        expect(report!.yearIncome).toBeCloseTo(30, 5);
        const years = new Set((report!.months as PackMonthBlock[]).map((block) => block.year));
        expect(years.has('2022')).toBe(true);
        expect(years.has('2024')).toBe(true);
        expect(years.has('2023')).toBe(false);
        expect(pack.skipped()).toEqual([{id: '2023', reason: 'kein Monat'}]);
        expect(pack.error()).toBe('');
    });

    it('records skip when applyCsv throws for one archive CSV', () => {
        archive.save('2022', yearCsv('10,00', '1,00'));
        archive.save('2023', 'BROKEN_MARKER');
        archive.save('2024', yearCsv('20,00', '2,00'));
        const orig = WorkbookService.prototype.applyCsv;
        vi.spyOn(WorkbookService.prototype, 'applyCsv').mockImplementation(function (
            this: WorkbookService,
            csv: string
        ) {
            if (csv.includes('BROKEN_MARKER')) {
                throw new Error('CSV ungültig');
            }
            return orig.call(this, csv);
        });
        workbook.applyCsv(yearCsv('20,00', '2,00'));
        workbook.fx.setDisplayCurrency('CHF');

        pack.refresh();

        expect(pack.report()!.yearExpense).toBeCloseTo(30, 5);
        expect(pack.skipped()).toEqual([{id: '2023', reason: 'CSV ungültig'}]);
        expect(pack.error()).toBe('');
    });

    it('hard failure during refresh clears report and sets error', () => {
        archive.save('2024', yearCsv('10,00', '1,00'));
        workbook.applyCsv(yearCsv('10,00', '1,00'));
        vi.spyOn(pack as unknown as {snapshot: () => unknown}, 'snapshot').mockImplementation(() => {
            throw new Error('Live-CSV wiederherstellen fehlgeschlagen.');
        });

        pack.refresh();

        expect(pack.error()).toBe('Live-CSV wiederherstellen fehlgeschlagen.');
        expect(pack.report()).toBeNull();
        expect(pack.charts()).toBeNull();
        expect(pack.skipped()).toEqual([]);
    });
});
