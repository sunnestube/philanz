import {Component, computed, inject} from '@angular/core';
import {ChartModule} from 'primeng/chart';
import {CurrencySelectComponent} from '../currencySelect/currency-select.component';
import {WorkbookService} from '../../service/workbook.service';
import {PackReportService} from '../../service/pack-report.service';
import {BASE_CURRENCY, dualCurrencyChartScales} from '../../model/CurrencyFx';
import 'chart.js/auto';

@Component({
    selector: 'bal-pack-graf',
    standalone: true,
    imports: [ChartModule, CurrencySelectComponent],
    templateUrl: './pack-graf.component.html',
    styleUrl: '../yearGraf/year-graf.component.css',
    styles: [':host { padding: 12px; box-sizing: border-box; display: block; overflow: auto; }']
})
export class PackGrafComponent {
    private readonly pack = inject(PackReportService);
    readonly workbook = inject(WorkbookService);

    readonly displayCode = computed(() => this.workbook.fx.displayCurrency());

    readonly charts = computed(() => {
        this.workbook.fx.displayCurrency();
        const base = this.pack.mergedCharts();
        const trend = this.pack.mergedTrend();
        if (!base) {
            return null;
        }
        if (!trend || trend.datasets.length < 2) {
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
            personStack: mix(base.personStack),
            categoryStack: mix(base.categoryStack),
            incomeExpense: mix(base.incomeExpense)
        };
    });

    readonly fxTrend = computed(() => {
        this.workbook.fx.displayCurrency();
        return this.pack.mergedTrend();
    });

    readonly dualBarCharts = computed(() => {
        const code = this.workbook.fx.displayCurrency();
        const trend = this.pack.mergedTrend();
        if (!trend || code === BASE_CURRENCY) {
            return null;
        }
        const chf = trend.datasets.find((item) => item.label.includes(BASE_CURRENCY));
        const fx = trend.datasets.find((item) => item.label.includes(code));
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
        plugins: {legend: {labels: {color: '#111', boxWidth: 12}}},
        scales: dualCurrencyChartScales({stacked: true})
    };
    readonly groupedOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {legend: {labels: {color: '#111', boxWidth: 12}}},
        scales: dualCurrencyChartScales({stacked: false})
    };
    readonly lineOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {legend: {labels: {color: '#111', boxWidth: 12}}},
        scales: dualCurrencyChartScales({stacked: false})
    };
}
