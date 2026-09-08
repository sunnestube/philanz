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

export const TOTAL_CATEGORY = 'Total';

export function currencyAmount(bucket: Record<string, number>): number {
    if (TOTAL_CATEGORY in bucket) {
        return Number(bucket[TOTAL_CATEGORY]) || 0;
    }

    return Object.values(bucket).reduce(
        (sum, value) => sum + (Number(value) || 0),
        0
    );
}

export function formatBudgetCurrency(value: number, currency: string = 'CHF'): string {
    const isBtc = currency === 'BTC';
    if (isBtc) {
        return `${value.toLocaleString('de-CH', {
            minimumFractionDigits: 8,
            maximumFractionDigits: 8
        })} BTC`;
    }

    return new Intl.NumberFormat('de-CH', {
        style: 'currency',
        currency: 'CHF'
    }).format(value);
}

export function balanceToneClass(balance: number): string {
    return balance >= 0 ? 'text-green-600' : 'text-red-600';
}
