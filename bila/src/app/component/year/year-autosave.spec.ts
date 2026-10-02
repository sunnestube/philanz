import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';
import {YEAR_AUTOSAVE_MS, YearAutosave} from './year-autosave';

describe('YearAutosave (issue #31)', () => {
    let dirty = false;
    let writes = 0;
    let autosave: YearAutosave;
    let detach: (() => void) | null = null;

    beforeEach(() => {
        vi.useFakeTimers();
        dirty = false;
        writes = 0;
        autosave = new YearAutosave({
            isDirty: () => dirty,
            persistDirty: () => {
                writes += 1;
                dirty = false;
            }
        });
    });

    afterEach(() => {
        detach?.();
        detach = null;
        autosave.cancel();
        vi.useRealTimers();
    });

    it('does not write when not dirty', () => {
        dirty = false;
        autosave.schedule();
        vi.advanceTimersByTime(YEAR_AUTOSAVE_MS + 200);
        expect(writes).toBe(0);
    });

    it('writes once after ~1s idle following an edit', () => {
        dirty = true;
        autosave.schedule();
        vi.advanceTimersByTime(YEAR_AUTOSAVE_MS - 1);
        expect(writes).toBe(0);
        vi.advanceTimersByTime(2);
        expect(writes).toBe(1);
        expect(dirty).toBe(false);
    });

    it('coalesces two edits 200ms apart into one write', () => {
        dirty = true;
        autosave.schedule();
        vi.advanceTimersByTime(200);
        dirty = true;
        autosave.schedule();
        vi.advanceTimersByTime(YEAR_AUTOSAVE_MS - 1);
        expect(writes).toBe(0);
        vi.advanceTimersByTime(2);
        expect(writes).toBe(1);
    });

    it('flushes on pagehide while a debounce is pending', () => {
        dirty = true;
        detach = autosave.attachDocument();
        autosave.schedule();
        vi.advanceTimersByTime(200);
        expect(writes).toBe(0);
        window.dispatchEvent(new Event('pagehide'));
        expect(writes).toBe(1);
    });

    it('flushes on visibilitychange hidden', () => {
        dirty = true;
        detach = autosave.attachDocument();
        autosave.schedule();
        Object.defineProperty(document, 'visibilityState', {
            configurable: true,
            get: () => 'hidden'
        });
        document.dispatchEvent(new Event('visibilitychange'));
        expect(writes).toBe(1);
        Object.defineProperty(document, 'visibilityState', {
            configurable: true,
            get: () => 'visible'
        });
    });

    it('flush is a no-op when clean', () => {
        dirty = false;
        autosave.flush();
        expect(writes).toBe(0);
    });
});
