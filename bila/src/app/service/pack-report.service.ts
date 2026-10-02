import {Injectable, inject, signal} from '@angular/core';
import {WorkbookService} from './workbook.service';
import {YearArchiveService} from './year-archive.service';
import {FormulaService} from './formula.service';
import {TableHistoryService} from './table-history.service';
import {CurrencyFxService} from './currency-fx.service';
import {BASE_CURRENCY} from '../model/CurrencyFx';
import {buildYearTotalReport} from '../component/yearTotal/year-total.report';

const CALENDAR_MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

export type MonthCompare = {
    prevYear: string;
    total: number;
    prevTotal: number;
    pct: number | null;
    byColumn: Record<string, number>;
    personTotal: Record<string, number>;
};

export type PackMonthBlock = ReturnType<typeof buildYearTotalReport>['months'][number] & {
    year: string;
    monthKey: string;
    compare?: MonthCompare;
};

export type PackTotalReport = ReturnType<typeof buildYearTotalReport> & {
    months: PackMonthBlock[];
    compares: Array<{
        label: string;
        text: string;
        delta: number;
        pct: number | null;
    }>;
};

export type BarChart = {labels: string[]; datasets: Array<{label: string; data: number[]} & Record<string, unknown>>};

export interface PackYearSlice {
    id: string;
    title: string;
    report: ReturnType<typeof buildYearTotalReport>;
    charts: ReturnType<WorkbookService['yearCharts']>;
    trend: ReturnType<WorkbookService['currencyTrendCharts']>;
}

/** Archive year that could not be loaded into the pack report. */
export type PackSkippedYear = {
    id: string;
    reason: string;
};

@Injectable({providedIn: 'root'})
export class PackReportService {
    private readonly workbook = inject(WorkbookService);
    private readonly archive = inject(YearArchiveService);
    private busy = false;
    private stamp = '';
    /** Isolated workbook for archive years — never touches the live singleton. */
    private scratch: WorkbookService | null = null;

    readonly report = signal<PackTotalReport | null>(null);
    readonly charts = signal<{personStack: BarChart; categoryStack: BarChart; incomeExpense: BarChart} | null>(null);
    readonly trend = signal<BarChart | null>(null);
    readonly yoy = signal<BarChart | null>(null);
    readonly error = signal('');
    /** Years skipped during the last refresh (broken CSV / load failure). */
    readonly skipped = signal<PackSkippedYear[]>([]);

    refresh(): void {
        const currency = this.workbook.fx.displayCurrency();
        const stamp = this.archive.years()
            .map((item) => `${item.id}:${contentStamp(this.archive.csvOf(item.id) || '')}`)
            .join('|') + `@${currency}|${this.workbook.months().length}`;
        if (this.busy || stamp === this.stamp) {
            return;
        }
        this.busy = true;
        try {
            const {slices, skipped} = this.snapshot();
            this.skipped.set(skipped);
            this.report.set(this.mergeReport(slices));
            this.charts.set(this.mergeCharts(slices));
            this.trend.set(this.mergeTrend(slices));
            this.yoy.set(this.mergeYoy(slices));
            if (!slices.length) {
                this.error.set(
                    skipped.length
                        ? skipped.map(formatSkipBanner).join(' · ')
                        : 'Noch kein Set im Browser. Unter Set eine Datei importieren.'
                );
            } else {
                this.error.set('');
            }
            this.stamp = stamp;
        } catch (err) {
            // Hard failure — do not leave a partial report looking complete.
            this.error.set(err instanceof Error ? err.message : 'Set-Auswertung fehlgeschlagen.');
            this.skipped.set([]);
            this.report.set(null);
            this.charts.set(null);
            this.trend.set(null);
            this.yoy.set(null);
        } finally {
            this.busy = false;
        }
    }

