import {Component, input} from '@angular/core';
import {balanceToneClass, formatBudgetCurrency, YearlyTotals} from '../../models/budget.model';

@Component({
    selector: 'bal-summary-cards',
    standalone: true,
    templateUrl: './summary-cards.component.html',
    styleUrl: './summary-cards.component.css'
})
export class SummaryCardsComponent {
    readonly yearlyTotals = input.required<YearlyTotals>();

    formatCurrency(value: number): string {
        return formatBudgetCurrency(value);
    }

    getBalanceClass(balance: number): string {
        return balanceToneClass(balance);
    }
}
