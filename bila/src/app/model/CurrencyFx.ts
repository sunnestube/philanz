/** One foreign currency with daily rates expressed as CHF per 1 unit of that currency. */
export interface CurrencySeries {
    code: string;
    /** Optional display label (e.g. "Euro"). */
    name: string;
    /**
     * Sparse daily rates indexed by day-of-year (0 = 1 Jan … length-1 = 31 Dec).
     * Empty / non-finite entries mean “unknown” and are fill-forwarded.
     */
    rates: Array<number | null>;
}

export const BASE_CURRENCY = 'CHF';

/** Days in calendar year (leap → 366). */
export function daysInYear(year: number): number {
    return isLeapYear(year) ? 366 : 365;
}

export function isLeapYear(year: number): boolean {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Day-of-year index 0..N-1 from month (1–12) and day-of-month.
 * Clamps invalid days to the last valid day of that month.
 */
export function dayOfYearIndex(year: number, month1to12: number, dayOfMonth: number): number {
    const month = Math.min(12, Math.max(1, Math.floor(month1to12) || 1));
    const dim = daysInMonth(year, month);
    const day = Math.min(dim, Math.max(1, Math.floor(dayOfMonth) || 1));
    let doy = day - 1;
    for (let m = 1; m < month; m++) {
        doy += daysInMonth(year, m);
    }
    return doy;
}

export function daysInMonth(year: number, month1to12: number): number {
    return new Date(year, month1to12, 0).getDate();
}

/**
 * Fill-forward: walk backward from `dayIndex` for the last finite positive rate.
 * If none exists anywhere, returns 1 (treat as CHF / 1:1).
 */
export function fillForwardRate(rates: Array<number | null | undefined>, dayIndex: number): number {
    if (!rates?.length) {
        return 1;
    }
    const start = Math.min(Math.max(0, Math.floor(dayIndex)), rates.length - 1);
    for (let i = start; i >= 0; i--) {
        const value = rates[i];
        if (value != null && Number.isFinite(value) && value > 0) {
            return value;
        }
    }
    for (let i = start + 1; i < rates.length; i++) {
        const value = rates[i];
        if (value != null && Number.isFinite(value) && value > 0) {
            return value;
        }
    }
    return 1;
}

/**
 * Convert a CHF amount into foreign currency.
 * Rate is CHF per 1 foreign unit → amountFx = amountChf / rate.
 * Rate ≤ 0 or missing → treated as 1 (no conversion).
 */
export function chfToFx(amountChf: number, rateToChf: number): number {
    const rate = rateToChf > 0 && Number.isFinite(rateToChf) ? rateToChf : 1;
    return amountChf / rate;
}

/** Convert foreign amount back to CHF: amountChf = amountFx * rate. */
export function fxToChf(amountFx: number, rateToChf: number): number {
    const rate = rateToChf > 0 && Number.isFinite(rateToChf) ? rateToChf : 1;
    return amountFx * rate;
}

export function normalizeCurrencyCode(code: string): string {
    return (code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

export function emptySeries(code: string, year: number, name = ''): CurrencySeries {
    const normalized = normalizeCurrencyCode(code) || 'XXX';
    return {
        code: normalized,
        name: (name || '').trim(),
        rates: Array.from({length: daysInYear(year)}, () => null)
    };
}

/** Ensure rates array matches year length; keeps existing values. */
export function resizeRates(rates: Array<number | null | undefined>, year: number): Array<number | null> {
    const len = daysInYear(year);
    const next: Array<number | null> = Array.from({length: len}, () => null);
    for (let i = 0; i < Math.min(len, rates?.length ?? 0); i++) {
        const value = rates[i];
        next[i] = value != null && Number.isFinite(value) ? Number(value) : null;
    }
    return next;
}

export function parseRateInput(raw: string): number | null {
    const text = String(raw ?? '').trim().replace(/['’\s]/g, '').replace(',', '.');
    if (!text) {
        return null;
    }
    const value = Number(text);
    return Number.isFinite(value) && value > 0 ? value : null;
}
