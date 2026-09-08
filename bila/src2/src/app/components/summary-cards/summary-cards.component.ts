import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { YearlyTotals } from '../../models/budget.model';

@Component({
    selector: 'app-summary-cards',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './summary-cards.component.html',
    styleUrl: './summary-cards.component.css'
})
export class SummaryCardsComponent {
    yearlyTotals = input.required<YearlyTotals>();

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
