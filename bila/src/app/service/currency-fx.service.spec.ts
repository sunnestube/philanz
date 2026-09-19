import {describe, it, expect, beforeEach} from 'vitest';
import {
    BASE_CURRENCY,
    chfToFx,
    dayOfYearIndex,
    daysInYear,
    emptySeries,
    fillForwardRate,
    fxToChf,
    parseDayOfMonth,
    parseFxPasteRates,
    parseRateInput,
    resizeRates
} from '../model/CurrencyFx';
import {CurrencyFxService} from './currency-fx.service';

describe('CurrencyFx fill-forward + conversion', () => {
    it('returns 1 when no rates exist', () => {
        expect(fillForwardRate([], 10)).toBe(1);
        expect(fillForwardRate([null, null], 1)).toBe(1);
    });

    it('fill-forwards last known rate for later days only', () => {
        const rates = [null, 0.95, null, null, 0.90, null];
        // Before first positive rate → 1:1 (NO look-ahead to day 1)
        expect(fillForwardRate(rates, 0)).toBe(1);
        expect(fillForwardRate(rates, 1)).toBe(0.95);
        expect(fillForwardRate(rates, 2)).toBe(0.95);
        expect(fillForwardRate(rates, 3)).toBe(0.95);
        expect(fillForwardRate(rates, 4)).toBe(0.90);
        expect(fillForwardRate(rates, 5)).toBe(0.90);
    });

    it('before first positive rate stays 1:1 (no look-ahead)', () => {
        const rates = [null, null, 0.88, null];
        expect(fillForwardRate(rates, 0)).toBe(1);
        expect(fillForwardRate(rates, 1)).toBe(1);
        expect(fillForwardRate(rates, 2)).toBe(0.88);
        expect(fillForwardRate(rates, 3)).toBe(0.88);
    });

    it('ignores non-positive rates and does not look ahead', () => {
        expect(fillForwardRate([0, -1, null, 1.1], 2)).toBe(1);
        expect(fillForwardRate([0, -1, null, 1.1], 3)).toBe(1.1);
    });

    it('converts CHF → FX via rate (CHF per 1 foreign)', () => {
        expect(chfToFx(95, 0.95)).toBeCloseTo(100, 8);
        expect(chfToFx(100, 1)).toBe(100);
        expect(chfToFx(100, 0)).toBe(100);
    });

    it('round-trips FX ↔ CHF', () => {
        const rate = 0.92;
        const chf = 184;
        const fx = chfToFx(chf, rate);
        expect(fxToChf(fx, rate)).toBeCloseTo(chf, 8);
    });

    it('parses DE/CH rate input', () => {
        expect(parseRateInput('0,95')).toBeCloseTo(0.95);
        expect(parseRateInput("1'012.5")).toBeCloseTo(1012.5);
        expect(parseRateInput('')).toBeNull();
        expect(parseRateInput('abc')).toBeNull();
    });

    it('parseDayOfMonth handles DD.MM[.YYYY]', () => {
        expect(parseDayOfMonth('03.03.')).toBe(3);
        expect(parseDayOfMonth('15.03.2025')).toBe(15);
        expect(parseDayOfMonth('')).toBeNull();
        expect(parseDayOfMonth('abc')).toBeNull();
    });

    it('dayOfYearIndex handles leap years', () => {
        expect(daysInYear(2024)).toBe(366);
        expect(daysInYear(2025)).toBe(365);
        expect(dayOfYearIndex(2024, 1, 1)).toBe(0);
        expect(dayOfYearIndex(2024, 2, 29)).toBe(59);
        expect(dayOfYearIndex(2024, 3, 1)).toBe(60);
        expect(dayOfYearIndex(2025, 3, 1)).toBe(59);
    });

    it('resizeRates keeps calendar alignment across leap boundary', () => {
        const nonLeap = Array.from({length: 365}, () => null as number | null);
        nonLeap[59] = 0.91;
        const toLeap = resizeRates(nonLeap, 2024, 2025);
        expect(toLeap).toHaveLength(366);
        expect(toLeap[59]).toBeNull();
        expect(toLeap[60]).toBeCloseTo(0.91);
        const back = resizeRates(toLeap, 2025, 2024);
        expect(back).toHaveLength(365);
        expect(back[59]).toBeCloseTo(0.91);
    });
});

