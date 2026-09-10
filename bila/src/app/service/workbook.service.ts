import {Injectable, computed, signal} from '@angular/core';
import {Month} from '../model/Month';
import {MonthColumn} from '../model/MonthColumn';
import {MonthCell} from '../model/MonthCell';
import {MonthRow} from '../model/MonthRow';
import {CELL_TYPE, CellType} from '../model/CellType';
import {SECTION} from '../model/Section';
import {CsvExportService} from './csv-export.service';
import {FormulaService} from './formula.service';
import {CsvImportService} from './csv-import.service';

export interface WorkbookOptions {
    person: string[];
    account: string[];
}

export interface ComboSaldo {
    person: string;
    account: string;
    expenses: number;
    income: number;
    balance: number;
}

export interface SaldoCombo {
    person: string;
    account: string;
    key: string;
}

export type YearView = 'month' | 'start' | 'constants' | 'total' | 'graf' | 'csv';

export const CONSTANT_MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'] as const;

export interface ConstantDef {
    id: string;
    name: string;
    person: string;
    account: string;
    months: string[];
}

export interface SaldoColumnPref {
    visible: boolean;
    title: string;
}

export interface ExpenseColumn {
    title: string;
    index: number;
}

export interface MonthExpenseBlock {
    title: string;
    byPerson: Record<string, Record<string, number>>;
    personTotal: Record<string, number>;
    byColumn: Record<string, number>;
    total: number;
}

export interface YearExpenseReport {
    columns: ExpenseColumn[];
    persons: string[];
    months: MonthExpenseBlock[];
    yearExpense: number;
    yearIncome: number;
    monthAvg: number;
    dayAvg: number;
    summaryRows: Array<{label: string; byColumn: Record<string, number>; total: number}>;
}

const SETTINGS_KEY = 'philanz-settings';
const PERSON_COLORS: Record<string, string> = {
    P: '#60a5fa',
    L: '#818cf8',
    H: '#fbbf24',
    E: '#fb923c',
    A: '#f97316'
};
const CATEGORY_COLORS = ['#34d399', '#f472b6', '#38bdf8', '#facc15', '#c084fc', '#fb7185', '#4ade80', '#94a3b8'];

@Injectable({
    providedIn: 'root'
})
export class WorkbookService {
    readonly months = signal<Month[]>([]);
    readonly selectedMonth = signal<Month | null>(null);
    readonly settingsOpen = signal(false);
    readonly revision = signal(0);
    readonly view = signal<YearView>('month');
    readonly saldoColumnsOpen = signal(true);
    readonly saldoPanelOpen = signal(false);
    readonly saldoTotalPref = signal<SaldoColumnPref>({visible: true, title: 'Total'});
    readonly saldoColumnPrefs = signal<Record<string, SaldoColumnPref>>({});
    readonly openingBalances = signal<Record<string, number>>({});
    readonly persons = signal<string[]>(['', 'P', 'L', 'H', 'E', 'A']);
    readonly accounts = signal<string[]>(['', 'B', 'K', 'S', 'R', 'Y', 'T']);
    readonly personNames = signal<Record<string, string>>({});
    readonly accountNames = signal<Record<string, string>>({});
    readonly headerRowHeight = signal(84);
    readonly textColWidth = signal(160);
    readonly constants = signal<ConstantDef[]>([WorkbookService.emptyConstant('Miete')]);

    readonly personCodes = computed(() => this.persons().filter((code) => !!code));
    readonly accountCodes = computed(() => this.accounts().filter((code) => !!code));
    readonly saldoCombos = computed((): SaldoCombo[] => {
        const combos: SaldoCombo[] = [];
        this.personCodes().forEach((person) => {
            this.accountCodes().forEach((account) => {
                combos.push({
                    person,
                    account,
                    key: `${person}|${account}`
                });
            });
        });
        return combos;
    });

    constructor(private readonly formulaService: FormulaService) {
        this.restoreSettings();
    }

    setMonths(months: Month[]): void {
        this.months.set(months);
        this.selectedMonth.set(months[0] ?? null);
        this.view.set(months.length ? 'month' : 'start');
        this.formulaService.setMonths(months);
        this.touch();
    }

    selectMonth(month: Month): void {
        this.selectedMonth.set(month);
    }

    setView(view: YearView): void {
        this.view.set(view);
    }

    toggleSaldoColumns(): void {
        this.saldoColumnsOpen.update((value) => !value);
        this.persistSettings();
    }

    toggleSaldoPanel(): void {
        this.saldoPanelOpen.update((value) => !value);
        this.persistSettings();
    }

    visibleSaldoCombos(): SaldoCombo[] {
        const prefs = this.saldoColumnPrefs();
        return this.saldoCombos().filter((combo) => prefs[combo.key]?.visible !== false);
    }

    personLabel(code: string): string {
        const clean = (code || '').trim();
        if (!clean) {
            return '';
        }
        const name = (this.personNames()[clean.toUpperCase()] || '').trim();
        return name || clean.toUpperCase();
    }

