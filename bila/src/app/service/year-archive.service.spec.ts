import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {TestBed} from '@angular/core/testing';
import {YearArchiveService} from './year-archive.service';
import {joinYearPack} from './year-pack';

function yearCsv(tag: string): string {
    return [
        '#persons:P',
        '#accounts:B',
        'Month::none;Line::index;Person::select_person;Text::text;Miete_A::number',
        `Jan;0;P;${tag};10,00`
    ].join('\n');
}

function packOf(...years: Array<{id: string; tag: string}>): string {
    return joinYearPack(years.map(({id, tag}) => ({id, csv: yearCsv(tag)})));
}

describe('YearArchiveService pack prev + orphan index', () => {
    let archive: YearArchiveService;

    beforeEach(() => {
        localStorage.clear();
        TestBed.configureTestingModule({
            providers: [YearArchiveService]
        });
        archive = TestBed.inject(YearArchiveService);
    });

    afterEach(() => {
        localStorage.clear();
        TestBed.resetTestingModule();
    });

    it('importPack snapshots current pack to philanz-pack-prev; restore brings A back', () => {
        const packA = packOf({id: '2024', tag: 'A-year'}, {id: '2025', tag: 'A-set'});
        const packB = packOf({id: '2024', tag: 'B-year'}, {id: '2026', tag: 'B-only'});

        archive.importPack(packA);
        expect(archive.years().map((y) => y.id).sort()).toEqual(['2024', '2025']);
        expect(archive.csvOf('2024')).toContain('A-year');
        expect(archive.hasPrevPack()).toBe(false);

        archive.importPack(packB);
        expect(archive.hasPrevPack()).toBe(true);
        expect(localStorage.getItem('philanz-pack-prev')).toContain('A-year');
        expect(archive.csvOf('2024')).toContain('B-year');
        expect(archive.csvOf('2026')).toContain('B-only');

        const restored = archive.restorePrevPack();
        expect(restored.map((p) => p.id).sort()).toEqual(['2024', '2025']);
        expect(archive.csvOf('2024')).toContain('A-year');
        expect(archive.csvOf('2025')).toContain('A-set');
        expect(archive.csvOf('2026')).toBeNull();
        expect(archive.years().map((y) => y.id).sort()).toEqual(['2024', '2025']);
        // Current B was swapped into prev so restore can flip again.
        expect(archive.hasPrevPack()).toBe(true);
        expect(localStorage.getItem('philanz-pack-prev')).toContain('B-year');
    });

    it('hydrate rebuilds index from orphaned philanz-year:* keys when index is empty', () => {
        archive.save('2023', yearCsv('orphan-2023'));
        archive.save('2024', yearCsv('orphan-2024'));
        expect(archive.years().length).toBe(2);

        localStorage.setItem('philanz-years', '[]');
        localStorage.removeItem('philanz-pack');

        TestBed.resetTestingModule();
        TestBed.configureTestingModule({
            providers: [YearArchiveService]
        });
        const rehydrated = TestBed.inject(YearArchiveService);

        expect(rehydrated.years().map((y) => y.id).sort()).toEqual(['2023', '2024']);
        expect(rehydrated.csvOf('2023')).toContain('orphan-2023');
        expect(rehydrated.csvOf('2024')).toContain('orphan-2024');
        const index = JSON.parse(localStorage.getItem('philanz-years') || '[]') as Array<{id: string}>;
        expect(index.map((item) => item.id).sort()).toEqual(['2023', '2024']);
        expect(localStorage.getItem('philanz-pack')).toBeTruthy();
    });

    it('hydrate prefers orphan year keys over re-importing pack when index JSON is broken', () => {
        archive.save('2024', yearCsv('from-keys'));
        localStorage.setItem('philanz-years', '{not-json');
        localStorage.setItem(
            'philanz-pack',
            packOf({id: '2024', tag: 'from-pack'}, {id: '2099', tag: 'pack-only'})
        );

        TestBed.resetTestingModule();
        TestBed.configureTestingModule({
            providers: [YearArchiveService]
        });
        const rehydrated = TestBed.inject(YearArchiveService);

        expect(rehydrated.years().map((y) => y.id)).toEqual(['2024']);
        expect(rehydrated.csvOf('2024')).toContain('from-keys');
        expect(rehydrated.csvOf('2099')).toBeNull();
    });
});
