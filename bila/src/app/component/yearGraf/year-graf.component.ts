import {Component, computed, inject} from '@angular/core';
import {ChartModule} from 'primeng/chart';
import {WorkbookService} from '../../service/workbook.service';
import {CurrencySelectComponent} from '../currencySelect/currency-select.component';
import {splitCurrencyCharts} from './currency-bars';
import {grafChartOptions} from './graf-options';
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
            person: splitCurrencyCharts(base.personStack as {labels: string[]; datasets: Array<{label?: string; data?: number[]} & Record<string, unknown>>}, this.workbook, months),
            category: splitCurrencyCharts(base.categoryStack as {labels: string[]; datasets: Array<{label?: string; data?: number[]} & Record<string, unknown>>}, this.workbook, months),
            incomeExpense: splitCurrencyCharts(base.incomeExpense as {labels: string[]; datasets: Array<{label?: string; data?: number[]} & Record<string, unknown>>}, this.workbook, months)
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

    readonly groupedOptions = grafChartOptions('bar');
    readonly lineOptions = grafChartOptions('line');
}