describe('parseFxPasteRates', () => {
    it('parses single-column rates and drops trailing blank lines', () => {
        expect(parseFxPasteRates('0,95\n0.90\n\n\n')).toEqual([0.95, 0.90]);
    });

    it('parses TSV using last column as rate', () => {
        expect(parseFxPasteRates('01.01.\t0,95\n02.01.\t0,90\n')).toEqual([0.95, 0.90]);
    });

    it('keeps empty cells as null', () => {
        expect(parseFxPasteRates('0.95\n\n0.90')).toEqual([0.95, null, 0.90]);
    });
});

describe('CurrencyFxService', () => {
    let fx: CurrencyFxService;

    beforeEach(() => {
        fx = new CurrencyFxService();
        fx.setCalendarYear(2025);
    });

    it('starts as CHF with no extra currencies', () => {
        expect(fx.displayCurrency()).toBe(BASE_CURRENCY);
        expect(fx.currencies()).toEqual([]);
        expect(fx.toDisplay(42, 10)).toBe(42);
    });

    it('adds currency and converts with fill-forward', () => {
        fx.addCurrency('eur', 'Euro');
        fx.setRate('EUR', 0, 0.95);
        fx.setDisplayCurrency('EUR');
        expect(fx.toDisplay(95, 0)).toBeCloseTo(100, 6);
        expect(fx.toDisplay(95, 40)).toBeCloseTo(100, 6);
    });

    it('before first rate converts 1:1', () => {
        fx.addCurrency('EUR');
        fx.setRate('EUR', 10, 0.95);
        fx.setDisplayCurrency('EUR');
        expect(fx.toDisplay(100, 0)).toBe(100);
        expect(fx.toDisplay(95, 10)).toBeCloseTo(100, 6);
        expect(fx.toDisplay(95, 40)).toBeCloseTo(100, 6);
    });

    it('treats missing rates as 1:1', () => {
        fx.addCurrency('USD');
        fx.setDisplayCurrency('USD');
        expect(fx.toDisplay(50, 100)).toBe(50);
    });

    it('removes currency and resets display to CHF', () => {
        fx.addCurrency('GBP');
        fx.setDisplayCurrency('GBP');
        fx.removeCurrency('GBP');
        expect(fx.displayCurrency()).toBe(BASE_CURRENCY);
        expect(fx.currencies()).toEqual([]);
    });

    it('snapshot/load round-trips', () => {
        fx.addCurrency('EUR');
        fx.setRate('EUR', 5, 0.94);
        const snap = fx.snapshot();
        const other = new CurrencyFxService();
        other.load(snap, 2025);
        expect(other.currencies()[0].code).toBe('EUR');
        expect(other.rate(5, 'EUR')).toBeCloseTo(0.94);
        expect(other.rate(20, 'EUR')).toBeCloseTo(0.94);
        expect(other.rate(0, 'EUR')).toBe(1);
    });

    it('emptySeries matches year length', () => {
        expect(emptySeries('EUR', 2024).rates).toHaveLength(366);
        expect(emptySeries('EUR', 2025).rates).toHaveLength(365);
    });

    it('setCalendarYear leap resize keeps Mar 1 rate aligned', () => {
        fx.addCurrency('EUR');
        fx.setRate('EUR', 59, 0.91);
        fx.setCalendarYear(2024);
        expect(fx.currencies()[0].rates).toHaveLength(366);
        expect(fx.currencies()[0].rates[59]).toBeNull();
        expect(fx.currencies()[0].rates[60]).toBeCloseTo(0.91);
        fx.setCalendarYear(2025);
        expect(fx.currencies()[0].rates[59]).toBeCloseTo(0.91);
    });

    it('pasteRates applies from focused-day start offset', () => {
        fx.addCurrency('EUR');
        const written = fx.pasteRates('EUR', 10, '0,95\n0,90\n\n');
        expect(written).toBe(2);
        expect(fx.currencies()[0].rates[10]).toBeCloseTo(0.95);
        expect(fx.currencies()[0].rates[11]).toBeCloseTo(0.90);
        expect(fx.currencies()[0].rates[9]).toBeNull();
        expect(fx.currencies()[0].rates[12]).toBeNull();
    });

    it('setRatesFromPaste clears empty pasted cells', () => {
        fx.addCurrency('EUR');
        fx.setRate('EUR', 5, 0.99);
        fx.setRatesFromPaste('EUR', 5, [0.95, null, 0.90]);
        expect(fx.currencies()[0].rates[5]).toBeCloseTo(0.95);
        expect(fx.currencies()[0].rates[6]).toBeNull();
        expect(fx.currencies()[0].rates[7]).toBeCloseTo(0.90);
    });
});
