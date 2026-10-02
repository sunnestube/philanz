import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';
import {TestBed} from '@angular/core/testing';
import {BehaviorSubject} from 'rxjs';
import {ActivatedRoute, convertToParamMap, ParamMap, provideRouter} from '@angular/router';
import {YearComponent} from './year.component';
import {WorkbookService} from '../../service/workbook.service';
import {YearArchiveService} from '../../service/year-archive.service';
import {FormulaService} from '../../service/formula.service';
import {TableHistoryService} from '../../service/table-history.service';
import {CurrencyFxService} from '../../service/currency-fx.service';

const GOOD_CSV = [
    '#persons:P',
    '#accounts:B',
    'Month::none;Line::index;Person::select_person;Text::text;Miete_A::number;Lohn_E::number',
    'Jan;0;P;Zeile;100,00;40,00'
].join('\n');

function yearCsv(expense: string): string {
    return [
        '#persons:P',
        '#accounts:B',
        'Month::none;Line::index;Person::select_person;Text::text;Miete_A::number;Lohn_E::number',
        `Jan;0;P;Zeile;${expense};40,00`
    ].join('\n');
}

describe('YearComponent applyCsv teardown (#27)', () => {
    let paramMap$: BehaviorSubject<ParamMap>;
    let workbook: WorkbookService;
    let archive: YearArchiveService;

    beforeEach(async () => {
        localStorage.clear();
        paramMap$ = new BehaviorSubject<ParamMap>(convertToParamMap({id: '2024'}));
        await TestBed.configureTestingModule({
            imports: [YearComponent],
            providers: [
                provideRouter([]),
                {provide: ActivatedRoute, useValue: {paramMap: paramMap$.asObservable()}},
                FormulaService,
                TableHistoryService,
                CurrencyFxService,
                WorkbookService,
                YearArchiveService
            ]
        }).overrideComponent(YearComponent, {
            set: {
                imports: [],
                template: `<div class="probe">{{ loadError() }}</div>`,
                styles: []
            }
        }).compileComponents();
        workbook = TestBed.inject(WorkbookService);
        archive = TestBed.inject(YearArchiveService);
    });

    afterEach(() => {
        localStorage.clear();
    });

    it('broken CSV does not replace the live year workbook and shows a visible message', () => {
        archive.save('2025', 'totally-broken');
        archive.save('2024', GOOD_CSV);
        workbook.applyCsv(GOOD_CSV);

        const fixture = TestBed.createComponent(YearComponent);
        fixture.detectChanges();

        const realApply = workbook.applyCsv.bind(workbook);
        vi.spyOn(workbook, 'applyCsv').mockImplementation((csv: string) => {
            if (csv === 'totally-broken') {
                throw new Error('simulated applyCsv failure');
            }
            return realApply(csv);
        });

        expect(() => paramMap$.next(convertToParamMap({id: '2025'}))).not.toThrow();

        const comp = fixture.componentInstance;
        expect(comp.loadError()).toBe('Jahr 2025 nicht lesbar');
        expect(workbook.months().length).toBeGreaterThan(0);
        expect(workbook.toCsv()).toContain('100,00');
        expect((comp as unknown as {yearName: string}).yearName).toBe('2024');
    });

    it('destroy stops further paramMap reactions', () => {
        archive.save('2025', yearCsv('200,00'));
        archive.save('2024', GOOD_CSV);
        workbook.applyCsv(GOOD_CSV);

        const fixture = TestBed.createComponent(YearComponent);
        fixture.detectChanges();
        fixture.destroy();

        const applySpy = vi.spyOn(workbook, 'applyCsv');
        paramMap$.next(convertToParamMap({id: '2025'}));
        expect(applySpy).not.toHaveBeenCalled();
    });

    it('reentrancy: nested year switch queues instead of overlapping applyCsv', () => {
        archive.save('2026', yearCsv('300,00'));
        archive.save('2025', yearCsv('200,00'));
        archive.save('2024', GOOD_CSV);
        workbook.applyCsv(GOOD_CSV);

        const fixture = TestBed.createComponent(YearComponent);
        fixture.detectChanges();

        const realApply = workbook.applyCsv.bind(workbook);
        let depth = 0;
        let maxDepth = 0;
        vi.spyOn(workbook, 'applyCsv').mockImplementation((csv: string) => {
            depth++;
            maxDepth = Math.max(maxDepth, depth);
            if (depth === 1 && csv.includes('200,00')) {
                paramMap$.next(convertToParamMap({id: '2026'}));
            }
            try {
                return realApply(csv);
            } finally {
                depth--;
            }
        });

        paramMap$.next(convertToParamMap({id: '2025'}));
        expect(maxDepth).toBe(1);
        expect(workbook.toCsv()).toContain('300,00');
    });
});
