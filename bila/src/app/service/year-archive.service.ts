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

@Injectable({
    providedIn: 'root'
})
export class YearArchiveService {
    readonly years = signal<YearMeta[]>([]);
    readonly activeId = signal('');

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
                localStorage.setItem(this.csvKey(id), legacy);
                this.writeIndex([created]);
                localStorage.setItem(ACTIVE_KEY, id);
                this.years.set([created]);
                this.activeId.set(id);
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

    save(name: string, csv: string): YearMeta {
        const id = this.normalize(name);
        const list = this.years().filter((item) => item.id !== id);
        const meta: YearMeta = {id, name: id, updated: Date.now()};
        list.unshift(meta);
        list.sort((a, b) => b.name.localeCompare(a.name, 'de'));
        localStorage.setItem(this.csvKey(id), csv);
        localStorage.setItem(LEGACY_KEY, csv);
        localStorage.setItem(ACTIVE_KEY, id);
        this.writeIndex(list);
        this.years.set(list);
        this.activeId.set(id);
        this.rewritePack();
        return meta;
    }

    open(id: string): string | null {
        const csv = this.csvOf(id);
        if (csv == null) {
            return null;
        }
        localStorage.setItem(ACTIVE_KEY, id);
        localStorage.setItem(LEGACY_KEY, csv);
        this.activeId.set(id);
        return csv;
    }

    remove(id: string): void {
        const list = this.years().filter((item) => item.id !== id);
        localStorage.removeItem(this.csvKey(id));
        this.writeIndex(list);
        this.years.set(list);
        this.rewritePack();
        if (this.activeId() === id) {
            const next = list[0]?.id || '';
            this.activeId.set(next);
            if (next) {
                localStorage.setItem(ACTIVE_KEY, next);
            } else {
                localStorage.removeItem(ACTIVE_KEY);
            }
        }
    }

    suggestedName(): string {
        return this.activeId() || String(new Date().getFullYear());
    }

    ensure(name: string): YearMeta {
        const id = this.normalize(name);
        const existing = this.years().find((item) => item.id === id);
        if (existing) {
            this.activeId.set(id);
            localStorage.setItem(ACTIVE_KEY, id);
            return existing;
        }
        const meta: YearMeta = {id, name: id, updated: Date.now()};
        const list = [meta, ...this.years()].sort((a, b) => b.name.localeCompare(a.name, 'de'));
        this.writeIndex(list);
        this.years.set(list);
        this.activeId.set(id);
        localStorage.setItem(ACTIVE_KEY, id);
        return meta;
    }

    normalize(name: string): string {
        return normalizeYearId(name);
    }

    exportPack(): string {
        return this.buildPack();
    }

    importPack(text: string): YearPackPart[] {
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

    /**
     * Restores the single previous pack snapshot (`philanz-pack-prev`).
     * Full replace: current years are cleared so exclusive years from the
     * overwritten set do not linger. Current pack is swapped into prev.
     */
    restorePrevPack(): YearPackPart[] {
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
        const pack = this.buildPack();
        if (pack) {
            localStorage.setItem(PACK_KEY, pack);
        } else {
            localStorage.removeItem(PACK_KEY);
        }
    }

    packOf(): string | null {
        return localStorage.getItem(PACK_KEY);
    }

    private snapshotCurrentPack(): void {
        const current = this.packOf() || this.buildPack();
        if (current?.trim()) {
            localStorage.setItem(PACK_PREV_KEY, current);
        }
    }

    private applyPackParts(parts: YearPackPart[]): void {
        parts.forEach((part) => {
            const id = this.normalize(part.id || this.suggestedName());
            localStorage.setItem(this.csvKey(id), part.csv);
            const list = this.years().filter((item) => item.id !== id);
            list.unshift({id, name: id, updated: Date.now()});
            list.sort((a, b) => b.name.localeCompare(a.name, 'de'));
            this.writeIndex(list);
            this.years.set(list);
        });
        const first = this.normalize(parts[0].id || this.suggestedName());
        this.activeId.set(first);
        localStorage.setItem(ACTIVE_KEY, first);
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

    private writeIndex(list: YearMeta[]): void {
        localStorage.setItem(INDEX_KEY, JSON.stringify(list));
    }
}
