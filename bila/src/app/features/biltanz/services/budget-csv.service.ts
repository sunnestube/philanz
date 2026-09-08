import {Injectable} from '@angular/core';
import {MonthData} from '../models/budget.model';
import {EXPENSE_CATEGORIES, INCOME_CATEGORIES} from '../constants/budget-categories';

@Injectable({
    providedIn: 'root'
})
export class BudgetCsvService {
    parse(text: string): MonthData[] {
        const rows = this.parseDelimited(text, ';');
        const months: MonthData[] = [];

        for (let i = 2; i < rows.length; i++) {
            const row = rows[i];
            if (!row?.[1]) {
                continue;
            }

            const monthData: MonthData = {
                zeile: row[0] ?? '',
                monat: row[1],
                chf: {expenses: {}, income: {}},
                btc: {expenses: {}, income: {}}
            };

            const startBtcExpense = 2;
            const startBtcIncome = startBtcExpense + EXPENSE_CATEGORIES.length;
            const startChfExpense = EXPENSE_CATEGORIES.length + INCOME_CATEGORIES.length + 5;
            const startChfIncome = startChfExpense + EXPENSE_CATEGORIES.length;

            EXPENSE_CATEGORIES.forEach((category, index) => {
                monthData.btc.expenses[category] = this.toNumber(row[startBtcExpense + index]);
                monthData.chf.expenses[category] = this.toNumber(row[startChfExpense + index]);
            });

            INCOME_CATEGORIES.forEach((category, index) => {
                monthData.btc.income[category] = this.toNumber(row[startBtcIncome + index]);
                monthData.chf.income[category] = this.toNumber(row[startChfIncome + index]);
            });

            months.push(monthData);
        }

        return months;
    }

    yearFromFileName(fileName: string): string | null {
        const match = fileName.match(/(\d{4})/);
        return match ? match[1] : null;
    }

    private toNumber(value: string | undefined): number {
        if (!value) {
            return 0;
        }
        const normalized = value.replace(/\s/g, '').replace(',', '.');
        return Number(normalized) || 0;
    }

    private parseDelimited(text: string, delimiter: string): string[][] {
        const rows: string[][] = [];
        let row: string[] = [];
        let field = '';
        let inQuotes = false;

        const source = text.replace(/^\uFEFF/, '');

        for (let i = 0; i < source.length; i++) {
            const char = source[i];
            const next = source[i + 1];

            if (char === '"') {
                if (inQuotes && next === '"') {
                    field += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
                continue;
            }

            if (char === delimiter && !inQuotes) {
                row.push(field);
                field = '';
                continue;
            }

            if ((char === '\n' || char === '\r') && !inQuotes) {
                if (char === '\r' && next === '\n') {
                    i++;
                }
                row.push(field);
                if (row.some((cell) => cell.length > 0)) {
                    rows.push(row);
                }
                row = [];
                field = '';
                continue;
            }

            field += char;
        }

        row.push(field);
        if (row.some((cell) => cell.length > 0)) {
            rows.push(row);
        }

        return rows;
    }
}
