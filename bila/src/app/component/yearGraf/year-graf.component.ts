import {Component, computed, inject} from '@angular/core';
import {ChartModule} from 'primeng/chart';
import {WorkbookService} from '../../service/workbook.service';
import {CurrencySelectComponent} from '../currencySelect/currency-select.component';
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
        return this.workbook.yearCharts();
    });

    readonly fxTrend = computed(() => {
        this.workbook.revision();
        return this.workbook.currencyTrendCharts();
    });

    readonly displayCode = computed(() => {
        this.workbook.revision();
        return this.workbook.fx.displayCurrency();
    });

    readonly options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {labels: {color: '#111', boxWidth: 12}}
        },
        scales: {
            x: {stacked: true, ticks: {color: '#111'}, grid: {color: '#d4d4d8'}},
            y: {
                stacked: true,
                ticks: {
                    color: '#111',
                    callback: (value: string | number) => Number(value).toLocaleString('de-CH')
                },
                grid: {color: '#d4d4d8'}
            }
        }
    };

    readonly groupedOptions = {
        ...this.options,
        scales: {
            x: {stacked: false, ticks: {color: '#111'}, grid: {color: '#d4d4d8'}},
            y: {
                stacked: false,
                ticks: {
                    color: '#111',
                    callback: (value: string | number) => Number(value).toLocaleString('de-CH')
                },
                grid: {color: '#d4d4d8'}
            }
        }
    };

    readonly lineOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {labels: {color: '#111', boxWidth: 12}}
        },
        scales: {
            x: {ticks: {color: '#111'}, grid: {color: '#d4d4d8'}},
            y: {
                ticks: {
                    color: '#111',
                    callback: (value: string | number) => Number(value).toLocaleString('de-CH')
                },
                grid: {color: '#d4d4d8'}
            }
        }
    };
}
