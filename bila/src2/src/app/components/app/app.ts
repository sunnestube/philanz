import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BudgetDataService } from '../../services/budget-data.service';
import { BudgetHeaderComponent } from '../budget-header/budget-header.component';
import { SummaryCardsComponent } from '../summary-cards/summary-cards.component';
import { MonthlyOverviewComponent } from '../monthly-overview/monthly-overview.component';
import { EmptyStateComponent } from '../empty-state/empty-state.component';
import * as Papa from 'papaparse';
import { MonthData } from '../../models/budget.model';
import {MonthlyDetailTableComponent} from '../monthly-detail-table/monthly-detail-table.component';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [
        CommonModule,
        BudgetHeaderComponent,
        SummaryCardsComponent,
        MonthlyOverviewComponent,
        EmptyStateComponent,
        MonthlyDetailTableComponent,
    ],
    templateUrl: './app.html',
    styleUrl: './app.css'
})
export class App {
    private budgetService = inject(BudgetDataService);

    availableYears = this.budgetService.availableYears;
    currentYearData = this.budgetService.currentYearData;
    yearlyTotals = this.budgetService.yearlyTotals;
    error = this.budgetService.error;
    selectedYear = this.budgetService.selectedYear;

    readonly expenseCategories = [
        'Ausgang', 'ausw. Verpflegung', 'Freizeit\nFerien', 'Lebensmittel',
        'Haushaltsartikel', 'Kleider, Schuhe', 'Körperpflege', 'Coiffeur',
        'Arzt, Zahnarzt, \nOptiker', 'Möbel', 'Computer', 'Mobilität',
        'Auto', 'Geschenke', 'Verschiedenes', 'Telefon, Internet',
        'Kita, ElKi, Spielgruppe', 'Steuern, Gebühren\nAHV',
        'Krankenkasse &\nVersicherungen', 'Hypothekarzins & \nDarlehen',
        'Nebenkosten', 'zusätzliche \nWohnungskosten', 'Krypto', 'Debitoren', 'Total'
    ];

    readonly incomeCategories = ['Lohn', 'Krankenkasse', 'Andere', 'Debitoren', 'Total'];

    selectYear(year: string){
        this.selectedYear.set(year);
    }

    handleFileSelected(file: File): void {
        const yearMatch = file.name.match(/(\d{4})/);
        if (!yearMatch) {
            this.budgetService.setError('Dateiname muss ein Jahr enthalten (z.B. 2026.csv)');
            return;
        }

        const year = yearMatch[1];

        Papa.parse(file, {
            header: false,
            skipEmptyLines: true,
            delimiter: ';',
            complete: (results: Papa.ParseResult<unknown>) => {
                try {
                    const months = this.parseCsvRows(results.data as string[][]);
                    this.budgetService.setYearData(year, months);
                    this.budgetService.clearError();
                } catch (err) {
                    console.error('CSV parsing error:', err);
                    this.budgetService.setError('Fehler beim Verarbeiten der CSV-Datei');
                }
            },
            error: (err) => {
                console.error('PapaParse error:', err);
                this.budgetService.setError('Fehler beim Lesen der Datei');
            }
        });
    }

    private parseCsvRows(data: string[][]): MonthData[] {
        const months: MonthData[] = [];



        for (let i = 2; i < data.length; i++) {
            const row = data[i];
            if (!row?.[1]) continue;

            const monthData: MonthData = {
                zeile: row[0] ?? '',
                monat: row[1],
                chf: {
                    expenses: {},
                    income: {}
                },
                btc: {
                    expenses: {},
                    income: {}
                }
            };

            const startBtcExpense = 2;
            const startBtcIncome = startBtcExpense + this.expenseCategories.length;
            const startChfExpense = this.expenseCategories.length + this.incomeCategories.length + 5;
            const startChfIncome = startChfExpense + this.expenseCategories.length;

            this.expenseCategories.forEach((cat, idx) => {
                let rowIndex = startBtcExpense + idx;
                console.log("csv_fore", rowIndex, row[rowIndex]);
                monthData.btc.expenses[cat] = Number(row[rowIndex]) || 0;
            });

            this.incomeCategories.forEach((cat, idx) => {
                let rowIndex = startBtcIncome + idx;
                console.log("csv_fore2", rowIndex, row[rowIndex]);
                monthData.btc.income[cat] = Number(row[rowIndex]) || 0;
            });

            this.expenseCategories.forEach((cat, idx) => {
                let rowIndex = startChfExpense + idx
                console.log("csv_fore3", rowIndex, row[rowIndex]);
                monthData.chf.expenses[cat] = Number(row[rowIndex]) || 0;
            });

            this.incomeCategories.forEach((cat, idx) => {
                let rowIndex = startChfIncome + idx
                console.log("csv_fore4", rowIndex, row[rowIndex]);
                monthData.chf.income[cat] = Number(row[rowIndex]) || 0;
            });
            months.push(monthData);
        }

        return months;
    }

}
