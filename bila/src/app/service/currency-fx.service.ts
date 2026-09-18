import {Injectable, computed, signal} from '@angular/core';
import {
    BASE_CURRENCY,
    CurrencySeries,
    chfToFx,
    dayOfYearIndex,
    daysInYear,
    emptySeries,
    fillForwardRate,
    normalizeCurrencyCode,
    parseFxPasteRates,
    parseRateInput,
    resizeRates
} from '../model/CurrencyFx';
import {CellFormatPipe} from '../pipe/cell-format.pipe';
import {Month} from '../model/Month';
import {MonthRow} from '../model/MonthRow';
import {CELL_TYPE} from '../model/CellType';

/**
 * FX rates (foreign → CHF) and display-currency conversion.
 *
 * Design:
 * - Ledger amounts stay in CHF.
 * - `displayCurrency` only scales presentation (and Total/Graf aggregates).
 * - Missing daily rates fill-forward the last known rate; no rates → 1:1 (CHF).
 * - Row date = Datum column day + month tab; missing date → mid-month (day 15).
 */
@Injectable({
    providedIn: 'root'
})
export class CurrencyFxService {
    readonly calendarYear = signal(new Date().getFullYear());
    readonly currencies = signal<CurrencySeries[]>([]);
    readonly displayCurrency = signal(BASE_CURRENCY);

    readonly codes = computed(() => [
        BASE_CURRENCY,
        ...this.currencies().map((item) => item.code)
    ]);

    setCalendarYear(year: number): void {
        const next = Number.isFinite(year) && year >= 1970 && year <= 2100
            ? Math.floor(year)
            : new Date().getFullYear();
        if (next === this.calendarYear()) {
            return;
        }
        this.calendarYear.set(next);
        this.currencies.update((list) => list.map((item) => ({
            ...item,
            rates: resizeRates(item.rates, next)
        })));
    }

    setDisplayCurrency(code: string): void {
        const normalized = normalizeCurrencyCode(code) || BASE_CURRENCY;
        if (normalized === BASE_CURRENCY || this.currencies().some((item) => item.code === normalized)) {
            this.displayCurrency.set(normalized);
        }
    }

    addCurrency(code: string, name = ''): CurrencySeries | null {
        const normalized = normalizeCurrencyCode(code);
        if (!normalized || normalized === BASE_CURRENCY) {
            return null;
        }
        if (this.currencies().some((item) => item.code === normalized)) {
            return null;
        }
        const series = emptySeries(normalized, this.calendarYear(), name);
        this.currencies.update((list) => [...list, series]);
        return series;
    }

    removeCurrency(code: string): void {
        const normalized = normalizeCurrencyCode(code);
        this.currencies.update((list) => list.filter((item) => item.code !== normalized));
        if (this.displayCurrency() === normalized) {
            this.displayCurrency.set(BASE_CURRENCY);
        }
    }

    setRate(code: string, dayIndex: number, rate: number | null): void {
        const normalized = normalizeCurrencyCode(code);
        this.currencies.update((list) => list.map((item) => {
            if (item.code !== normalized) {
                return item;
            }
            const rates = [...item.rates];
            if (dayIndex < 0 || dayIndex >= rates.length) {
                return item;
            }
            rates[dayIndex] = rate != null && Number.isFinite(rate) && rate > 0 ? rate : null;
            return {...item, rates};
        }));
    }

    setRateFromInput(code: string, dayIndex: number, raw: string): void {
        this.setRate(code, dayIndex, parseRateInput(raw));
    }

    /**
     * Apply a pasted rate column starting at `startDayIndex`.
     * Writes up to daysInYear; ignores extras; leaves trailing days unchanged when fewer lines.
     * Empty / invalid pasted cells clear that day (null).
     */
    setRatesFromPaste(code: string, startDayIndex: number, rates: Array<number | null>): void {
        const normalized = normalizeCurrencyCode(code);
        const start = Math.max(0, Math.floor(startDayIndex) || 0);
        this.currencies.update((list) => list.map((item) => {
            if (item.code !== normalized) {
                return item;
            }
            const next = [...item.rates];
            for (let i = 0; i < rates.length; i++) {
                const day = start + i;
                if (day >= next.length) {
                    break;
                }
                const rate = rates[i];
                next[day] = rate != null && Number.isFinite(rate) && rate > 0 ? rate : null;
            }
            return {...item, rates: next};
        }));
    }

