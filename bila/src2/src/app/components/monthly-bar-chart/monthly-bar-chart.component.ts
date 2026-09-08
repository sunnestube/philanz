import { Component, input, computed } from '@angular/core';
import { ChartModule } from 'primeng/chart';
import { CardModule } from 'primeng/card';
import {MonthData} from '../../models/budget.model';

@Component({
    selector: 'app-monthly-bar-chart',
    standalone: true,
    imports: [ChartModule, CardModule],
    templateUrl: './monthly-bar-chart.component.html',
    styleUrl: './monthly-bar-chart.component.css'
})
export class MonthlyBarChartComponent {
    month = input.required<MonthData>();

    chartData = computed(() => {
        const m = this.month();

        console.log("chartData", m);

        return {
            labels: ['CHF', 'BTC'],
            datasets: [
                {
                    label: 'Einnahmen',
                    backgroundColor: 'rgba(34, 197, 94, 0.7)',  // green-500
                    borderColor: 'rgb(34, 197, 94)',
                    borderWidth: 1,
                    data: [m.chf.income, m.btc.income]
                },
                {
                    label: 'Ausgaben',
                    backgroundColor: 'rgba(239, 68, 68, 0.7)',  // red-500
                    borderColor: 'rgb(239, 68, 68)',
                    borderWidth: 1,
                    data: [Math.abs(m.chf.expenses[26]), Math.abs(m.btc.expenses[26])]
                }
            ]
        };
    });


    chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top',
                labels: { font: { size: 14 } }
            },
            tooltip: {
                callbacks: {
                    label: (context: any) => {
                        let label = context.dataset.label || '';
                        if (label) label += ': ';
                        const value = context.parsed.y;
                        if (context.dataIndex === 0) {
                            return `${label}${value.toLocaleString('de-CH')} CHF`;
                        }
                        return `${label}${value.toFixed(6)} BTC`;
                    }
                }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    callback: (value: number) => value.toLocaleString('de-CH')
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
