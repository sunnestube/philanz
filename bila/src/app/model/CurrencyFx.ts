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
    /**
     * Display fraction digits for this currency (0–8).
     * CHF stays 2; BTC needs 8. Default 2 when omitted (legacy CSV).
     */
    fractionDigits: number;
}

export const BASE_CURRENCY = 'CHF';

/** 0-based day-of-year index of Feb 29 in a leap year (31 Jan + 28 Feb). */
export const LEAP_FEB29_INDEX = 59;

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
 * Extract day-of-month from DE/CH date strings (`DD.MM`, `DD.MM.YYYY`, `DD/MM`).
 * Empty / unparseable → null (caller uses mid-month day 15).
 */
export function parseDayOfMonth(raw: string): number | null {
    const text = String(raw ?? '').trim();
    if (!text) {
        return null;
    }
    const match = text.match(/^(\d{1,2})(?:[.\s/]|$)/);
    if (!match) {
        return null;
    }
    const day = parseInt(match[1], 10);
    return Number.isFinite(day) && day > 0 ? day : null;
}

/**
 * Fill-forward only: walk backward from `dayIndex` for the last finite positive rate.
 * If none exists on or before that day (including “before the first rate”), returns 1 (1:1).
 * Never looks forward — a future first rate must not leak into earlier days.
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

export function emptySeries(code: string, year: number, name = '', fractionDigits = 2): CurrencySeries {
    const normalized = normalizeCurrencyCode(code) || 'XXX';
    return {
        code: normalized,
        name: (name || '').trim(),
        rates: Array.from({length: daysInYear(year)}, () => null),
        fractionDigits: clampFractionDigits(fractionDigits)
    };
}

/** Clamp display digits to 0..8 (Excel-like money / crypto range). */
export function clampFractionDigits(value: unknown, fallback = 2): number {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n)) {
        return fallback;
    }
    return Math.min(8, Math.max(0, Math.floor(n)));
}

/**
 * Format an amount with a currency's fraction-digit preference.
 * Guards null / NaN / non-finite → empty string (avoids NG02100 from DecimalPipe).
 */
export function formatFxAmount(value: number | null | undefined, fractionDigits = 2, locale = 'de-CH'): string {
    if (value == null || !Number.isFinite(value)) {
        return '';
    }
    const digits = clampFractionDigits(fractionDigits);
    return value.toLocaleString(locale, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
    });
}

/**
 * Assign Chart.js Y-axis ids so series with very different magnitudes
 * (e.g. CHF expenses vs BTC) each get usable vertical space.
 * Base/CHF → left `y`; foreign → right `y1`.
 * Pure helper — safe to unit-test.
 */
export function chartAxisIdForCurrency(code: string, baseCode = BASE_CURRENCY): 'y' | 'y1' {
    const normalized = normalizeCurrencyCode(code) || baseCode;
    return normalized === baseCode ? 'y' : 'y1';
}

/**
 * Build dual Y-axis Chart.js scale config (left = base, right = foreign).
 * Tick callbacks stay numeric-safe (no pipe).
 */
export function dualCurrencyChartScales(opts?: {
    stacked?: boolean;
    locale?: string;
}): Record<string, unknown> {
    const locale = opts?.locale ?? 'de-CH';
    const stacked = !!opts?.stacked;
    const tick = (value: string | number) => {
        const n = typeof value === 'number' ? value : Number(value);
        return Number.isFinite(n) ? n.toLocaleString(locale) : '';
    };
    return {
        x: {stacked, ticks: {color: '#111'}, grid: {color: '#d4d4d8'}},
        y: {
            position: 'left',
            stacked,
            ticks: {color: '#111', callback: tick},
            grid: {color: '#d4d4d8'}
        },
        y1: {
            position: 'right',
            stacked: false,
            ticks: {color: '#64748b', callback: tick},
            grid: {drawOnChartArea: false}
        }
    };
}

/**
 * Resize daily rates to match calendar year length.
 * Across a leap boundary, rates stay aligned by calendar date:
 * - leap → non-leap: drop Feb 29
 * - non-leap → leap: insert null at Feb 29
 * `fromYear` optional; if omitted, inferred from `rates.length` (366 → leap source).
 * Unknown / partial lengths fall back to index copy + pad/truncate.
 */
export function resizeRates(
    rates: Array<number | null | undefined>,
    year: number,
    fromYear?: number
): Array<number | null> {
    const len = daysInYear(year);
    const src = rates ?? [];
    const next: Array<number | null> = Array.from({length: len}, () => null);

    const srcLenKnown = src.length === 365 || src.length === 366;
    const srcIsLeap = fromYear != null ? isLeapYear(fromYear) : src.length === 366;
    const dstIsLeap = isLeapYear(year);

    const sanitize = (value: number | null | undefined): number | null =>
        value != null && Number.isFinite(value) && Number(value) > 0 ? Number(value) : null;

    if (!srcLenKnown || srcIsLeap === dstIsLeap) {
        for (let i = 0; i < Math.min(len, src.length); i++) {
            next[i] = sanitize(src[i]);
        }
        return next;
    }

    if (srcIsLeap && !dstIsLeap) {
        for (let i = 0; i < src.length; i++) {
            if (i === LEAP_FEB29_INDEX) {
                continue;
            }
            const dst = i < LEAP_FEB29_INDEX ? i : i - 1;
            if (dst >= len) {
                break;
            }
            next[dst] = sanitize(src[i]);
        }
        return next;
    }

    for (let i = 0; i < src.length; i++) {
        const dst = i < LEAP_FEB29_INDEX ? i : i + 1;
        if (dst >= len) {
            break;
        }
        next[dst] = sanitize(src[i]);
    }
    return next;
}

/**
 * Parse a rate cell (DE/CH aware): `0,95`, `1.012,5`, `1'012.5`, `0.95`.
 * Empty / invalid → null (clears the day).
 */
export function parseRateInput(raw: string): number | null {
    let text = String(raw ?? '').trim().replace(/['’\s]/g, '');
    if (!text) {
        return null;
    }
    if (text.includes(',')) {
        // Last comma is decimal separator; dots are thousands.
        text = text.replace(/\./g, '').replace(',', '.');
    }
    const value = Number(text);
    return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Parse Excel / plain-text paste into a list of daily rates.
 * Accepts one column of rates, or TSV `date\trate` / `dayIndex\trate` / `rate` (last column wins).
 * Empty cells become null. Trailing blank lines from Excel are dropped.
 */
export function parseFxPasteRates(text: string): Array<number | null> {
    const normalized = String(text ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalized.split('\n');
    while (lines.length && lines[lines.length - 1].trim() === '') {
        lines.pop();
    }
    return lines.map((line) => {
        const cells = line.split('\t');
        const rateCell = cells.length > 1 ? cells[cells.length - 1] : (cells[0] ?? '');
        return parseRateInput(rateCell);
    });
}
