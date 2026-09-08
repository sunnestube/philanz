import {Component, input} from '@angular/core';
import {balanceToneClass, currencyAmount, formatBudgetCurrency, MonthData} from '../../models/budget.model';
import {MonthlyBarChartComponent} from '../monthly-bar-chart/monthly-bar-chart.component';

@Component({
    selector: 'bal-monthly-overview',
    standalone: true,
    imports: [MonthlyBarChartComponent],
    templateUrl: './monthly-overview.component.html',
    styleUrl: './monthly-overview.component.css'
})
export class MonthlyOverviewComponent {
    readonly months = input.required<MonthData[] | null>();
    readonly year = input<string | null>(null);

    formatCurrency(value: number): string {
        return formatBudgetCurrency(value);
    }

    getBalanceClass(balance: number): string {
        return balanceToneClass(balance);
    }

    monthIncome(month: MonthData): number {
        return currencyAmount(month.chf.income);
    }

    monthExpenses(month: MonthData): number {
        return currencyAmount(month.chf.expenses);
    }

    monthBalance(month: MonthData): number {
        return this.monthIncome(month) - this.monthExpenses(month);
    }
}