    accountLabel(code: string): string {
        const clean = (code || '').trim();
        if (!clean) {
            return '';
        }
        const name = (this.accountNames()[clean.toUpperCase()] || '').trim();
        return name || clean.toUpperCase();
    }

    optionLabel(kind: 'person' | 'account', code: string): string {
        if (!code) {
            return '';
        }
        const label = kind === 'person' ? this.personLabel(code) : this.accountLabel(code);
        return label === code ? code : `${code} · ${label}`;
    }

    setCodeName(kind: 'person' | 'account', code: string, name: string): void {
        const key = code.trim().toUpperCase();
        if (!key) {
            return;
        }
        const clean = name.replace(/[=;,]/g, ' ').trim();
        const target = kind === 'person' ? this.personNames : this.accountNames;
        const next = {...target()};
        if (!clean || clean.toUpperCase() === key) {
            delete next[key];
        } else {
            next[key] = clean;
        }
        target.set(next);
        this.persistSettings();
        this.touch();
    }

    setHeaderRowHeight(px: number, persist = true): void {
        this.headerRowHeight.set(Math.max(48, Math.min(240, Math.round(px))));
        if (persist) {
            this.persistSettings();
        }
    }

    setTextColWidth(px: number, persist = true): void {
        this.textColWidth.set(Math.max(72, Math.min(480, Math.round(px))));
        if (persist) {
            this.persistSettings();
        }
    }

    addConstant(name = ''): void {
        this.constants.update((list) => [...list, WorkbookService.emptyConstant(name)]);
        this.persistSettings();
        this.touch();
    }

    removeConstant(id: string): void {
        this.constants.update((list) => list.filter((item) => item.id !== id));
        this.persistSettings();
        this.touch();
    }

    setConstantName(id: string, name: string): void {
        this.patchConstant(id, {name: name.trim()});
    }

    setConstantPerson(id: string, person: string): void {
        this.patchConstant(id, {person: (person || '').trim().toUpperCase()});
    }

    setConstantAccount(id: string, account: string): void {
        this.patchConstant(id, {account: (account || '').trim().toUpperCase()});
    }

    setConstantMonth(id: string, index: number, raw: string): void {
        const current = this.constants().find((item) => item.id === id);
        if (!current || index < 0 || index >= 12) {
            return;
        }
        const months = [...current.months];
        months[index] = raw ?? '';
        this.patchConstant(id, {months});
    }

    isFormula(raw: string | null | undefined): boolean {
        return this.formulaService.isFormula(raw);
    }

    constantAmount(item: ConstantDef, monthTitle: string): number {
        const index = CONSTANT_MONTHS.indexOf(monthTitle as typeof CONSTANT_MONTHS[number]);
        if (index < 0) {
            return 0;
        }
        return this.evaluateAmount(item.months[index] ?? '', monthTitle);
    }

    constantAverage(item: ConstantDef): number {
        const values = item.months
            .map((raw) => ({raw, value: this.evaluateAmount(raw)}))
            .filter((entry) => entry.raw.trim() !== '');
        if (!values.length) {
            return 0;
        }
        return values.reduce((sum, entry) => sum + entry.value, 0) / values.length;
    }

    constantTotal(item: ConstantDef): number {
        return item.months.reduce((sum, raw) => sum + this.evaluateAmount(raw), 0);
    }

    constantHit(month: Month, row: MonthRow): {amount: number; debitKey: string | null; creditKey: string | null} | null {
        const match = this.matchConstant(month, row);
        if (!match) {
            return null;
        }
        const amount = this.constantAmount(match, month.label.title);
        if (!amount) {
            return null;
        }
        const personIdx = month.columns.findIndex((column) => column.type === CELL_TYPE.select_person);
        const accountIdx = month.columns.findIndex((column) => column.type === CELL_TYPE.select_account);
        const payer = (row.cells[personIdx]?.raw ?? '').trim().toUpperCase();
        const payerAccount = (row.cells[accountIdx]?.raw ?? '').trim().toUpperCase();
        const debitKey = payer && payerAccount ? `${payer}|${payerAccount}` : null;
        const creditKey = match.person && match.account ? `${match.person}|${match.account}` : null;
        return {amount, debitKey, creditKey};
    }

    matchConstant(month: Month, row: MonthRow): ConstantDef | null {
        const textIdx = month.columns.findIndex((column) => column.type === CELL_TYPE.text);
        if (textIdx < 0) {
            return null;
        }
        const cell = row.cells[textIdx];
        const raw = (cell?.raw ?? '').trim();
        const display = (cell?.display ?? '').trim();
        const labels = raw.startsWith('=') ? [display] : [raw, display];
        return this.constants().find((item) => {
            const name = item.name.trim();
            return !!name && labels.some((label) => label === name);
        }) ?? null;
    }

