import {Component, computed, input} from '@angular/core';
import {ChartModule} from 'primeng/chart';
import {currencyAmount, MonthData} from '../../models/budget.model';
import 'chart.js/auto';

@Component({
    selector: 'bal-monthly-bar-chart',
    standalone: true,
    imports: [ChartModule],
    templateUrl: './monthly-bar-chart.component.html',
    styleUrl: './monthly-bar-chart.component.css'
})
export class MonthlyBarChartComponent {
    readonly month = input.required<MonthData>();

    readonly chartData = computed(() => {
        const month = this.month();

        return {
            labels: ['CHF', 'BTC'],
            datasets: [
                {
                    label: 'Einnahmen',
                    backgroundColor: 'rgba(34, 197, 94, 0.7)',
                    borderColor: 'rgb(34, 197, 94)',
                    borderWidth: 1,
                    data: [
                        currencyAmount(month.chf.income),
                        currencyAmount(month.btc.income)
                    ]
                },
                {
                    label: 'Ausgaben',
                    backgroundColor: 'rgba(239, 68, 68, 0.7)',
                    borderColor: 'rgb(239, 68, 68)',
                    borderWidth: 1,
                    data: [
                        Math.abs(currencyAmount(month.chf.expenses)),
                        Math.abs(currencyAmount(month.btc.expenses))
                    ]
                }
            ]
        };
    });

    readonly chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top',
                labels: {font: {size: 14}}
            },
            tooltip: {
                callbacks: {
                    label: (context: {dataset: {label?: string}; parsed: {y: number}; dataIndex: number}) => {
                        const name = context.dataset.label ?? '';
                        const prefix = name ? `${name}: ` : '';
                        const value = context.parsed.y;
                        if (context.dataIndex === 0) {
                            return `${prefix}${value.toLocaleString('de-CH')} CHF`;
                        }
                        return `${prefix}${value.toFixed(8)} BTC`;
                    }
                }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    callback: (value: string | number) => Number(value).toLocaleString('de-CH')
                },
                title: {
                    display: true,
                    text: 'Betrag'
                }
            },
            x: {
                title: {
                    display: true,
                    text: 'Währung'
                }
            }
        }
    };
}
