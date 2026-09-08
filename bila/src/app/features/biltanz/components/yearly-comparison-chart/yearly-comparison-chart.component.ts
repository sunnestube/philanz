import {Component, computed, input} from '@angular/core';
import {ChartModule} from 'primeng/chart';
import {currencyAmount, MonthData} from '../../models/budget.model';
import 'chart.js/auto';

@Component({
    selector: 'bal-yearly-comparison-chart',
    standalone: true,
    imports: [ChartModule],
    templateUrl: './yearly-comparison-chart.component.html',
    styleUrl: './yearly-comparison-chart.component.css'
})
export class YearlyComparisonChartComponent {
    readonly months = input.required<MonthData[]>();

    readonly chartData = computed(() => {
        const months = this.months() ?? [];

        return {
            labels: months.map((month) => month.monat),
            datasets: [
                {
                    label: 'Einnahmen CHF',
                    backgroundColor: 'rgba(34, 197, 94, 0.6)',
                    data: months.map((month) => currencyAmount(month.chf.income))
                },
                {
                    label: 'Ausgaben CHF',
                    backgroundColor: 'rgba(239, 68, 68, 0.6)',
                    data: months.map((month) => Math.abs(currencyAmount(month.chf.expenses)))
                },
                {
                    label: 'Einnahmen BTC',
                    backgroundColor: 'rgba(59, 130, 246, 0.6)',
                    data: months.map((month) => currencyAmount(month.btc.income))
                },
                {
                    label: 'Ausgaben BTC',
                    backgroundColor: 'rgba(249, 115, 22, 0.6)',
                    data: months.map((month) => Math.abs(currencyAmount(month.btc.expenses)))
                }
            ]
        };
    });

    readonly chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top'
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    callback: (value: string | number) => Number(value).toLocaleString('de-CH')
                }
            }
        }
    };
}