    private snapshot(): {slices: PackYearSlice[]; skipped: PackSkippedYear[]} {
        const slices: PackYearSlice[] = [];
        const skipped: PackSkippedYear[] = [];
        const years = this.archive.years();
        if (!years.length && this.workbook.months().length) {
            slices.push(this.sliceOf(this.workbook, this.archive.suggestedName(), this.archive.suggestedName()));
            return {slices, skipped};
        }
        const scratch = this.borrowScratch();
        years.forEach((item) => {
            const csv = this.archive.csvOf(item.id);
            if (!csv?.trim()) {
                return;
            }
            try {
                this.loadYear(scratch, csv, item.id);
                slices.push(this.sliceOf(scratch, item.id, item.name));
            } catch (err) {
                skipped.push({id: item.id, reason: shortSkipReason(err)});
            }
        });
        slices.sort((a, b) => a.id.localeCompare(b.id, 'de'));
        return {slices, skipped};
    }

    /** Lazy scratch workbook with persistence disabled so applyCsv cannot clobber live settings. */
    private borrowScratch(): WorkbookService {
        if (!this.scratch) {
            const fx = new CurrencyFxService();
            const wb = new WorkbookService(new FormulaService(), new TableHistoryService(), fx);
            (wb as unknown as {persistSettings: () => void}).persistSettings = () => undefined;
            this.scratch = wb;
        }
        return this.scratch;
    }

    /** Apply archive CSV on scratch; seed live FX so display-currency conversion matches UI. */
    private loadYear(scratch: WorkbookService, csv: string, yearId: string): void {
        this.seedLiveFx(scratch);
        scratch.applyCsv(csv);
        if (!scratch.months().length) {
            throw new Error('kein Monat');
        }
        this.preferLiveDisplay(scratch);
        const yearNum = parseInt(yearId, 10);
        if (Number.isFinite(yearNum) && scratch.fx.calendarYear() !== yearNum) {
            const hasFxMeta = /(?:^|\n)#fx:/.test(csv) || /calendarYear/.test(csv);
            if (!hasFxMeta) {
                scratch.fx.setCalendarYear(yearNum);
            }
        }
    }

    private seedLiveFx(scratch: WorkbookService): void {
        const live = this.workbook.fx;
        scratch.fx.load(live.snapshot(), live.calendarYear());
        scratch.fx.setDisplayCurrency(live.displayCurrency());
    }

    private preferLiveDisplay(scratch: WorkbookService): void {
        const live = this.workbook.fx;
        const code = live.displayCurrency();
        if (code !== BASE_CURRENCY && !scratch.fx.currencies().some((item) => item.code === code)) {
            const series = live.snapshot().find((item) => item.code === code);
            if (series) {
                scratch.fx.load([...scratch.fx.snapshot(), series], scratch.fx.calendarYear());
            }
        }
        scratch.fx.setDisplayCurrency(code);
    }

    private sliceOf(wb: WorkbookService, id: string, title: string): PackYearSlice {
        return {
            id,
            title,
            report: buildYearTotalReport(wb),
            charts: wb.yearCharts(),
            trend: wb.currencyTrendCharts()
        };
    }

