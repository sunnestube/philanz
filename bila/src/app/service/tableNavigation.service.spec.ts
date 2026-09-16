import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';
import {TableNavigationService} from './tableNavigation.service';

describe('TableNavigationService', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        TableNavigationService.beforeFocus = null;
    });

    afterEach(() => {
        TableNavigationService.beforeFocus = null;
    });

    it('builds stable cell ids', () => {
        expect(TableNavigationService.cellId('Jan', 2, 3)).toBe('cell_Jan_2_3');
    });

    it('invokes beforeFocus then focuses the target cell', async () => {
        const el = document.createElement('input');
        el.id = TableNavigationService.cellId('Jan', 1, 2);
        document.body.appendChild(el);
        const seen: Array<[string, number, number]> = [];
        TableNavigationService.beforeFocus = (title, row, col) => seen.push([title, row, col]);
        const focus = vi.spyOn(el, 'focus');

        TableNavigationService.navigate('ArrowDown', 0, 2, 5, 'Jan');
        expect(seen).toEqual([['Jan', 1, 2]]);
        expect(focus).not.toHaveBeenCalled();
        await Promise.resolve();
        expect(focus).toHaveBeenCalled();
    });

    it('Home / End jump to configured columns', () => {
        const seen: number[] = [];
        TableNavigationService.beforeFocus = (_t, _r, col) => seen.push(col);

        TableNavigationService.navigate('Home', 4, 5, 10, 'Jan', 1, 8);
        TableNavigationService.navigate('End', 4, 5, 10, 'Jan', 1, 8);
        expect(seen).toEqual([1, 8]);
    });
});
