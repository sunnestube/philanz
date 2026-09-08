import {Component, effect, input, OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {MonthData} from '../../models/budget.model';

@Component({
    selector: 'app-monthly-detail-table',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './monthly-detail-table.component.html',
    styleUrl: './monthly-detail-table.component.css'
})
export class MonthlyDetailTableComponent implements OnInit {
    months = input.required<MonthData[] | null>();
    year = input<string | null>(null);

    expenseCategories = input.required<string[]>();
    incomeCategories = input.required<string[]>();

    constructor() {
        effect(() => console.log('months →', this.months()));
    }

    ngOnInit(): void {
        console.log("months", this.months);
    }

    formatCurrency(value: number, currency: string = "CHF"): string {
        return new Intl.NumberFormat('de-CH', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: currency == "BTC" ? 8 : 2,
            maximumFractionDigits: currency == "BTC" ? 8 : 2
        }).format(value);
    }

}
