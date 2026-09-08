import {computed, Injectable, signal} from '@angular/core';
import {
    currencyAmount,
    MonthData,
    YearlyTotals,
    YearsData
} from '../models/budget.model';

@Injectable({
    providedIn: 'root'
})
export class BudgetDataService {
    private readonly years = signal<YearsData>({});

    readonly selectedYear = signal<string | null>(null);
    readonly error = signal<string | null>(null);

    readonly availableYears = computed(() =>
        Object.keys(this.years()).sort((a, b) => Number(b) - Number(a))
    );

    readonly currentYearData = computed(() => {
        const year = this.selectedYear();
        return year ? this.years()[year] ?? null : null;
    });

    readonly yearlyTotals = computed((): YearlyTotals => {
        const data = this.currentYearData();
        if (!data) {
            return {expenses: 0, income: 0, balance: 0};
        }

        const expenses = data.reduce(
            (sum, month) => sum + currencyAmount(month.chf.expenses),
            0
        );
        const income = data.reduce(
            (sum, month) => sum + currencyAmount(month.chf.income),
            0
        );

        return {
            expenses,
            income,
            balance: income - expenses
        };
    });

    setYearData(year: string, months: MonthData[]): void {
        this.years.update((current) => ({
            ...current,
            [year]: months
        }));

        if (!this.selectedYear()) {
            this.selectedYear.set(year);
        }
    }

    setSelectedYear(year: string): void {
        this.selectedYear.set(year);
    }

    setError(message: string | null): void {
        this.error.set(message);
    }

    clearError(): void {
        this.error.set(null);
    }
}
