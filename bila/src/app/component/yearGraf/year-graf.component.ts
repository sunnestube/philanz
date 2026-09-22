import {Component, computed, inject} from '@angular/core';
import {ChartModule} from 'primeng/chart';
import {WorkbookService} from '../../service/workbook.service';
import {CurrencySelectComponent} from '../currencySelect/currency-select.component';
import {BASE_CURRENCY, dualCurrencyChartScales} from '../../model/CurrencyFx';
import 'chart.js/auto';

@Component({
    selector: 'bal-year-graf',
    standalone: true,
    imports: [ChartModule, CurrencySelectComponent],
    templateUrl: './year-graf.component.html',
    styleUrl: './year-graf.component.css'
})
export class YearGrafComponent {
    private readonly workbook = inject(WorkbookService);

    readonly charts = computed(() => {
        this.workbook.revision();
        const base = this.workbook.yearCharts();
        const trend = this.workbook.currencyTrendCharts();
        if (trend.datasets.length < 2) {
            return base;
        }
        const overlay = trend.datasets.map((item) => ({
            ...item,
            type: 'line' as const,
            fill: false,
            order: 20
        }));
        const mix = (chart: {labels: string[]; datasets: object[]}) => ({
            labels: chart.labels,
            datasets: [
                ...chart.datasets.map((dataset) => ({...dataset, yAxisID: 'y', order: 1})),
                ...overlay
            ]
        });
        return {
            personStack: mix(base.personStack as {labels: string[]; datasets: object[]}),
            categoryStack: mix(base.categoryStack as {labels: string[]; datasets: object[]}),
            incomeExpense: mix(base.incomeExpense as {labels: string[]; datasets: object[]})
        };
    });

    readonly fxTrend = computed(() => {
        this.workbook.revision();
        return this.workbook.currencyTrendCharts();
    });

    readonly displayCode = computed(() => {
        this.workbook.revision();
        return this.workbook.fx.displayCurrency();
    });

    /** Upper bar charts: dual Y when display currency ≠ CHF (CHF left, FX right). */
    readonly dualBarCharts = computed(() => {
        this.workbook.revision();
        const code = this.workbook.fx.displayCurrency();
        const base = this.workbook.yearCharts();
        if (code === BASE_CURRENCY || !this.workbook.fx.currencies().length) {
            return null;
        }
        const trend = this.workbook.currencyTrendCharts();
        const chf = trend.datasets.find((d) => d.yAxisID === 'y' || d.label.includes(BASE_CURRENCY));
        const fx = trend.datasets.find((d) => d.label.includes(code));
        if (!chf || !fx) {
            return null;
        }
        return {
            labels: trend.labels,
            datasets: [
                {...chf, type: 'line', yAxisID: 'y', tension: 0.25},
                {...fx, type: 'line', yAxisID: 'y1', tension: 0.25}
            ]
        };
    });

    readonly options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {labels: {color: '#111', boxWidth: 12}}
        },
        scales: dualCurrencyChartScales({stacked: true})
    };

    readonly groupedOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {labels: {color: '#111', boxWidth: 12}}
        },
        scales: dualCurrencyChartScales({stacked: false})
    };

    readonly lineOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {labels: {color: '#111', boxWidth: 12}},
            tooltip: {
                callbacks: {
                    label: (ctx: {dataset: {label?: string}; parsed: {y: number | null}}) => {
                        const label = ctx.dataset.label ?? '';
                        const raw = ctx.parsed.y;
                        if (raw == null || !Number.isFinite(raw)) {
                            return label;
                        }
                        const code = label.replace(/^Ausgaben\s+/, '');
                        const formatted = this.workbook.fx.formatAmount(raw, code || BASE_CURRENCY);
                        return `${label}: ${formatted}`;
                    }
                }
            }
        },
        scales: dualCurrencyChartScales({stacked: false})
    };
}
