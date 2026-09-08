import {Component, inject} from '@angular/core';
import {BudgetDataService} from '../../services/budget-data.service';
import {BudgetCsvService} from '../../services/budget-csv.service';
import {BudgetHeaderComponent} from '../../components/budget-header/budget-header.component';
import {SummaryCardsComponent} from '../../components/summary-cards/summary-cards.component';
import {MonthlyOverviewComponent} from '../../components/monthly-overview/monthly-overview.component';
import {EmptyStateComponent} from '../../components/empty-state/empty-state.component';
import {MonthlyDetailTableComponent} from '../../components/monthly-detail-table/monthly-detail-table.component';
import {YearlyComparisonChartComponent} from '../../components/yearly-comparison-chart/yearly-comparison-chart.component';
import {EXPENSE_CATEGORIES, INCOME_CATEGORIES} from '../../constants/budget-categories';

@Component({
    selector: 'bal-biltanz-page',
    standalone: true,
    imports: [
        BudgetHeaderComponent,
        SummaryCardsComponent,
        MonthlyOverviewComponent,
        EmptyStateComponent,
        MonthlyDetailTableComponent,
        YearlyComparisonChartComponent
    ],
    templateUrl: './biltanz-page.component.html',
    styleUrl: './biltanz-page.component.css'
})
export class BiltanzPageComponent {
    private readonly budgetDataService = inject(BudgetDataService);
    private readonly budgetCsvService = inject(BudgetCsvService);

    readonly availableYears = this.budgetDataService.availableYears;
    readonly currentYearData = this.budgetDataService.currentYearData;
    readonly yearlyTotals = this.budgetDataService.yearlyTotals;
    readonly error = this.budgetDataService.error;
    readonly selectedYear = this.budgetDataService.selectedYear;

    readonly expenseCategories = EXPENSE_CATEGORIES;
    readonly incomeCategories = INCOME_CATEGORIES;

    selectYear(year: string): void {
        this.budgetDataService.setSelectedYear(year);
    }

    handleFileSelected(file: File): void {
        const year = this.budgetCsvService.yearFromFileName(file.name);
        if (!year) {
            this.budgetDataService.setError(
                'Dateiname muss ein Jahr enthalten (z.B. 2026.csv)'
            );
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            try {
                const text = String(reader.result ?? '');
                const months = this.budgetCsvService.parse(text);
                this.budgetDataService.setYearData(year, months);
                this.budgetDataService.clearError();
            } catch {
                this.budgetDataService.setError('Fehler beim Verarbeiten der CSV-Datei');
            }
        };
        reader.onerror = () => {
            this.budgetDataService.setError('Fehler beim Lesen der Datei');
        };
        reader.readAsText(file);
    }
}