    saldoTitleFor(combo: SaldoCombo): string {
        const auto = `${this.personLabel(combo.person)} ${this.accountLabel(combo.account)}`.trim();
        const stored = this.saldoColumnPrefs()[combo.key]?.title?.trim() || '';
        if (!stored || stored === `${combo.person} ${combo.account}` || stored === auto) {
            return auto;
        }
        return stored;
    }

    saldoTotalTitle(): string {
        return this.saldoTotalPref().title || 'Total';
    }

    saldoTotalVisible(): boolean {
        return this.saldoTotalPref().visible !== false;
    }

    setSaldoColumnPref(key: string, patch: Partial<SaldoColumnPref>): void {
        const current = this.saldoColumnPrefs();
        const fallback = current[key] ?? {visible: true, title: key.replace('|', ' ')};
        this.saldoColumnPrefs.set({
            ...current,
            [key]: {
                visible: patch.visible ?? fallback.visible,
                title: patch.title ?? fallback.title
            }
        });
        this.persistSettings();
        this.touch();
    }

    setSaldoTotalPref(patch: Partial<SaldoColumnPref>): void {
        const current = this.saldoTotalPref();
        this.saldoTotalPref.set({
            visible: patch.visible ?? current.visible,
            title: patch.title ?? current.title
        });
        this.persistSettings();
        this.touch();
    }

    touch(): void {
        this.revision.update((value) => value + 1);
    }

    openSettings(): void {
        this.settingsOpen.set(true);
    }

    closeSettings(): void {
        this.settingsOpen.set(false);
    }

    setOptions(options: WorkbookOptions): void {
        this.persons.set(this.normalizeCodes(options.person));
        this.accounts.set(this.normalizeCodes(options.account));
        this.persistSettings();
        this.touch();
    }

    openingOf(person: string, account: string): number {
        return this.openingBalances()[`${person}|${account}`] ?? 0;
    }

    setOpening(person: string, account: string, value: number): void {
        const next = {...this.openingBalances()};
        const key = `${person}|${account}`;
        if (!value) {
            delete next[key];
        } else {
            next[key] = value;
        }
        this.openingBalances.set(next);
        this.persistSettings();
        this.touch();
    }

    openingPersonTotal(person: string): number {
        return this.accountCodes().reduce((sum, account) => sum + this.openingOf(person, account), 0);
    }

    openingAccountTotal(account: string): number {
        return this.personCodes().reduce((sum, person) => sum + this.openingOf(person, account), 0);
    }

    openingGrandTotal(): number {
        return Object.values(this.openingBalances()).reduce((sum, value) => sum + value, 0);
    }

    addColumn(
        column: MonthColumn = new MonthColumn('Neu', CELL_TYPE.number, SECTION.AUSGANG),
        atIndex?: number
    ): void {
        const months = this.months();
        const target = atIndex === undefined ? (months[0]?.columns.length ?? 0) : atIndex;
        if (target < 0) {
            return;
        }
        this.formulaService.shiftAfterColumnInserted(target);
        months.forEach((month) => {
            const copy = new MonthColumn(column.title, column.type, column.section);
            const index = Math.min(target, month.columns.length);
            month.columns.splice(index, 0, copy);
            month.rows.forEach((row, rowIndex) => {
                row.cells.splice(index, 0, new MonthCell(
                    rowIndex,
                    index,
                    copy.title,
                    new CellType(copy.type),
                    ''
                ));
            });
        });
        this.reindexCells(months);
        this.publish(months);
    }

    insertColumn(index: number): void {
        this.addColumn(new MonthColumn('Neu', CELL_TYPE.number, SECTION.AUSGANG), index);
    }

    removeColumn(index: number): void {
        if (this.isLockedColumn(index)) {
            return;
        }
        this.formulaService.shiftAfterColumnRemoved(index);
        const months = this.months();
        months.forEach((month) => {
            month.columns.splice(index, 1);
            month.rows.forEach((row) => row.cells.splice(index, 1));
        });
        this.reindexCells(months);
        this.publish(months);
    }

    updateColumn(index: number, patch: Partial<{title: string; type: CELL_TYPE; section: SECTION}>): void {
        if (this.isLockedColumn(index)) {
            return;
        }
        const months = this.months();
        months.forEach((month) => {
            const column = month.columns[index];
            if (!column) {
                return;
            }
            if (patch.title !== undefined) {
                column.title = patch.title;
            }
            if (patch.type !== undefined) {
                column.type = patch.type;
            }
            if (patch.section !== undefined) {
                column.section = patch.section;
            }
            month.rows.forEach((row) => {
                const cell = row.cells[index];
                if (!cell) {
                    return;
                }
                cell.columnTitle = column.title;
                cell.type = new CellType(column.type);
            });
        });
        this.publish(months);
    }

