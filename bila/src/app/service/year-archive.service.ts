import {Injectable, signal} from '@angular/core';

export interface YearMeta {
    id: string;
    name: string;
    updated: number;
}

const INDEX_KEY = 'philanz-years';
const ACTIVE_KEY = 'philanz-active-year';
const LEGACY_KEY = 'year';

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
        const index = this.readIndex();
        const legacy = localStorage.getItem(LEGACY_KEY);
        if (legacy && !index.length) {
            const id = String(new Date().getFullYear());
            const created: YearMeta = {id, name: id, updated: Date.now()};
            localStorage.setItem(this.csvKey(id), legacy);
            this.writeIndex([created]);
            localStorage.setItem(ACTIVE_KEY, id);
            this.years.set([created]);
            this.activeId.set(id);
            return;
        }
        this.years.set(index);
        const active = localStorage.getItem(ACTIVE_KEY) || index[0]?.id || '';
        this.activeId.set(active);
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

    normalize(name: string): string {
        const clean = (name || '').trim().replace(/[^\dA-Za-z._-]+/g, '-').replace(/^-+|-+$/g, '');
        return clean || String(new Date().getFullYear());
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

    private writeIndex(list: YearMeta[]): void {
        localStorage.setItem(INDEX_KEY, JSON.stringify(list));
    }
}
