import {Component, input, computed} from '@angular/core';
import {ChartModule} from 'primeng/chart';
import {CardModule} from 'primeng/card';
import {MonthData} from '../../models/budget.model';

@Component({
    selector: 'app-monthly-bar-chart',
    standalone: true,
    imports: [ChartModule, CardModule],
    templateUrl: './yearly-comparison-chart.component.html',
    styleUrl: './yearly-comparison-chart.component.css'
})
export class YearlyComparisonChartComponent {
    months = input.required<MonthData[]>();

    chartData = computed(() => {
        const months = this.months() ?? [];
        return {
            labels: months.map(m => m.monat),
            datasets: [
                {
                    label: 'Einnahmen CHF',
                    backgroundColor: 'rgba(34, 197, 94, 0.6)',
                    data: months.map(m => m.chf?.income[26] ?? 0)
                },
                {
                    label: 'Ausgaben CHF',
                    backgroundColor: 'rgba(239, 68, 68, 0.6)',
                    data: months.map(m => Math.abs(m.chf?.expenses[26] ?? 0))
                },
                {
                    label: 'Einnahmen BTC',
                    backgroundColor: 'rgba(59, 130, 246, 0.6)',
                    data: months.map(m => m.btc?.income[26] ?? 0)
                },
                {
                    label: 'Ausgaben BTC',
                    backgroundColor: 'rgba(249, 115, 22, 0.6)',
                    data: months.map(m => Math.abs(m.btc?.expenses[26] ?? 0))
                }
            ]
        };
    });
}
