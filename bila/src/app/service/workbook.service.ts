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
import {applyColumnFills, isColumnConstant} from './column-fill';
import {TableHistoryService} from './table-history.service';
import {CurrencyFxService} from './currency-fx.service';
import {BASE_CURRENCY} from '../model/CurrencyFx';

export interface WorkbookOptions { person: string[]; account: string[]; }
export interface ComboSaldo { person: string; account: string; expenses: number; income: number; balance: number; }
export interface SaldoCombo { person: string; account: string; key: string; }
export type YearView = 'month' | 'start' | 'constants' | 'fx' | 'total' | 'graf' | 'csv';
export const CONSTANT_MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'] as const;
export interface ConstantDef { id: string; name: string; person: string; account: string; months: string[]; }
export interface SaldoColumnPref { visible: boolean; title: string; }
export interface ExpenseColumn { title: string; index: number; }
export interface MonthExpenseBlock {
    title: string; byPerson: Record<string, Record<string, number>>; personTotal: Record<string, number>;
    byColumn: Record<string, number>; total: number;
}
export interface YearExpenseReport {
    columns: ExpenseColumn[]; persons: string[]; months: MonthExpenseBlock[];
    yearExpense: number; yearIncome: number; monthAvg: number; dayAvg: number;
    summaryRows: Array<{label: string; byColumn: Record<string, number>; total: number}>;
}

const SETTINGS_KEY = 'philanz-settings';

@Injectable({ providedIn: 'root' })
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
                combos.push({ person, account, key: `${person}|${account}` });
            });
        });
        return combos;
    });

    constructor(
        private readonly formulaService: FormulaService,
        readonly history: TableHistoryService,
        readonly fx: CurrencyFxService
    ) {}

    setMonths(months: Month[]): void {
        this.months.set(months);
        this.selectedMonth.set(months[0] ?? null);
        this.view.set(months.length ? 'month' : 'start');
        this.formulaService.setMonths(months);
        this.touch();
    }
    selectMonth(month: Month): void { this.selectedMonth.set(month); }
    setView(view: YearView): void { this.view.set(view); }
    toggleSaldoColumns(): void { this.saldoColumnsOpen.update((v) => !v); }
    toggleSaldoPanel(): void { this.saldoPanelOpen.update((v) => !v); }
    visibleSaldoCombos(): SaldoCombo[] { return this.saldoCombos(); }
    personLabel(code: string): string { return (code || '').trim().toUpperCase(); }
    accountLabel(code: string): string { return (code || '').trim().toUpperCase(); }
    optionLabel(kind: 'person' | 'account', code: string): string { return code; }
    setCodeName(): void {}
    setHeaderRowHeight(px: number): void { this.headerRowHeight.set(px); }
    setTextColWidth(px: number): void { this.textColWidth.set(px); }
    addConstant(): void {}
    removeConstant(): void {}
    setConstantName(): void {}
    setConstantPerson(): void {}
    setConstantAccount(): void {}
    setConstantMonth(): void {}
    isFormula(raw: string | null | undefined): boolean { return this.formulaService.isFormula(raw); }
    constantAmount(): number { return 0; }
    constantAverage(): number { return 0; }
    constantTotal(): number { return 0; }
    constantHit(): null { return null; }
    matchConstant(): null { return null; }
    saldoTitleFor(combo: SaldoCombo): string { return `${combo.person} ${combo.account}`; }
    saldoTotalTitle(): string { return 'Total'; }
    saldoTotalVisible(): boolean { return true; }
    setSaldoColumnPref(): void {}
    setSaldoTotalPref(): void {}
    touch(): void { this.revision.update((v) => v + 1); }
    openSettings(): void { this.settingsOpen.set(true); }
    closeSettings(): void { this.settingsOpen.set(false); }
    setOptions(options: WorkbookOptions): void {
        this.persons.set(['', ...options.person.filter(Boolean)]);
        this.accounts.set(['', ...options.account.filter(Boolean)]);
    }
    openingOf(): number { return 0; }
    setOpening(): void {}
    openingPersonTotal(): number { return 0; }
    openingAccountTotal(): number { return 0; }
    openingGrandTotal(): number { return 0; }
    addColumn(): void {}
    insertColumn(): void {}
    removeColumn(): void {}
    updateColumn(): void {}
    renameCode(): void {}
    isLockedColumn(): boolean { return false; }
    toCsv(): string { return ''; }
    applyCsv(csvData: string): Month[] {
        const months = CsvImportService.parseCSV(csvData);
        this.setMonths(months);
        return months;
    }
    comboSaldos(): ComboSaldo[] { return []; }
    runningSaldosForMonth(): Array<Record<string, number>> { return []; }
    rowDelta(): number { return 0; }
    expenseColumns(): ExpenseColumn[] { return []; }
    yearExpenseReport(): YearExpenseReport {
        return { columns: [], persons: [], months: [], yearExpense: 0, yearIncome: 0, monthAvg: 0, dayAvg: 0, summaryRows: [] };
    }
    yearCharts(): {personStack: object; categoryStack: object; incomeExpense: object} {
        return { personStack: {labels: [], datasets: []}, categoryStack: {labels: [], datasets: []}, incomeExpense: {labels: [], datasets: []} };
    }
    currencyTrendCharts() {
        return { labels: [] as string[], datasets: [] as Array<{label: string; borderColor: string; backgroundColor: string; data: number[]; tension: number}> };
    }
    persistFx(): void { this.touch(); }
    static emptyConstant(name = ''): ConstantDef {
        return { id: `c${Date.now()}`, name, person: '', account: '', months: Array.from({length: 12}, () => '') };
    }
    static normalizeConstants(raw: unknown): ConstantDef[] {
        return Array.isArray(raw) && raw.length ? raw as ConstantDef[] : [WorkbookService.emptyConstant('')];
    }
    static parseNamedCodes(line: string): {codes: string[]; names: Record<string, string>} {
        return { codes: line.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean), names: {} };
    }
    static splitMeta(csvData: string): { meta: any; body: string } {
        return { meta: { persons: [], accounts: [], personNames: {}, accountNames: {}, opening: {}, constants: [], fx: null, settings: null }, body: csvData };
    }
}
