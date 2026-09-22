import {Component, computed, inject} from '@angular/core';
import {ChartModule} from 'primeng/chart';
import {WorkbookService} from '../../service/workbook.service';
import {CurrencySelectComponent} from '../currencySelect/currency-select.component';
import {dualCurrencyChartScales} from '../../model/CurrencyFx';
import {withCurrencyBars} from './currency-bars';
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
        const months = this.workbook.months().map((month) => month.label.title);
        return {
            personStack: withCurrencyBars(base.personStack as {labels: string[]; datasets: Array<{label?: string; data?: number[]} & Record<string, unknown>>}, this.workbook, months),
            categoryStack: withCurrencyBars(base.categoryStack as {labels: string[]; datasets: Array<{label?: string; data?: number[]} & Record<string, unknown>>}, this.workbook, months),
            incomeExpense: withCurrencyBars(base.incomeExpense as {labels: string[]; datasets: Array<{label?: string; data?: number[]} & Record<string, unknown>>}, this.workbook, months)
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
