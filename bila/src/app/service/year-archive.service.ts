import {Injectable, signal} from '@angular/core';
import {joinYearPack, normalizeYearId, splitYearPack, YearPackPart} from './year-pack';

export interface YearMeta {
    id: string;
    name: string;
    updated: number;
}

const INDEX_KEY = 'philanz-years';
const ACTIVE_KEY = 'philanz-active-year';
const LEGACY_KEY = 'year';
const PACK_KEY = 'philanz-pack';

const QUOTA_HINT =
    'Browser-Speicher voll. Exportiere das Set oder lösche alte Jahre.';
const SAVE_FAIL_HINT = 'Speichern fehlgeschlagen.';

@Injectable({
    providedIn: 'root'
})
export class YearArchiveService {
    readonly years = signal<YearMeta[]>([]);
    readonly activeId = signal('');
    /** Non-empty when the last storage write failed (quota or other). */
    readonly storageError = signal('');

    private packIdleHandle: number | null = null;
    private packIdleViaRic = false;

    constructor() {
        this.hydrate();
    }

    hydrate(): void {
        const index = this.readIndex();
        const pack = localStorage.getItem(PACK_KEY);
        if (pack && !index.length) {
            this.importPack(pack);
            return;
        }
        const legacy = localStorage.getItem(LEGACY_KEY);
        if (legacy && !index.length) {
            const id = String(new Date().getFullYear());
            const created: YearMeta = {id, name: id, updated: Date.now()};
            if (!this.setItem(this.csvKey(id), legacy)) {
                return;
            }
            if (!this.writeIndex([created])) {
                return;
            }
            this.setItem(ACTIVE_KEY, id);
            this.years.set([created]);
            this.activeId.set(id);
            // One-time migration write; pack can wait for idle/export.
            this.schedulePackRewrite();
            return;
        }
        this.years.set(index);
        const active = localStorage.getItem(ACTIVE_KEY) || index[0]?.id || '';
        this.activeId.set(active);
    }

    csvOf(id: string): string | null {
        return localStorage.getItem(this.csvKey(id));
    }

    /**
     * Persist one year CSV + index/active. Does not rewrite or schedule pack
     * (issue #31 autosave). Pack stays on save()/export/idle per #23.
     * Skips writes when `csv` matches the stored value; quota-safe.
     */
    saveYear(name: string, csv: string): YearMeta {
        this.clearStorageError();
        const id = this.normalize(name);
        const existing = this.years().find((item) => item.id === id);
        const prevCsv = this.csvOf(id);
        if (existing && prevCsv === csv) {
            if (this.activeId() !== id) {
                this.setActive(id);
            }
            return existing;
        }

        const meta: YearMeta = {id, name: id, updated: Date.now()};
        if (!this.setItem(this.csvKey(id), csv)) {
            return existing ?? meta;
        }

        const list = this.years().filter((item) => item.id !== id);
        list.unshift(meta);
        list.sort((a, b) => b.name.localeCompare(a.name, 'de'));
        if (!this.writeIndex(list)) {
            return existing ?? meta;
        }
        this.years.set(list);
        this.setActive(id);
        return meta;
    }

    /**
     * Persist one year. Skips writes when `csv` matches the stored value.
     * Does not sync-rewrite `philanz-pack` — that happens on export, remove,
     * import, explicit `rewritePack()`, or idle after a dirty save.
     */
    save(name: string, csv: string): YearMeta {
        const id = this.normalize(name);
        const prevCsv = this.csvOf(id);
        const meta = this.saveYear(name, csv);
        // Schedule pack only after an actual dirty write (aligns with #23).
        if (prevCsv !== csv && this.csvOf(id) === csv) {
            this.schedulePackRewrite();
        }
        return meta;
    }

    open(id: string): string | null {
        this.clearStorageError();
        const csv = this.csvOf(id);
        if (csv == null) {
            return null;
        }
        this.setActive(id);
        return csv;
    }

    remove(id: string): void {
        this.clearStorageError();
        const list = this.years().filter((item) => item.id !== id);
        localStorage.removeItem(this.csvKey(id));
        this.writeIndex(list);
        this.years.set(list);
        this.rewritePack();
        if (this.activeId() === id) {
            const next = list[0]?.id || '';
            this.activeId.set(next);
            if (next) {
                this.setItem(ACTIVE_KEY, next);
            } else {
                localStorage.removeItem(ACTIVE_KEY);
            }
        }
    }

    suggestedName(): string {
        return this.activeId() || String(new Date().getFullYear());
    }

