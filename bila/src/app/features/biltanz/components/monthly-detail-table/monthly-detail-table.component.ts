import {Component, input} from '@angular/core';
import {formatBudgetCurrency, MonthData} from '../../models/budget.model';

@Component({
    selector: 'bal-monthly-detail-table',
    standalone: true,
    templateUrl: './monthly-detail-table.component.html',
    styleUrl: './monthly-detail-table.component.css'
})
export class MonthlyDetailTableComponent {
    readonly months = input.required<MonthData[] | null>();
    readonly year = input<string | null>(null);
    readonly expenseCategories = input.required<readonly string[]>();
    readonly incomeCategories = input.required<readonly string[]>();

    formatCurrency(value: number | undefined, currency: string = 'CHF'): string {
        return formatBudgetCurrency(value ?? 0, currency);
    }

    isTotal(category: string): boolean {
        return category === 'Total';
    }
}
