import { Injectable, signal, computed } from '@angular/core';
import { MonthData, YearlyTotals, YearsData } from '../models/budget.model';

@Injectable({
    providedIn: 'root'
})
export class BudgetDataService {
    private years = signal<YearsData>({});
    selectedYear = signal<string | null>(null);
    error = signal<string | null>(null);

    readonly availableYears = computed(() =>
        Object.keys(this.years()).sort((a, b) => Number(b) - Number(a))
    );

    readonly currentYearData = computed(() => {
        const year = this.selectedYear();
        return year ? this.years()[year] ?? null : null;
    });

    readonly yearlyTotals = computed((): YearlyTotals => {
        const data = this.currentYearData();
        if (!data) return { expenses: 0, income: 0, balance: 0 };

        const totals = data.reduce(
            (acc, month) => ({
                expenses: acc.expenses,
                income: acc.income
            }),
            { expenses: 0, income: 0 }
        );

        return {
            ...totals,
            balance: totals.income - totals.expenses
        };
    });

    setYearData(year: string, months: MonthData[]): void {
        this.years.update(current => ({
            ...current,
            [year]: months
        }));

        // Automatisch auswählen, wenn noch nichts ausgewählt ist
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