    renameCode(kind: 'person' | 'account', from: string, to: string): void {
        const next = to.trim().toUpperCase();
        const prev = from.trim().toUpperCase();
        if (!next || next === prev) {
            return;
        }
        if (kind === 'person') {
            this.persons.set(this.normalizeCodes(
                this.persons().map((code) => code === prev ? next : code)
            ));
            this.personNames.set(this.renameNameMap(this.personNames(), prev, next));
        } else {
            this.accounts.set(this.normalizeCodes(
                this.accounts().map((code) => code === prev ? next : code)
            ));
            this.accountNames.set(this.renameNameMap(this.accountNames(), prev, next));
        }
        const opening = {...this.openingBalances()};
        Object.keys(opening).forEach((key) => {
            const [person, account] = key.split('|');
            if (kind === 'person' && person === prev) {
                opening[`${next}|${account}`] = opening[key];
                delete opening[key];
            }
            if (kind === 'account' && account === prev) {
                opening[`${person}|${next}`] = opening[key];
                delete opening[key];
            }
        });
        this.openingBalances.set(opening);
        const prefs = {...this.saldoColumnPrefs()};
        Object.keys(prefs).forEach((key) => {
            const [person, account] = key.split('|');
            if (kind === 'person' && person === prev) {
                prefs[`${next}|${account}`] = prefs[key];
                delete prefs[key];
            }
            if (kind === 'account' && account === prev) {
                prefs[`${person}|${next}`] = prefs[key];
                delete prefs[key];
            }
        });
        this.saldoColumnPrefs.set(prefs);
        this.constants.update((list) => list.map((item) => {
            if (kind === 'person' && item.person === prev) {
                return {...item, person: next};
            }
            if (kind === 'account' && item.account === prev) {
                return {...item, account: next};
            }
            return item;
        }));
        const type = kind === 'person' ? CELL_TYPE.select_person : CELL_TYPE.select_account;
        this.months().forEach((month) => {
            month.rows.forEach((row) => {
                row.cells.forEach((cell) => {
                    if (cell.type.id === type && (cell.raw || '').trim().toUpperCase() === prev) {
                        cell.raw = next;
                    }
                });
                if (kind === 'person') {
                    const person = row.cells.find((cell) => cell.type.id === CELL_TYPE.select_person);
                    row.color = (person?.raw || '').toLowerCase();
                }
            });
        });
        this.persistSettings();
        this.publish(this.months());
    }

    isLockedColumn(index: number): boolean {
        const type = this.months()[0]?.columns[index]?.type;
        return type === CELL_TYPE.none || type === CELL_TYPE.index;
    }

    toCsv(): string {
        const months = this.months();
        if (!months.length) {
            return '';
        }
        const opening = Object.entries(this.openingBalances())
            .filter(([, value]) => value)
            .map(([key, value]) => `${key}=${value}`)
            .join(';');
        const settings = JSON.stringify({
            saldoColumnPrefs: this.saldoColumnPrefs(),
            saldoTotalPref: this.saldoTotalPref(),
            saldoColumnsOpen: this.saldoColumnsOpen(),
            saldoPanelOpen: this.saldoPanelOpen(),
            personNames: this.personNames(),
            accountNames: this.accountNames(),
            headerRowHeight: this.headerRowHeight(),
            textColWidth: this.textColWidth(),
            constants: this.constants()
        });
        const meta = [
            `#persons:${this.encodeNamedCodes(this.personCodes(), this.personNames())}`,
            `#accounts:${this.encodeNamedCodes(this.accountCodes(), this.accountNames())}`,
            opening ? `#opening:${opening}` : '',
            `#constants:${JSON.stringify(this.constants())}`,
            `#settings:${settings}`
        ].filter(Boolean).join('\n');
        return `${meta}\n${CsvExportService.convertToCSV(months, months[0].columns)}`;
    }

    applyCsv(csvData: string): Month[] {
        const {meta, body} = WorkbookService.splitMeta(csvData);
        if (meta.persons.length) {
            this.persons.set(['', ...meta.persons]);
        }
        if (meta.accounts.length) {
            this.accounts.set(['', ...meta.accounts]);
        }
        if (Object.keys(meta.personNames).length) {
            this.personNames.set(meta.personNames);
        }
        if (Object.keys(meta.accountNames).length) {
            this.accountNames.set(meta.accountNames);
        }
        this.openingBalances.set(meta.opening);
        if (meta.settings) {
            if (meta.settings.saldoColumnPrefs) {
                this.saldoColumnPrefs.set(meta.settings.saldoColumnPrefs);
            }
            if (meta.settings.saldoTotalPref) {
                this.saldoTotalPref.set({
                    visible: meta.settings.saldoTotalPref.visible !== false,
                    title: meta.settings.saldoTotalPref.title || 'Total'
                });
            }
            if (typeof meta.settings.saldoColumnsOpen === 'boolean') {
                this.saldoColumnsOpen.set(meta.settings.saldoColumnsOpen);
            }
            if (typeof meta.settings.saldoPanelOpen === 'boolean') {
                this.saldoPanelOpen.set(meta.settings.saldoPanelOpen);
            }
            if (meta.settings.personNames) {
                this.personNames.set(meta.settings.personNames);
            }
            if (meta.settings.accountNames) {
                this.accountNames.set(meta.settings.accountNames);
            }
            if (typeof meta.settings.headerRowHeight === 'number') {
                this.headerRowHeight.set(meta.settings.headerRowHeight);
            }
            if (typeof meta.settings.textColWidth === 'number') {
                this.textColWidth.set(meta.settings.textColWidth);
            }
            if (Array.isArray(meta.settings.constants)) {
                this.constants.set(WorkbookService.normalizeConstants(meta.settings.constants));
            }
        }
        if (meta.constants.length) {
            this.constants.set(WorkbookService.normalizeConstants(meta.constants));
        }
        const months = CsvImportService.parseCSV(body);
        this.setMonths(months);
        this.persistSettings();
        return months;
    }

