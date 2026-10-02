import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {TestBed} from '@angular/core/testing';
import {WorkbookService} from './workbook.service';
import {YearArchiveService} from './year-archive.service';
import {FormulaService} from './formula.service';
import {CurrencyFxService} from './currency-fx.service';
import {TableHistoryService} from './table-history.service';
import {MonthRow} from '../model/MonthRow';
import {CELL_TYPE} from '../model/CellType';
import {applyColumnFills} from './column-fill';

/**
 * Timeout smoke for issue #26: year switch via archive.open + applyCsv + fillRows.
 * Hard wall (< 800 ms), not an FPS benchmark.
 *
 * Artificial 2 s delay inside applyCsv / fillRows would fail this bound (red).
 * Run: cd bila && npm test
 */

const ROW_COUNT = 80;
const YEAR_SWITCH_MS = 800;

function yearCsvWithRows(year: number, rows: number): string {
    const header = [
        `#persons:P`,
        `#accounts:B`,
        `#fx:{"calendarYear":${year},"display":"CHF","rates":{}}`,
        'Month::none;Line::index;Person::select_person;Text::text;Miete_A::number;Lohn_E::number'
    ];
    const body: string[] = [];
    for (let i = 0; i < rows; i++) {
        body.push(`Jan;${i};P;Zeile${i};${10 + (i % 7)},00;${i % 3 === 0 ? '40,00' : ''}`);
    }
    return [...header, ...body].join('\n');
}

/** Mirrors YearComponent.fillRows (pad + column fills + touch). */
function fillRows(workbook: WorkbookService, min = 36): void {
    workbook.months().forEach((month) => {
        while (month.rows.length < min) {
            const rowIndex = month.rows.length;
            const row = new MonthRow(rowIndex, month.columns);
            row.cells.forEach((cell) => {
                if (cell.type.id === CELL_TYPE.none) {
                    cell.raw = month.label.title;
                }
                if (cell.type.id === CELL_TYPE.index) {
                    cell.raw = String(rowIndex);
                }
            });
            month.rows.push(row);
        }
    });
    applyColumnFills(workbook);
    workbook.touch();
}

describe('year-switch timeout smoke (#26)', () => {
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
                YearArchiveService
            ]
        });
        workbook = TestBed.inject(WorkbookService);
        archive = TestBed.inject(YearArchiveService);
    });

    afterEach(() => {
        localStorage.clear();
    });

    it(`open/applyCsv/fillRows for 2×${ROW_COUNT}-row years finishes under ${YEAR_SWITCH_MS}ms`, () => {
        const csv2024 = yearCsvWithRows(2024, ROW_COUNT);
        const csv2025 = yearCsvWithRows(2025, ROW_COUNT);
        archive.save('2024', csv2024);
        archive.save('2025', csv2025);

        // Warm path: load 2024 first (same as UI year switch from A → B).
        const warm = archive.open('2024');
        expect(warm).toBeTruthy();
        workbook.applyCsv(warm!);
        fillRows(workbook);
        expect(workbook.months()[0]?.rows.length).toBeGreaterThanOrEqual(ROW_COUNT);

        const t0 = performance.now();
        const next = archive.open('2025');
        expect(next).toBeTruthy();
        workbook.applyCsv(next!);
        fillRows(workbook);
        const elapsed = performance.now() - t0;

        expect(elapsed).toBeLessThan(YEAR_SWITCH_MS);
        expect(workbook.months()[0]?.rows.length).toBeGreaterThanOrEqual(ROW_COUNT);
        expect(workbook.toCsv()).toContain('Zeile79');
        expect(archive.activeId()).toBe('2025');
    });
});
