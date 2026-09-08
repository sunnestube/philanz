export interface MonthDataCurrency {
    expenses: Record<string, number>;
    income: Record<string, number>;
}
export interface MonthData {
    zeile: string;
    monat: string;
    chf: MonthDataCurrency;
    btc: MonthDataCurrency;
}

export interface YearlyTotals {
    expenses: number;
    income: number;
    balance: number;
}

export type YearsData = Record<string, MonthData[]>;