    ensure(name: string): YearMeta {
        this.clearStorageError();
        const id = this.normalize(name);
        const existing = this.years().find((item) => item.id === id);
        if (existing) {
            this.setActive(id);
            return existing;
        }
        const meta: YearMeta = {id, name: id, updated: Date.now()};
        const list = [meta, ...this.years()].sort((a, b) => b.name.localeCompare(a.name, 'de'));
        if (!this.writeIndex(list)) {
            return meta;
        }
        this.years.set(list);
        this.setActive(id);
        return meta;
    }

    normalize(name: string): string {
        return normalizeYearId(name);
    }

    exportPack(): string {
        return this.buildPack();
    }

    importPack(text: string): YearPackPart[] {
        this.clearStorageError();
        const parts = splitYearPack(text).filter((part) => part.csv.trim());
        if (!parts.length) {
            return [];
        }
        parts.forEach((part) => {
            const id = this.normalize(part.id || this.suggestedName());
            if (!this.setItem(this.csvKey(id), part.csv)) {
                return;
            }
            const list = this.years().filter((item) => item.id !== id);
            list.unshift({id, name: id, updated: Date.now()});
            list.sort((a, b) => b.name.localeCompare(a.name, 'de'));
            this.writeIndex(list);
            this.years.set(list);
        });
        const first = this.normalize(parts[0].id || this.suggestedName());
        this.setActive(first);
        this.rewritePack();
        return parts;
    }

    /** Explicit pack sync (export / “Set speichern” / structural changes). */
    rewritePack(): void {
        this.cancelPackIdle();
        const pack = this.buildPack();
        if (pack) {
            this.setItem(PACK_KEY, pack);
        } else {
            localStorage.removeItem(PACK_KEY);
        }
    }

    packOf(): string | null {
        return localStorage.getItem(PACK_KEY);
    }

    clearStorageError(): void {
        if (this.storageError()) {
            this.storageError.set('');
        }
    }

    private setActive(id: string): void {
        this.activeId.set(id);
        this.setItem(ACTIVE_KEY, id);
    }

    private buildPack(): string {
        const parts: YearPackPart[] = this.years()
            .map((item) => ({id: item.id, csv: this.csvOf(item.id) || ''}))
            .filter((part) => part.csv.trim());
        return joinYearPack(parts);
    }

    private csvKey(id: string): string {
        return `philanz-year:${id}`;
    }

    private readIndex(): YearMeta[] {
        try {
            const raw = localStorage.getItem(INDEX_KEY);
            const parsed = raw ? JSON.parse(raw) as YearMeta[] : [];
            return Array.isArray(parsed) ? parsed.filter((item) => item?.id) : [];
        } catch {
            return [];
        }
    }

    private writeIndex(list: YearMeta[]): boolean {
        return this.setItem(INDEX_KEY, JSON.stringify(list));
    }

    /**
     * Safe localStorage write. Never throws into UI callers.
     * Sets `storageError` on quota / other failures.
     */
    private setItem(key: string, value: string): boolean {
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (err) {
            this.storageError.set(isQuotaExceeded(err) ? QUOTA_HINT : SAVE_FAIL_HINT);
            return false;
        }
    }

    /** Defer pack rewrite so tab switches without edits never touch philanz-pack. */
    private schedulePackRewrite(): void {
        if (this.packIdleHandle != null) {
            return;
        }
        const win = typeof window !== 'undefined' ? window : null;
        const ric = win && 'requestIdleCallback' in win
            ? (win as Window & {requestIdleCallback: (cb: () => void, opts?: {timeout: number}) => number}).requestIdleCallback
            : null;
        if (ric) {
            this.packIdleViaRic = true;
            this.packIdleHandle = ric(() => {
                this.packIdleHandle = null;
                this.packIdleViaRic = false;
                this.rewritePack();
            }, {timeout: 4000});
            return;
        }
        this.packIdleViaRic = false;
        this.packIdleHandle = setTimeout(() => {
            this.packIdleHandle = null;
            this.rewritePack();
        }, 1500) as unknown as number;
    }

    private cancelPackIdle(): void {
        if (this.packIdleHandle == null) {
            return;
        }
        const win = typeof window !== 'undefined' ? window : null;
        if (this.packIdleViaRic && win && 'cancelIdleCallback' in win) {
            (win as Window & {cancelIdleCallback: (id: number) => void}).cancelIdleCallback(this.packIdleHandle);
        } else {
            clearTimeout(this.packIdleHandle);
        }
        this.packIdleHandle = null;
        this.packIdleViaRic = false;
    }
}

function isQuotaExceeded(err: unknown): boolean {
    if (!err || typeof err !== 'object') {
        return false;
    }
    const e = err as {name?: string; code?: number; message?: string};
    if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
        return true;
    }
    // Legacy DOMException codes (Chrome 22, Firefox 1014).
    if (e.code === 22 || e.code === 1014) {
        return true;
    }
    return typeof e.message === 'string' && /quota/i.test(e.message);
}
