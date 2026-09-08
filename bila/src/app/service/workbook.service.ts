import {Injectable, computed, signal} from '@angular/core';
import {Month} from '../model/Month';
import {MonthColumn} from '../model/MonthColumn';
import {MonthCell} from '../model/MonthCell';
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

const SETTINGS_KEY = 'philanz-settings';

@Injectable({
    providedIn: 'root'
})
export class WorkbookService {
    readonly months = signal<Month[]>([]);
    readonly selectedMonth = signal<Month | null>(null);
    readonly settingsOpen = signal(false);
    readonly revision = signal(0);
    readonly persons = signal<string[]>(['', 'P', 'L', 'H', 'E', 'A']);
    readonly accounts = signal<string[]>(['', 'B', 'K', 'S', 'R', 'Y', 'T']);

    readonly personCodes = computed(() => this.persons().filter((code) => !!code));
    readonly accountCodes = computed(() => this.accounts().filter((code) => !!code));

    constructor(private readonly formulaService: FormulaService) {
        this.restoreSettings();
    }

    setMonths(months: Month[]): void {
        this.months.set(months);
        this.selectedMonth.set(months[0] ?? null);
        this.formulaService.setMonths(months);
        this.touch();
    }

    selectMonth(month: Month): void {
        this.selectedMonth.set(month);
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
        } else {
            this.accounts.set(this.normalizeCodes(
                this.accounts().map((code) => code === prev ? next : code)
            ));
        }
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
        const meta = [
            `#persons:${this.personCodes().join(',')}`,
            `#accounts:${this.accountCodes().join(',')}`
        ].join('\n');
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
        const persons = this.personCodes();
        const accounts = this.accountCodes();
        const map = new Map<string, ComboSaldo>();
        persons.forEach((person) => {
            accounts.forEach((account) => {
                map.set(`${person}|${account}`, {
                    person,
                    account,
                    expenses: 0,
                    income: 0,
                    balance: 0
                });
            });
        });
        months.forEach((month) => {
            const personIdx = month.columns.findIndex((col) => col.type === CELL_TYPE.select_person);
            const accountIdx = month.columns.findIndex((col) => col.type === CELL_TYPE.select_account);
            month.rows.forEach((row) => {
                const person = (row.cells[personIdx]?.raw ?? '').trim().toUpperCase();
                const account = (row.cells[accountIdx]?.raw ?? '').trim().toUpperCase();
                const bucket = map.get(`${person}|${account}`);
                if (!bucket) {
                    return;
                }
                month.columns.forEach((column, index) => {
                    if (column.type !== CELL_TYPE.number) {
                        return;
                    }
                    const amount = this.formulaService.toNumber(row.cells[index]?.display || row.cells[index]?.raw || '') ?? 0;
                    if (column.section === SECTION.EINGANG) {
                        bucket.income += amount;
                    } else if (column.section === SECTION.AUSGANG || String(column.section).startsWith('A')) {
                        bucket.expenses += amount;
                    }
                });
            });
        });
        map.forEach((item) => {
            item.balance = item.income - item.expenses;
        });
        return [...map.values()];
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

    private persistSettings(): void {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify({
            person: this.persons(),
            account: this.accounts()
        }));
    }

    private restoreSettings(): void {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (!raw) {
            return;
        }
        try {
            const parsed = JSON.parse(raw) as WorkbookOptions;
            if (Array.isArray(parsed.person)) {
                this.persons.set(this.normalizeCodes(parsed.person));
            }
            if (Array.isArray(parsed.account)) {
                this.accounts.set(this.normalizeCodes(parsed.account));
            }
        } catch {
            return;
        }
    }

    static splitMeta(csvData: string): {meta: {persons: string[]; accounts: string[]}; body: string} {
        const lines = csvData.replace(/^\uFEFF/, '').split(/\r?\n/);
        const persons: string[] = [];
        const accounts: string[] = [];
        const rest: string[] = [];
        lines.forEach((line) => {
            if (line.startsWith('#persons:')) {
                persons.push(...line.slice(9).split(',').map((item) => item.trim()).filter(Boolean));
            } else if (line.startsWith('#accounts:')) {
                accounts.push(...line.slice(10).split(',').map((item) => item.trim()).filter(Boolean));
            } else {
                rest.push(line);
            }
        });
        return {meta: {persons, accounts}, body: rest.join('\n')};
    }
}