    private mergeReport(slices: PackYearSlice[]): PackTotalReport | null {
        if (!slices.length) {
            return null;
        }
        const columns = new Map<string, PackTotalReport['columns'][number]>();
        const persons = new Set<string>();
        slices.forEach((slice) => {
            (slice.report.columns || []).forEach((col) => {
                const key = col.key || `${col.section || 'A'}::${col.index}::${col.title}`;
                if (!columns.has(key)) {
                    columns.set(key, {...col, key});
                }
            });
            slice.report.persons.forEach((person) => persons.add(person));
        });
        const colList = [...columns.values()];
        const personList = [...persons];
        const months: PackMonthBlock[] = [];
        slices.forEach((slice) => {
            slice.report.months.forEach((block) => {
                const byColumn: Record<string, number> = {};
                const byPerson: Record<string, Record<string, number>> = {};
                const personTotal: Record<string, number> = {};
                colList.forEach((col) => {
                    const legacy = `${col.title}:${col.index}`;
                    byColumn[col.key] = block.byColumn[col.key]
                        ?? block.byColumn[col.title]
                        ?? block.byColumn[legacy]
                        ?? 0;
                });
                personList.forEach((person) => {
                    byPerson[person] = {};
                    colList.forEach((col) => {
                        const legacy = `${col.title}:${col.index}`;
                        byPerson[person][col.key] = block.byPerson[person]?.[col.key]
                            ?? block.byPerson[person]?.[col.title]
                            ?? block.byPerson[person]?.[legacy]
                            ?? 0;
                    });
                    personTotal[person] = block.personTotal[person] ?? 0;
                });
                months.push({
                    ...block,
                    title: `${slice.title} ${block.title}`,
                    year: slice.title,
                    monthKey: calendarKey(block.title),
                    byColumn,
                    byPerson,
                    personTotal
                });
            });
        });
        const lookup = new Map<string, PackMonthBlock>();
        months.forEach((block) => lookup.set(`${block.year}|${block.monthKey}`, block));
        const compares: PackTotalReport['compares'] = [];
        months.forEach((block) => {
            const prevYear = previousYearId(block.year, slices.map((slice) => slice.title));
            if (!prevYear) {
                return;
            }
            const prev = lookup.get(`${prevYear}|${block.monthKey}`);
            if (!prev) {
                return;
            }
            const byColumn: Record<string, number> = {};
            colList.forEach((col) => {
                byColumn[col.key] = (block.byColumn[col.key] ?? 0) - (prev.byColumn[col.key] ?? 0);
            });
            const personTotal: Record<string, number> = {};
            personList.forEach((person) => {
                personTotal[person] = (block.personTotal[person] ?? 0) - (prev.personTotal[person] ?? 0);
            });
            const total = (block.total ?? 0) - (prev.total ?? 0);
            const pct = percentDelta(block.total ?? 0, prev.total ?? 0);
            block.compare = {
                prevYear,
                total,
                prevTotal: prev.total ?? 0,
                pct,
                byColumn,
                personTotal
            };
            compares.push({
                label: `${block.monthKey} ${block.year}`,
                text: `${block.monthKey} ${block.year} vs ${block.monthKey} ${prevYear}: ${formatSigned(total)}${pct == null ? '' : ` (${formatSigned(pct)} %)`}`,
                delta: total,
                pct
            });
        });
        const yearExpense = slices.reduce((sum, slice) => sum + (slice.report.yearExpense ?? 0), 0);
        const yearIncome = slices.reduce((sum, slice) => sum + (slice.report.yearIncome ?? 0), 0);
        const divisor = Math.max(months.length, 1);
        const days = Math.max(slices.length, 1) * 365;
        const yearByColumn: Record<string, number> = {};
        colList.forEach((col) => {
            yearByColumn[col.key] = months.reduce((sum, block) => sum + (block.byColumn[col.key] ?? 0), 0);
        });
        const monthAvgMap: Record<string, number> = {};
        const dayAvgMap: Record<string, number> = {};
        colList.forEach((col) => {
            monthAvgMap[col.key] = (yearByColumn[col.key] ?? 0) / divisor;
            dayAvgMap[col.key] = (yearByColumn[col.key] ?? 0) / days;
        });
        return {
            ...slices[0].report,
            columns: colList,
            persons: personList,
            months,
            compares,
            yearExpense,
            yearIncome,
            monthAvg: (yearExpense + yearIncome) / divisor,
            dayAvg: (yearExpense + yearIncome) / days,
            summaryRows: [
                {label: 'Set', byColumn: yearByColumn, total: yearExpense + yearIncome},
                {label: 'Ø Monat', byColumn: monthAvgMap, total: (yearExpense + yearIncome) / divisor},
                {label: 'Ø Tag', byColumn: dayAvgMap, total: (yearExpense + yearIncome) / days}
            ]
        };
    }

    private mergeCharts(slices: PackYearSlice[]): {personStack: BarChart; categoryStack: BarChart; incomeExpense: BarChart} | null {
        if (!slices.length) {
            return null;
        }
        return {
            personStack: this.overlayBars(slices.map((slice) => ({title: slice.title, chart: slice.charts.personStack as BarChart}))),
            categoryStack: this.overlayBars(slices.map((slice) => ({title: slice.title, chart: slice.charts.categoryStack as BarChart}))),
            incomeExpense: this.overlayBars(slices.map((slice) => ({title: slice.title, chart: slice.charts.incomeExpense as BarChart})))
        };
    }

    private mergeTrend(slices: PackYearSlice[]): BarChart | null {
        if (!slices.length) {
            return null;
        }
        const merged = this.overlayBars(slices.map((slice) => ({title: slice.title, chart: slice.trend as BarChart})));
        return merged.labels.length ? merged : null;
    }

