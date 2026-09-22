import {Component, computed, effect, inject, untracked} from '@angular/core';
import {ChartModule} from 'primeng/chart';
import {CurrencySelectComponent} from '../currencySelect/currency-select.component';
import {WorkbookService} from '../../service/workbook.service';
import {YearArchiveService} from '../../service/year-archive.service';
import {PackReportService} from '../../service/pack-report.service';
import {dualCurrencyChartScales} from '../../model/CurrencyFx';
import {withCurrencyBars} from '../yearGraf/currency-bars';
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
        const monthTitles = (base.incomeExpense.labels || []).map((label) => {
            const parts = String(label).split(' ');
            return parts.slice(1).join(' ') || String(label);
        });
        return {
            personStack: withCurrencyBars(base.personStack, this.workbook, monthTitles),
            categoryStack: withCurrencyBars(base.categoryStack, this.workbook, monthTitles),
            incomeExpense: withCurrencyBars(base.incomeExpense, this.workbook, monthTitles)
        };
    });

    readonly fxTrend = computed(() => {
        this.workbook.fx.displayCurrency();
        return this.pack.trend();
    });

    error() {
        return this.pack.error();
    }

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