    comboSaldos(scope: 'month' | 'year'): ComboSaldo[] {
        this.revision();
        const months = scope === 'month'
            ? (this.selectedMonth() ? [this.selectedMonth() as Month] : [])
            : this.months();
        const map = new Map<string, ComboSaldo>();
        this.saldoCombos().forEach((combo) => {
            const opening = scope === 'year' ? this.openingOf(combo.person, combo.account) : 0;
            map.set(combo.key, {
                person: combo.person,
                account: combo.account,
                expenses: 0,
                income: 0,
                balance: opening
            });
        });
        months.forEach((month) => {
            const personIdx = month.columns.findIndex((col) => col.type === CELL_TYPE.select_person);
            const accountIdx = month.columns.findIndex((col) => col.type === CELL_TYPE.select_account);
            month.rows.forEach((row) => {
                const person = (row.cells[personIdx]?.raw ?? '').trim().toUpperCase();
                const account = (row.cells[accountIdx]?.raw ?? '').trim().toUpperCase();
                const bucket = map.get(`${person}|${account}`);
                if (bucket) {
                    const split = this.rowSplit(month, row);
                    bucket.income += split.income;
                    bucket.expenses += split.expenses;
                }
                this.applyConstantHit(map, month, row);
            });
        });
        map.forEach((item) => {
            const opening = scope === 'year' ? this.openingOf(item.person, item.account) : 0;
            item.balance = opening + item.income - item.expenses;
        });
        return [...map.values()];
    }

    runningSaldosForMonth(month: Month | undefined): Array<Record<string, number>> {
        this.revision();
        if (!month) {
            return [];
        }
        const running: Record<string, number> = {};
        this.saldoCombos().forEach((combo) => {
            running[combo.key] = this.openingOf(combo.person, combo.account);
        });
        const snapshots: Array<Record<string, number>> = [];
        for (const current of this.months()) {
            const personIdx = current.columns.findIndex((col) => col.type === CELL_TYPE.select_person);
            const accountIdx = current.columns.findIndex((col) => col.type === CELL_TYPE.select_account);
            current.rows.forEach((row) => {
                const person = (row.cells[personIdx]?.raw ?? '').trim().toUpperCase();
                const account = (row.cells[accountIdx]?.raw ?? '').trim().toUpperCase();
                const key = `${person}|${account}`;
                if (Object.prototype.hasOwnProperty.call(running, key)) {
                    running[key] += this.rowDelta(current, row);
                }
                const hit = this.constantHit(current, row);
                if (hit) {
                    if (hit.debitKey && Object.prototype.hasOwnProperty.call(running, hit.debitKey)) {
                        running[hit.debitKey] -= hit.amount;
                    }
                    if (hit.creditKey && Object.prototype.hasOwnProperty.call(running, hit.creditKey)) {
                        running[hit.creditKey] += hit.amount;
                    }
                }
                if (current === month) {
                    snapshots.push({...running});
                }
            });
            if (current === month) {
                break;
            }
        }
        return snapshots;
    }

    rowDelta(month: Month, row: MonthRow): number {
        const split = this.rowSplit(month, row);
        return split.income - split.expenses;
    }

    expenseColumns(): ExpenseColumn[] {
        const month = this.months()[0];
        if (!month) {
            return [];
        }
        return month.columns
            .map((column, index) => ({column, index}))
            .filter(({column}) => column.type === CELL_TYPE.number
                && (column.section === SECTION.AUSGANG || String(column.section).startsWith('A')))
            .map(({column, index}) => ({title: column.title, index}));
    }

