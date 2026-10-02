import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';
import {TestBed} from '@angular/core/testing';
import {YearArchiveService} from './year-archive.service';
import {joinYearPack} from './year-pack';

const YEAR_A = [
    '#persons:P',
    '#accounts:B',
    'Month::none;Line::index;Person::select_person;Text::text;Miete_A::number;Lohn_E::number',
    'Jan;0;P;A;10,00;1,00'
].join('\n');

const YEAR_B = [
    '#persons:P',
    '#accounts:B',
    'Month::none;Line::index;Person::select_person;Text::text;Miete_A::number;Lohn_E::number',
    'Jan;0;P;B;20,00;2,00'
].join('\n');

describe('YearArchiveService storage quota + dirty save (#23)', () => {
    let archive: YearArchiveService;
    let setItemSpy: ReturnType<typeof vi.spyOn> | undefined;
    const nativeSetItem = Storage.prototype.setItem;

    function trackWrites(): string[] {
        const writes: string[] = [];
        setItemSpy?.mockRestore();
        setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
            this: Storage,
            key: string,
            value: string
        ) {
            writes.push(String(key));
            return nativeSetItem.call(this, key, value);
        });
        return writes;
    }

    beforeEach(() => {
        localStorage.clear();
        TestBed.configureTestingModule({
            providers: [YearArchiveService]
        });
        archive = TestBed.inject(YearArchiveService);
    });

    afterEach(() => {
        setItemSpy?.mockRestore();
        setItemSpy = undefined;
        // Cancel deferred pack rewrite so it cannot leak into the next test.
        archive.rewritePack();
        localStorage.clear();
        vi.useRealTimers();
    });

    it('does not throw when localStorage.setItem raises QuotaExceededError and sets storageError', () => {
        setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
        });

        expect(() => archive.save('2024', YEAR_A)).not.toThrow();
        expect(archive.storageError()).toMatch(/Speicher voll|quota|Exportiere/i);
        expect(archive.csvOf('2024')).toBeNull();
    });

    it('shows a non-empty UI hint after a mocked quota failure', () => {
        setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new DOMException('quota', 'QuotaExceededError');
        });

        archive.save('2025', YEAR_A);
        expect(archive.storageError().length).toBeGreaterThan(0);
    });

    it('skips pack rewrite when saving unchanged csv (year switch without edit)', () => {
        archive.save('2024', YEAR_A);
        archive.rewritePack();
        const packBefore = localStorage.getItem('philanz-pack');
        expect(packBefore).toBeTruthy();

        const writes = trackWrites();
        // Identical save — dirty check must skip all writes including pack.
        archive.save('2024', YEAR_A);

        expect(writes).not.toContain('philanz-pack');
        expect(localStorage.getItem('philanz-pack')).toBe(packBefore);
        expect(writes.filter((k) => k === 'philanz-year:2024')).toHaveLength(0);
        expect(writes.filter((k) => k === 'philanz-years')).toHaveLength(0);
    });

    it('does not sync-write philanz-pack on dirty save (idle / explicit only)', () => {
        const writes = trackWrites();
        archive.save('2024', YEAR_A);
        expect(writes).toContain('philanz-year:2024');
        expect(writes).not.toContain('philanz-pack');
    });

    it('does not write legacy year key on every save', () => {
        const writes = trackWrites();
        archive.save('2024', YEAR_A);
        expect(writes).not.toContain('year');
    });

    it('keeps import/export pack bit-compatible with joinYearPack', () => {
        archive.save('2024', YEAR_A);
        archive.save('2025', YEAR_B);
        archive.rewritePack();

        const exported = archive.exportPack();
        const expected = joinYearPack([
            {id: '2025', csv: YEAR_B},
            {id: '2024', csv: YEAR_A}
        ]);
        expect(exported).toBe(expected);

        localStorage.clear();
        TestBed.resetTestingModule();
        TestBed.configureTestingModule({providers: [YearArchiveService]});
        const fresh = TestBed.inject(YearArchiveService);
        fresh.importPack(exported);
        expect(fresh.csvOf('2024')?.replace(/\n+$/, '')).toBe(YEAR_A.replace(/\n+$/, ''));
        expect(fresh.csvOf('2025')?.replace(/\n+$/, '')).toBe(YEAR_B.replace(/\n+$/, ''));
        expect(fresh.exportPack()).toBe(exported);
    });

    it('explicit rewritePack writes philanz-pack after dirty saves', () => {
        archive.save('2024', YEAR_A);
        expect(localStorage.getItem('philanz-pack')).toBeNull();
        archive.rewritePack();
        expect(localStorage.getItem('philanz-pack')).toContain('#pack');
        expect(localStorage.getItem('philanz-pack')).toContain('#year:2024');
    });
});

describe('YearArchiveService saveYear (issue #31)', () => {
    let archive: YearArchiveService;

    beforeEach(() => {
        localStorage.clear();
        TestBed.configureTestingModule({
            providers: [YearArchiveService]
        });
        archive = TestBed.inject(YearArchiveService);
    });

    afterEach(() => {
        archive.rewritePack();
        localStorage.clear();
    });

    it('writes philanz-year key without rewriting pack', () => {
        localStorage.setItem('philanz-pack', 'PACK_BEFORE');
        const csv = '#persons:\nMonth::none\nJan';
        archive.saveYear('2025', csv);
        expect(localStorage.getItem('philanz-year:2025')).toBe(csv);
        expect(localStorage.getItem('philanz-pack')).toBe('PACK_BEFORE');
        expect(archive.activeId()).toBe('2025');
        expect(archive.years().some((y) => y.id === '2025')).toBe(true);
    });

    it('save() still writes year key without sync pack rewrite (#23)', () => {
        const csv = '#persons:\nMonth::none\nJan';
        archive.save('2024', csv);
        expect(localStorage.getItem('philanz-year:2024')).toBe(csv);
        // Deferred pack: no sync rewrite on save (aligns with #23).
        expect(localStorage.getItem('philanz-pack')).toBeNull();
    });
});