    private mergeYoy(slices: PackYearSlice[]): BarChart | null {
        if (slices.length < 2) {
            return null;
        }
        const income = this.overlayBars(slices.map((slice) => ({title: slice.title, chart: slice.charts.incomeExpense as BarChart})));
        const years = slices.map((slice) => slice.title);
        const datasets: BarChart['datasets'] = [];
        for (let i = 1; i < years.length; i++) {
            const prev = years[i - 1];
            const curr = years[i];
            ['Einnahmen', 'Ausgaben'].forEach((kind, kindIndex) => {
                const currSet = income.datasets.find((item) => item.label === `${curr} ${kind}`);
                const prevSet = income.datasets.find((item) => item.label === `${prev} ${kind}`);
                if (!currSet && !prevSet) {
                    return;
                }
                datasets.push({
                    label: `${kind} ${prev}→${curr}`,
                    backgroundColor: kindIndex ? '#f472b6' : '#4ade80',
                    data: income.labels.map((_, index) => (currSet?.data?.[index] ?? 0) - (prevSet?.data?.[index] ?? 0))
                });
            });
        }
        return datasets.length ? {labels: income.labels, datasets} : null;
    }

    private overlayBars(parts: Array<{title: string; chart: BarChart}>): BarChart {
        const seen = new Set<string>();
        parts.forEach((part) => {
            (part.chart?.labels || []).forEach((label) => seen.add(calendarKey(label)));
        });
        const extra = [...seen].filter((key) => !CALENDAR_MONTHS.includes(key));
        const labels = [...CALENDAR_MONTHS.filter((key) => seen.has(key)), ...extra];
        const datasets = new Map<string, {label: string; data: number[]} & Record<string, unknown>>();
        parts.forEach((part) => {
            const chart = part.chart || {labels: [], datasets: []};
            const indexOf = new Map((chart.labels || []).map((label, index) => [calendarKey(label), index]));
            (chart.datasets || []).forEach((dataset) => {
                const label = `${part.title} ${dataset.label || ''}`.trim();
                datasets.set(label, {
                    ...dataset,
                    label,
                    data: labels.map((month) => {
                        const index = indexOf.get(month);
                        return index == null ? 0 : Number(dataset.data?.[index] ?? 0);
                    })
                });
            });
        });
        return {labels, datasets: [...datasets.values()]};
    }
}

function formatSkipBanner(item: PackSkippedYear): string {
    return item.reason ? `${item.id} übersprungen (${item.reason})` : `${item.id} übersprungen`;
}

function shortSkipReason(err: unknown): string {
    if (err instanceof Error) {
        const msg = err.message.replace(/\s+/g, ' ').trim();
        if (msg) {
            return msg.length > 60 ? `${msg.slice(0, 57)}…` : msg;
        }
    }
    return 'CSV ungültig';
}

function contentStamp(csv: string): string {
    let hash = 2166136261;
    for (let i = 0; i < csv.length; i++) {
        hash ^= csv.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return `${(hash >>> 0).toString(36)}:${csv.length}`;
}

function calendarKey(label: string): string {
    const text = String(label || '').trim();
    const hit = CALENDAR_MONTHS.find((month) => text === month || text.endsWith(` ${month}`));
    if (hit) {
        return hit;
    }
    return text.replace(/^\d{4}\s+/, '').trim() || text;
}

function previousYearId(year: string, years: string[]): string | null {
    const numeric = parseInt(year, 10);
    if (Number.isFinite(numeric)) {
        const prev = String(numeric - 1);
        return years.includes(prev) ? prev : null;
    }
    const index = years.indexOf(year);
    return index > 0 ? years[index - 1] : null;
}

function percentDelta(current: number, previous: number): number | null {
    if (!Number.isFinite(previous) || previous === 0) {
        return null;
    }
    return ((current - previous) / Math.abs(previous)) * 100;
}

function formatSigned(value: number): string {
    const rounded = Math.round(value * 100) / 100;
    const body = Math.abs(rounded).toLocaleString('de-CH');
    if (rounded > 0) {
        return `+${body}`;
    }
    if (rounded < 0) {
        return `−${body}`;
    }
    return body;
}