    /** Parse clipboard text and apply from startDayIndex (see setRatesFromPaste). */
    pasteRates(code: string, startDayIndex: number, clipboardText: string): number {
        const rates = parseFxPasteRates(clipboardText);
        if (!rates.length) {
            return 0;
        }
        this.setRatesFromPaste(code, startDayIndex, rates);
        return rates.length;
    }

    renameCurrency(code: string, name: string): void {
        const normalized = normalizeCurrencyCode(code);
        this.currencies.update((list) => list.map((item) =>
            item.code === normalized ? {...item, name: (name || '').trim()} : item
        ));
    }

    /** Effective rate (CHF per 1 unit) for display currency on a day-of-year index. */
    rate(dayIndex: number, code = this.displayCurrency()): number {
        const normalized = normalizeCurrencyCode(code) || BASE_CURRENCY;
        if (normalized === BASE_CURRENCY) {
            return 1;
        }
        const series = this.currencies().find((item) => item.code === normalized);
        if (!series) {
            return 1;
        }
        return fillForwardRate(series.rates, dayIndex);
    }

    toDisplay(amountChf: number, dayIndex: number, code = this.displayCurrency()): number {
        return chfToFx(amountChf, this.rate(dayIndex, code));
    }

    isBase(code = this.displayCurrency()): boolean {
        return (normalizeCurrencyCode(code) || BASE_CURRENCY) === BASE_CURRENCY;
    }

    dayIndexForRow(month: Month | undefined, row: MonthRow | undefined): number {
        const year = this.calendarYear();
        const monthNum = CellFormatPipe.monthNumber(month?.label.title ?? '') || 1;
        const dateIdx = month?.columns.findIndex((column) => column.type === CELL_TYPE.date) ?? -1;
        let day = 15;
        if (row && dateIdx >= 0) {
            const raw = String(row.cells[dateIdx]?.raw ?? '').trim();
            const token = raw.split(/[.\s/]/)[0] ?? '';
            const parsed = parseInt(token.replace(/\D/g, ''), 10);
            if (Number.isFinite(parsed) && parsed > 0) {
                day = parsed;
            }
        }
        return dayOfYearIndex(year, monthNum, day);
    }

    /** Mid-month day index — used for month-level aggregates without row dates. */
    dayIndexForMonth(monthTitle: string): number {
        const monthNum = CellFormatPipe.monthNumber(monthTitle) || 1;
        return dayOfYearIndex(this.calendarYear(), monthNum, 15);
    }

    dayLabels(): Array<{index: number; label: string; month: number; day: number}> {
        const out: Array<{index: number; label: string; month: number; day: number}> = [];
        const year = this.calendarYear();
        let index = 0;
        for (let month = 1; month <= 12; month++) {
            const dim = new Date(year, month, 0).getDate();
            for (let day = 1; day <= dim; day++) {
                out.push({
                    index,
                    month,
                    day,
                    label: `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.`
                });
                index++;
            }
        }
        return out;
    }

    snapshot(): CurrencySeries[] {
        return this.currencies().map((item) => ({
            code: item.code,
            name: item.name,
            rates: [...item.rates]
        }));
    }

    load(raw: unknown, year = this.calendarYear()): void {
        this.calendarYear.set(year);
        if (!Array.isArray(raw)) {
            this.currencies.set([]);
            if (this.displayCurrency() !== BASE_CURRENCY) {
                this.displayCurrency.set(BASE_CURRENCY);
            }
            return;
        }
        const list: CurrencySeries[] = [];
        const seen = new Set<string>();
        raw.forEach((item) => {
            const source = item as Partial<CurrencySeries>;
            const code = normalizeCurrencyCode(source.code || '');
            if (!code || code === BASE_CURRENCY || seen.has(code)) {
                return;
            }
            seen.add(code);
            list.push({
                code,
                name: (source.name || '').trim(),
                rates: resizeRates(Array.isArray(source.rates) ? source.rates : [], year)
            });
        });
        this.currencies.set(list);
        if (!this.codes().includes(this.displayCurrency())) {
            this.displayCurrency.set(BASE_CURRENCY);
        }
    }
}

/** Pure helpers re-exported for tests / callers that avoid DI. */
export {
    fillForwardRate,
    chfToFx,
    dayOfYearIndex,
    daysInYear,
    parseFxPasteRates,
    parseRateInput,
    BASE_CURRENCY
};
