import {Component, computed, inject} from '@angular/core';
import {ChartModule} from 'primeng/chart';
import {WorkbookService} from '../../service/workbook.service';
import 'chart.js/auto';

@Component({
    selector: 'bal-year-graf',
    standalone: true,
    imports: [ChartModule],
    templateUrl: './year-graf.component.html',
    styleUrl: './year-graf.component.css'
})
export class YearGrafComponent {
    private readonly workbook = inject(WorkbookService);

    readonly charts = computed(() => {
        this.workbook.revision();
        return this.workbook.yearCharts();
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
}
