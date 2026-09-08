import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MonthData } from '../../models/budget.model';
import {MonthlyBarChartComponent} from '../monthly-bar-chart/monthly-bar-chart.component';

@Component({
    selector: 'app-monthly-overview',
    standalone: true,
    imports: [CommonModule, MonthlyBarChartComponent],
    templateUrl: './monthly-overview.component.html',
    styleUrl: './monthly-overview.component.css'
})
export class MonthlyOverviewComponent {
    months = input.required<MonthData[] | null>();
    year = input<string | null>(null);

    formatCurrency(value: number): string {
        return new Intl.NumberFormat('de-CH', {
            style: 'currency',
            currency: 'CHF'
        }).format(value);
    }

    getBalanceClass(balance: number): string {
        return balance >= 0 ? 'text-green-600' : 'text-red-600';
    }
}