    yearExpenseReport(): YearExpenseReport {
        const columns = this.expenseColumns();
        const persons = this.personCodes();
        const months = this.months().map((month) => this.monthExpenseBlock(month, columns, persons));
        const yearByColumn: Record<string, number> = {};
        columns.forEach((col) => {
            yearByColumn[col.title] = months.reduce((sum, block) => sum + (block.byColumn[col.title] ?? 0), 0);
        });
        const yearExpense = months.reduce((sum, block) => sum + block.total, 0);
        const yearIncome = this.months().reduce((sum, month) => {
            return sum + month.rows.reduce((rowSum, row) => rowSum + this.rowSplit(month, row).income, 0);
        }, 0);
        const divisor = Math.max(months.length, 1);
        const monthAvgMap: Record<string, number> = {};
        const dayAvgMap: Record<string, number> = {};
        columns.forEach((col) => {
            monthAvgMap[col.title] = (yearByColumn[col.title] ?? 0) / divisor;
            dayAvgMap[col.title] = (yearByColumn[col.title] ?? 0) / 365;
        });
        return {
            columns,
            persons,
            months,
            yearExpense,
            yearIncome,
            monthAvg: yearExpense / divisor,
            dayAvg: yearExpense / 365,
            summaryRows: [
                {label: 'Jahr', byColumn: yearByColumn, total: yearExpense},
                {label: 'Ø Monat', byColumn: monthAvgMap, total: yearExpense / divisor},
                {label: 'Ø Tag', byColumn: dayAvgMap, total: yearExpense / 365}
            ]
        };
    }

    yearCharts(): {personStack: object; categoryStack: object; incomeExpense: object} {
        const report = this.yearExpenseReport();
        const labels = report.months.map((block) => block.title);
        const personStack = {
            labels,
            datasets: report.persons.map((person, index) => ({
                label: this.personLabel(person),
                backgroundColor: PERSON_COLORS[person] ?? CATEGORY_COLORS[index % CATEGORY_COLORS.length],
                data: report.months.map((block) => block.personTotal[person] ?? 0)
            }))
        };
        const top = [...report.columns]
            .sort((a, b) => (report.summaryRows[0].byColumn[b.title] ?? 0) - (report.summaryRows[0].byColumn[a.title] ?? 0))
            .slice(0, 8);
        const categoryStack = {
            labels,
            datasets: top.map((col, index) => ({
                label: col.title,
                backgroundColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
                data: report.months.map((block) => block.byColumn[col.title] ?? 0)
            }))
        };
        const incomeExpense = {
            labels,
            datasets: [
                {
                    label: 'Einnahmen',
                    backgroundColor: '#4ade80',
                    data: this.months().map((month) => month.rows.reduce((sum, row) => sum + this.rowSplit(month, row).income, 0))
                },
                {
                    label: 'Ausgaben',
                    backgroundColor: '#f472b6',
                    data: report.months.map((block) => block.total)
                }
            ]
        };
        return {personStack, categoryStack, incomeExpense};
    }

    private monthExpenseBlock(month: Month, columns: ExpenseColumn[], persons: string[]): MonthExpenseBlock {
        const byPerson: Record<string, Record<string, number>> = {};
        const personTotal: Record<string, number> = {};
        const byColumn: Record<string, number> = {};
        persons.forEach((person) => {
            byPerson[person] = {};
            personTotal[person] = 0;
            columns.forEach((col) => {
                byPerson[person][col.title] = 0;
            });
        });
        columns.forEach((col) => {
            byColumn[col.title] = 0;
        });
        const personIdx = month.columns.findIndex((col) => col.type === CELL_TYPE.select_person);
        month.rows.forEach((row) => {
            const person = (row.cells[personIdx]?.raw ?? '').trim().toUpperCase();
            columns.forEach((col) => {
                const amount = this.formulaService.toNumber(row.cells[col.index]?.display || row.cells[col.index]?.raw || '') ?? 0;
                byColumn[col.title] += amount;
                if (byPerson[person]) {
                    byPerson[person][col.title] += amount;
                    personTotal[person] += amount;
                }
            });
        });
        const total = Object.values(byColumn).reduce((sum, value) => sum + value, 0);
        return {title: month.label.title, byPerson, personTotal, byColumn, total};
    }

    private rowSplit(month: Month, row: MonthRow): {income: number; expenses: number} {
        let income = 0;
        let expenses = 0;
        month.columns.forEach((column, index) => {
            if (column.type !== CELL_TYPE.number || column.section === SECTION.SALDO) {
                return;
            }
            const amount = this.formulaService.toNumber(
                row.cells[index]?.display || row.cells[index]?.raw || ''
            ) ?? 0;
            if (column.section === SECTION.EINGANG) {
                income += amount;
            } else if (column.section === SECTION.AUSGANG || String(column.section).startsWith('A')) {
                expenses += amount;
            }
        });
        return {income, expenses};
    }

    private publish(months: Month[]): void {
        this.months.set([...months]);
        this.formulaService.setMonths(this.months());
        this.touch();
    }

    private reindexCells(months: Month[]): void {
        months.forEach((month) => {
            month.rows.forEach((row, rowIndex) => {
                row.cells.forEach((cell, colIndex) => {
                    cell.rowIndex = rowIndex;
                    cell.columnIndex = colIndex;
                    cell.columnTitle = month.columns[colIndex]?.title ?? cell.columnTitle;
                });
            });
        });
    }

