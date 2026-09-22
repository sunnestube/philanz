import {Component, computed, effect, inject, untracked} from '@angular/core';
import {ChartModule} from 'primeng/chart';
import {CurrencySelectComponent} from '../currencySelect/currency-select.component';
import {WorkbookService} from '../../service/workbook.service';
import {YearArchiveService} from '../../service/year-archive.service';
import {PackReportService} from '../../service/pack-report.service';
import {splitCurrencyCharts} from '../yearGraf/currency-bars';
import {grafChartOptions} from '../yearGraf/graf-options';
import 'chart.js/auto';

@Component({
    selector: 'bal-pack-graf',
    standalone: true,
    imports: [ChartModule, CurrencySelectComponent],
    templateUrl: './pack-graf.component.html',
    styleUrl: '../yearGraf/year-graf.component.css',
    styles: [`
        :host {
            display: block;
            padding: 12px;
            box-sizing: border-box;
            overflow: auto;
            min-height: 100%;
        }
    `]
})
export class PackGrafComponent {
    private readonly pack = inject(PackReportService);
    readonly workbook = inject(WorkbookService);
    private readonly archive = inject(YearArchiveService);

    constructor() {
        effect(() => {
            this.workbook.fx.displayCurrency();
            this.archive.years();
            untracked(() => this.pack.refresh());
        });
    }

    readonly displayCode = computed(() => this.workbook.fx.displayCurrency());

    readonly charts = computed(() => {
        this.workbook.fx.displayCurrency();
        const base = this.pack.charts();
        if (!base) {
            return null;
        }
        const months = base.incomeExpense.labels || [];
        return {
            person: splitCurrencyCharts(base.personStack, this.workbook, months),
            category: splitCurrencyCharts(base.categoryStack, this.workbook, months),
            incomeExpense: splitCurrencyCharts(base.incomeExpense, this.workbook, months)
        };
    });

    readonly fxTrend = computed(() => {
        this.workbook.fx.displayCurrency();
        return this.pack.trend();
    });

    readonly yoy = computed(() => {
        this.workbook.fx.displayCurrency();
        return this.pack.yoy();
    });

    error() {
        return this.pack.error();
    }

    readonly groupedOptions = grafChartOptions('bar');
    readonly lineOptions = grafChartOptions('line');
}
