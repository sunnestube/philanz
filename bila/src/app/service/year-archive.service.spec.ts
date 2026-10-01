import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {TestBed} from '@angular/core/testing';
import {YearArchiveService} from './year-archive.service';

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

    it('save() still rewrites pack after year write', () => {
        const csv = '#persons:\nMonth::none\nJan';
        archive.save('2024', csv);
        expect(localStorage.getItem('philanz-year:2024')).toBe(csv);
        expect(localStorage.getItem('philanz-pack')).toBeTruthy();
        expect(localStorage.getItem('philanz-pack')!).toContain('2024');
    });
});
