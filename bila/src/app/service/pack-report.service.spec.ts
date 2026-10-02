import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';
import {TestBed} from '@angular/core/testing';
import {WorkbookService} from './workbook.service';
import {YearArchiveService} from './year-archive.service';
import {PackReportService} from './pack-report.service';
import {FormulaService} from './formula.service';
import {CurrencyFxService} from './currency-fx.service';
import {TableHistoryService} from './table-history.service';

function yearCsv(miete: string, lohn: string): string {
    return [
        '#persons:P',
        '#accounts:B',
        'Month::none;Line::index;Person::select_person;Text::text;Miete_A::number;Lohn_E::number',
        `Jan;0;P;Zeile;${miete};${lohn}`
    ].join('\n');
}

/** Fat year: 12 months × 80 rows for refresh timing smoke. */
function fatYearCsv(miete: string, lohn: string): string {
    const months = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
    const header = [
        '#persons:P',
        '#accounts:B',
        'Month::none;Line::index;Person::select_person;Text::text;Miete_A::number;Lohn_E::number'
    ];
    const body: string[] = [];
    for (const m of months) {
        for (let i = 0; i < 80; i++) {
            body.push(`${m};${i};P;Zeile;${miete};${lohn}`);
        }
    }
    return [...header, ...body].join('\n');
}

describe('PackReportService', () => {
    let workbook: WorkbookService;
    let archive: YearArchiveService;
    let pack: PackReportService;

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
    });

    afterEach(() => {
        localStorage.clear();
    });

    it('aggregates income/expense across archive years without applyCsv on live workbook', () => {
        archive.save('2024', yearCsv('100,00', '40,00'));
        archive.save('2025', yearCsv('200,00', '60,00'));
        workbook.applyCsv(yearCsv('200,00', '60,00'));
        workbook.fx.setDisplayCurrency('CHF');
        const applySpy = vi.spyOn(workbook, 'applyCsv');

        pack.refresh();

        expect(applySpy).not.toHaveBeenCalled();
        const report = pack.report();
        expect(report).toBeTruthy();
        expect(report!.yearIncome).toBeCloseTo(100, 5);
        expect(report!.yearExpense).toBeCloseTo(300, 5);
        expect(report!.summaryRows[0].total).toBeCloseTo(-200, 5);
    });

    it('does not call archive.save during refresh', () => {
        archive.save('2024', yearCsv('100,00', '40,00'));
        workbook.applyCsv(yearCsv('100,00', '40,00'));
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

    /**
     * Timeout smoke (#26): second refresh must hit the stamp cache (≤ 50 ms)
     * and must not rewrite the live workbook CSV.
     * Artificial 2 s delay inside refresh() would fail this bound (red).
     */
    it('second PackReport.refresh is ≤50ms (cache) and live CSV unchanged', () => {
        archive.save('2024', yearCsv('100,00', '40,00'));
        archive.save('2025', yearCsv('200,00', '60,00'));
        workbook.applyCsv(yearCsv('200,00', '60,00'));
        workbook.fx.setDisplayCurrency('CHF');
        const liveBefore = workbook.toCsv();

        pack.refresh();
        expect(pack.report()).toBeTruthy();
        expect(workbook.toCsv()).toBe(liveBefore);

        const t0 = performance.now();
        pack.refresh();
        const elapsed = performance.now() - t0;
        expect(elapsed).toBeLessThanOrEqual(50);
        expect(workbook.toCsv()).toBe(liveBefore);
    });
});