    private normalizeCodes(codes: string[]): string[] {
        const unique = new Set<string>();
        const result: string[] = [''];
        codes.forEach((code) => {
            const next = code.trim().toUpperCase();
            if (!next || unique.has(next)) {
                return;
            }
            unique.add(next);
            result.push(next);
        });
        return result;
    }

    private patchConstant(id: string, patch: Partial<ConstantDef>): void {
        this.constants.update((list) => list.map((item) => item.id === id ? {...item, ...patch} : item));
        this.persistSettings();
        this.touch();
    }

    private applyConstantHit(
        map: Map<string, ComboSaldo>,
        month: Month,
        row: MonthRow
    ): void {
        const hit = this.constantHit(month, row);
        if (!hit) {
            return;
        }
        if (hit.debitKey) {
            const debit = map.get(hit.debitKey);
            if (debit) {
                debit.expenses += hit.amount;
            }
        }
        if (hit.creditKey) {
            const credit = map.get(hit.creditKey);
            if (credit) {
                credit.income += hit.amount;
            }
        }
    }

    private evaluateAmount(raw: string, monthTitle?: string): number {
        const text = (raw ?? '').trim();
        if (!text) {
            return 0;
        }
        if (!this.formulaService.isFormula(text)) {
            return this.formulaService.toNumber(text) ?? 0;
        }
        const month = (monthTitle
            ? this.months().find((item) => item.label.title === monthTitle)
            : undefined) ?? this.months()[0];
        if (!month?.rows[0]?.cells[0]) {
            return this.formulaService.toNumber(text.slice(1)) ?? 0;
        }
        const scratch = new MonthCell(0, 0, '', new CellType(CELL_TYPE.number), text);
        this.formulaService.evaluateCell(month, scratch, new Set<string>());
        if (scratch.error) {
            return 0;
        }
        return this.formulaService.toNumber(scratch.display) ?? 0;
    }

