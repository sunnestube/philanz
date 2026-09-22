import {Injectable, inject} from '@angular/core';
import {WorkbookService, YearView} from './workbook.service';
import {YearArchiveService} from './year-archive.service';
import {buildYearTotalReport} from '../component/yearTotal/year-total.report';

export type PackTotalReport = ReturnType<typeof buildYearTotalReport> & {
    months: Array<ReturnType<typeof buildYearTotalReport>['months'][number] & {year: string}>;
};

type BarChart = {labels: string[]; datasets: Array<{label: string; data: number[]} & Record<string, unknown>>};

export interface PackYearSlice {
    id: string;
    title: string;
    report: ReturnType<typeof buildYearTotalReport>;
    charts: ReturnType<WorkbookService['yearCharts']>;
    trend: ReturnType<WorkbookService['currencyTrendCharts']>;
}

@Injectable({providedIn: 'root'})
export class PackReportService {
    private readonly workbook = inject(WorkbookService);
    private readonly archive = inject(YearArchiveService);
    private busy = false;
    private stamp = '';
    private last: PackYearSlice[] = [];

    collect(): PackYearSlice[] {
        const currency = this.workbook.fx.displayCurrency();
        const stamp = this.archive.years()
            .map((item) => `${item.id}:${(this.archive.csvOf(item.id) || '').length}`)
            .join('|') + `@${currency}`;
        if (this.busy) {
            return this.last;
        }
        if (stamp === this.stamp) {
            return this.last;
        }
        this.busy = true;
        const live = this.workbook.toCsv();
        const view = this.workbook.view();
        const monthTitle = this.workbook.selectedMonth()?.label.title;
        const slices: PackYearSlice[] = [];
        try {
            this.archive.years().forEach((item) => {
                const csv = this.archive.csvOf(item.id);
                if (!csv?.trim()) {
                    return;
                }
                this.workbook.applyCsv(csv);
                slices.push({
                    id: item.id,
                    title: item.name,
                    report: buildYearTotalReport(this.workbook),
                    charts: this.workbook.yearCharts(),
                    trend: this.workbook.currencyTrendCharts()
                });
            });
            slices.sort((a, b) => a.id.localeCompare(b.id, 'de'));
            if (live) {
                this.workbook.applyCsv(live);
                this.restoreView(view, monthTitle);
            }
            this.last = slices;
            this.stamp = stamp;
            return slices;
        } finally {
            this.busy = false;
        }
    }

    mergedReport(): PackTotalReport | null {
        const slices = this.collect();
        if (!slices.length) {
            return null;
        }
        const columns = new Map<string, PackTotalReport['columns'][number]>();
        const persons = new Set<string>();
        const months: PackTotalReport['months'] = [];
        slices.forEach((slice) => {
            slice.report.columns.forEach((col) => {
                if (!columns.has(col.key)) {
                    columns.set(col.key, col);
                }
            });
            slice.report.persons.forEach((person) => persons.add(person));
        });
        const colList = [...columns.values()];
        const personList = [...persons];
        slices.forEach((slice) => {
            slice.report.months.forEach((block) => {
                const byColumn: Record<string, number> = {};
                const byPerson: Record<string, Record<string, number>> = {};
                const personTotal: Record<string, number> = {};
                colList.forEach((col) => {
                    byColumn[col.key] = block.byColumn[col.key] ?? 0;
                });
                personList.forEach((person) => {
                    byPerson[person] = {};
                    colList.forEach((col) => {
                        byPerson[person][col.key] = block.byPerson[person]?.[col.key] ?? 0;
                    });
                    personTotal[person] = block.personTotal[person] ?? 0;
                });
                months.push({
                    ...block,
                    title: `${slice.title} ${block.title}`,
                    year: slice.title,
                    byColumn,
                    byPerson,
                    personTotal
                });
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

    mergedCharts(): {personStack: BarChart; categoryStack: BarChart; incomeExpense: BarChart} | null {
        const slices = this.collect();
        if (!slices.length) {
            return null;
        }
        return {
            personStack: this.concatBars(slices.map((slice) => ({
                title: slice.title,
                chart: slice.charts.personStack as BarChart
            }))),
            categoryStack: this.concatBars(slices.map((slice) => ({
                title: slice.title,
                chart: slice.charts.categoryStack as BarChart
            }))),
            incomeExpense: this.concatBars(slices.map((slice) => ({
                title: slice.title,
                chart: slice.charts.incomeExpense as BarChart
            })))
        };
    }

    mergedTrend(): BarChart | null {
        const slices = this.collect();
        if (!slices.length) {
            return null;
        }
        const merged = this.concatBars(slices.map((slice) => ({
            title: slice.title,
            chart: slice.trend as BarChart
        })));
        return merged.labels.length ? merged : null;
    }

    private concatBars(parts: Array<{title: string; chart: BarChart}>): BarChart {
        const labels: string[] = [];
        const datasets = new Map<string, {label: string; data: number[]} & Record<string, unknown>>();
        parts.forEach((part) => {
            const chart = part.chart || {labels: [], datasets: []};
            const monthLabels = chart.labels || [];
            monthLabels.forEach((label) => labels.push(`${part.title} ${label}`));
            (chart.datasets || []).forEach((dataset) => {
                const key = dataset.label || '';
                if (!datasets.has(key)) {
                    datasets.set(key, {
                        ...dataset,
                        data: Array(labels.length - monthLabels.length).fill(0)
                    });
                }
            });
            datasets.forEach((dataset) => {
                const source = (chart.datasets || []).find((item) => item.label === dataset.label);
                if (source) {
                    dataset.data.push(...(source.data || []));
                } else {
                    dataset.data.push(...monthLabels.map(() => 0));
                }
            });
        });
        return {labels, datasets: [...datasets.values()]};
    }

    private restoreView(view: YearView, monthTitle?: string): void {
        if (monthTitle) {
            const month = this.workbook.months().find((item) => item.label.title === monthTitle);
            if (month) {
                this.workbook.selectMonth(month);
            }
        }
        if (view && view !== 'csv') {
            this.workbook.setView(view);
        }
    }
}
