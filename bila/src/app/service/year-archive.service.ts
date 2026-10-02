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
const PACK_PREV_KEY = 'philanz-pack-prev';
const YEAR_KEY_PREFIX = 'philanz-year:';

const QUOTA_HINT =
    'Browser-Speicher voll. Exportiere das Set oder lösche alte Jahre.';
const SAVE_FAIL_HINT = 'Speichern fehlgeschlagen.';

@Injectable({
    providedIn: 'root'
})
export class YearArchiveService {
    readonly years = signal<YearMeta[]>([]);
    readonly activeId = signal('');
    readonly storageError = signal('');

    private packIdleHandle: number | null = null;
    private packIdleViaRic = false;

    constructor() {
        this.hydrate();
    }

    hydrate(): void {
        let index = this.readIndex();
        if (!index.length) {
            index = this.rebuildIndexFromYearKeys();
            if (index.length) {
                this.writeIndex(index);
            }
        }
        if (!index.length) {
            const pack = localStorage.getItem(PACK_KEY);
            if (pack) {
                this.importPack(pack);
                return;
            }
            const legacy = localStorage.getItem(LEGACY_KEY);
            if (legacy) {
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
                this.schedulePackRewrite();
                return;
            }
        }
        this.years.set(index);
        const active = localStorage.getItem(ACTIVE_KEY) || index[0]?.id || '';
        this.activeId.set(active);
        if (index.length && !localStorage.getItem(PACK_KEY)) {
            this.rewritePack();
        }
    }

    csvOf(id: string): string | null {
        return localStorage.getItem(this.csvKey(id));
    }

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

    save(name: string, csv: string): YearMeta {
        const id = this.normalize(name);
        const prevCsv = this.csvOf(id);
        const meta = this.saveYear(name, csv);
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
        this.snapshotCurrentPack();
        this.applyPackParts(parts);
        return parts;
    }

    hasPrevPack(): boolean {
        return !!localStorage.getItem(PACK_PREV_KEY)?.trim();
    }

    restorePrevPack(): YearPackPart[] {
        this.clearStorageError();
        const prev = localStorage.getItem(PACK_PREV_KEY);
        if (!prev?.trim()) {
            return [];
        }
        const parts = splitYearPack(prev).filter((part) => part.csv.trim());
        if (!parts.length) {
            return [];
        }
        this.snapshotCurrentPack();
        this.clearStoredYears();
        this.applyPackParts(parts);
        return parts;
    }

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

    private snapshotCurrentPack(): void {
        const current = this.packOf() || this.buildPack();
        if (current?.trim()) {
            this.setItem(PACK_PREV_KEY, current);
        }
    }

    private applyPackParts(parts: YearPackPart[]): void {
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
    }

    private clearStoredYears(): void {
        const keys: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith(YEAR_KEY_PREFIX)) {
                keys.push(key);
            }
        }
        keys.forEach((key) => localStorage.removeItem(key));
        this.writeIndex([]);
        this.years.set([]);
        localStorage.removeItem(ACTIVE_KEY);
        this.activeId.set('');
    }

    private rebuildIndexFromYearKeys(): YearMeta[] {
        const list: YearMeta[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key?.startsWith(YEAR_KEY_PREFIX)) {
                continue;
            }
            const id = key.slice(YEAR_KEY_PREFIX.length);
            if (!id) {
                continue;
            }
            const csv = localStorage.getItem(key);
            if (!csv?.trim()) {
                continue;
            }
            list.push({id, name: id, updated: Date.now()});
        }
        list.sort((a, b) => b.name.localeCompare(a.name, 'de'));
        return list;
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
        return `${YEAR_KEY_PREFIX}${id}`;
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

    private setItem(key: string, value: string): boolean {
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (err) {
            this.storageError.set(isQuotaExceeded(err) ? QUOTA_HINT : SAVE_FAIL_HINT);
            return false;
        }
    }

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
    if (e.code === 22 || e.code === 1014) {
        return true;
    }
    return typeof e.message === 'string' && /quota/i.test(e.message);
}