    static emptyConstant(name = ''): ConstantDef {
        return {
            id: `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
            name,
            person: '',
            account: '',
            months: Array.from({length: 12}, () => '')
        };
    }

    static normalizeConstants(raw: unknown): ConstantDef[] {
        if (!Array.isArray(raw)) {
            return [WorkbookService.emptyConstant('')];
        }
        const list = raw.map((item) => {
            const source = item as Partial<ConstantDef>;
            const months = Array.from({length: 12}, (_, index) => {
                const value = Array.isArray(source.months) ? source.months[index] : '';
                return value == null ? '' : String(value);
            });
            return {
                id: source.id || WorkbookService.emptyConstant().id,
                name: (source.name || '').trim(),
                person: (source.person || '').trim().toUpperCase(),
                account: (source.account || '').trim().toUpperCase(),
                months
            };
        });
        return list.length ? list : [WorkbookService.emptyConstant('')];
    }

    private persistSettings(): void {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify({
            person: this.persons(),
            account: this.accounts(),
            personNames: this.personNames(),
            accountNames: this.accountNames(),
            opening: this.openingBalances(),
            saldoColumnsOpen: this.saldoColumnsOpen(),
            saldoPanelOpen: this.saldoPanelOpen(),
            saldoColumnPrefs: this.saldoColumnPrefs(),
            saldoTotalPref: this.saldoTotalPref(),
            headerRowHeight: this.headerRowHeight(),
            textColWidth: this.textColWidth(),
            constants: this.constants()
        }));
    }

    private restoreSettings(): void {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (!raw) {
            return;
        }
        try {
            const parsed = JSON.parse(raw) as WorkbookOptions & {
                opening?: Record<string, number>;
                personNames?: Record<string, string>;
                accountNames?: Record<string, string>;
                saldoColumnsOpen?: boolean;
                saldoPanelOpen?: boolean;
                saldoColumnPrefs?: Record<string, SaldoColumnPref>;
                saldoTotalPref?: SaldoColumnPref;
                headerRowHeight?: number;
                textColWidth?: number;
                constants?: ConstantDef[];
            };
            if (Array.isArray(parsed.person)) {
                this.persons.set(this.normalizeCodes(parsed.person));
            }
            if (Array.isArray(parsed.account)) {
                this.accounts.set(this.normalizeCodes(parsed.account));
            }
            if (parsed.personNames && typeof parsed.personNames === 'object') {
                this.personNames.set(parsed.personNames);
            }
            if (parsed.accountNames && typeof parsed.accountNames === 'object') {
                this.accountNames.set(parsed.accountNames);
            }
            if (typeof parsed.headerRowHeight === 'number') {
                this.headerRowHeight.set(parsed.headerRowHeight);
            }
            if (typeof parsed.textColWidth === 'number') {
                this.textColWidth.set(parsed.textColWidth);
            }
            if (parsed.opening && typeof parsed.opening === 'object') {
                this.openingBalances.set(parsed.opening);
            }
            if (typeof parsed.saldoColumnsOpen === 'boolean') {
                this.saldoColumnsOpen.set(parsed.saldoColumnsOpen);
            }
            if (typeof parsed.saldoPanelOpen === 'boolean') {
                this.saldoPanelOpen.set(parsed.saldoPanelOpen);
            }
            if (parsed.saldoColumnPrefs && typeof parsed.saldoColumnPrefs === 'object') {
                this.saldoColumnPrefs.set(parsed.saldoColumnPrefs);
            }
            if (parsed.saldoTotalPref && typeof parsed.saldoTotalPref === 'object') {
                this.saldoTotalPref.set({
                    visible: parsed.saldoTotalPref.visible !== false,
                    title: parsed.saldoTotalPref.title || 'Total'
                });
            }
            if (Array.isArray(parsed.constants)) {
                this.constants.set(WorkbookService.normalizeConstants(parsed.constants));
            }
        } catch {
            return;
        }
    }

    private encodeNamedCodes(codes: string[], names: Record<string, string>): string {
        return codes.map((code) => {
            const name = (names[code] || '').trim();
            return name && name.toUpperCase() !== code ? `${code}=${name}` : code;
        }).join(',');
    }

    private renameNameMap(map: Record<string, string>, prev: string, next: string): Record<string, string> {
        if (!map[prev] && !map[next]) {
            return map;
        }
        const copy = {...map};
        if (copy[prev] && !copy[next]) {
            copy[next] = copy[prev];
        }
        delete copy[prev];
        return copy;
    }

    static parseNamedCodes(line: string): {codes: string[]; names: Record<string, string>} {
        const codes: string[] = [];
        const names: Record<string, string> = {};
        line.split(',').forEach((item) => {
            const raw = item.trim();
            if (!raw) {
                return;
            }
            const eq = raw.indexOf('=');
            if (eq > 0) {
                const code = raw.slice(0, eq).trim().toUpperCase();
                const name = raw.slice(eq + 1).trim();
                if (!code) {
                    return;
                }
                codes.push(code);
                if (name && name.toUpperCase() !== code) {
                    names[code] = name;
                }
                return;
            }
            codes.push(raw.toUpperCase());
        });
        return {codes, names};
    }

    static splitMeta(csvData: string): {
        meta: {
            persons: string[];
            accounts: string[];
            personNames: Record<string, string>;
            accountNames: Record<string, string>;
            opening: Record<string, number>;
            constants: ConstantDef[];
            settings: {
                saldoColumnPrefs?: Record<string, SaldoColumnPref>;
                saldoTotalPref?: SaldoColumnPref;
                saldoColumnsOpen?: boolean;
                saldoPanelOpen?: boolean;
                personNames?: Record<string, string>;
                accountNames?: Record<string, string>;
                headerRowHeight?: number;
                textColWidth?: number;
                constants?: ConstantDef[];
            } | null;
        };
        body: string;
    } {
        const lines = csvData.replace(/^\uFEFF/, '').split(/\r?\n/);
        const persons: string[] = [];
        const accounts: string[] = [];
        const personNames: Record<string, string> = {};
        const accountNames: Record<string, string> = {};
        const opening: Record<string, number> = {};
        const constants: ConstantDef[] = [];
        let settings: {
            saldoColumnPrefs?: Record<string, SaldoColumnPref>;
            saldoTotalPref?: SaldoColumnPref;
            saldoColumnsOpen?: boolean;
            saldoPanelOpen?: boolean;
            personNames?: Record<string, string>;
            accountNames?: Record<string, string>;
            headerRowHeight?: number;
            textColWidth?: number;
            constants?: ConstantDef[];
        } | null = null;
        const rest: string[] = [];
        lines.forEach((line) => {
            if (line.startsWith('#persons:')) {
                const parsed = WorkbookService.parseNamedCodes(line.slice(9));
                persons.push(...parsed.codes);
                Object.assign(personNames, parsed.names);
            } else if (line.startsWith('#accounts:')) {
                const parsed = WorkbookService.parseNamedCodes(line.slice(10));
                accounts.push(...parsed.codes);
                Object.assign(accountNames, parsed.names);
            } else if (line.startsWith('#opening:')) {
                line.slice(9).split(';').forEach((pair) => {
                    const [key, raw] = pair.split('=');
                    if (!key || raw === undefined) {
                        return;
                    }
                    const value = Number(raw);
                    if (Number.isFinite(value)) {
                        opening[key.trim()] = value;
                    }
                });
            } else if (line.startsWith('#constants:')) {
                try {
                    constants.push(...WorkbookService.normalizeConstants(JSON.parse(line.slice(11))));
                } catch {
                    /* ignore */
                }
            } else if (line.startsWith('#settings:')) {
                try {
                    settings = JSON.parse(line.slice(10)) as typeof settings;
                } catch {
                    settings = null;
                }
            } else {
                rest.push(line);
            }
        });
        return {meta: {persons, accounts, personNames, accountNames, opening, constants, settings}, body: rest.join('\n')};
    }
}
