/** Debounced dirty-year persist (issue #31). Pack rewrite stays outside this path. */

export const YEAR_AUTOSAVE_MS = 1000;

export type YearAutosaveHost = {
    isDirty: () => boolean;
    persistDirty: () => void;
};

/**
 * Schedules a single write after idle; flushes on pagehide / visibility hidden.
 * Host owns dirty tracking and the actual archive write.
 */
export class YearAutosave {
    private timer = 0;

    constructor(
        private readonly host: YearAutosaveHost,
        private readonly delayMs = YEAR_AUTOSAVE_MS
    ) {}

    schedule(): void {
        if (!this.host.isDirty()) {
            return;
        }
        if (this.timer) {
            clearTimeout(this.timer);
        }
        this.timer = window.setTimeout(() => {
            this.timer = 0;
            this.flush();
        }, this.delayMs);
    }

    /** Cancel pending timer and persist immediately if dirty. */
    flush(): void {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = 0;
        }
        if (!this.host.isDirty()) {
            return;
        }
        this.host.persistDirty();
    }

    /** pagehide + visibilitychange(hidden) → flush; returns detach. */
    attachDocument(): () => void {
        const onPageHide = (): void => {
            this.flush();
        };
        const onVisibility = (): void => {
            if (document.visibilityState === 'hidden') {
                this.flush();
            }
        };
        window.addEventListener('pagehide', onPageHide);
        document.addEventListener('visibilitychange', onVisibility);
        return () => {
            window.removeEventListener('pagehide', onPageHide);
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }

    /** Clear timer without writing (e.g. after markClean on load). */
    cancel(): void {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = 0;
        }
    }
}
