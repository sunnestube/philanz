import {describe, it, expect} from 'vitest';
import {
    BASE_CURRENCY,
    chartAxisIdForCurrency,
    clampFractionDigits,
    dualCurrencyChartScales,
    formatFxAmount
} from './CurrencyFx';

describe('CurrencyFx chart + format helpers', () => {
    it('assigns CHF to left axis and foreign to right', () => {
        expect(chartAxisIdForCurrency(BASE_CURRENCY)).toBe('y');
        expect(chartAxisIdForCurrency('CHF')).toBe('y');
        expect(chartAxisIdForCurrency('BTC')).toBe('y1');
        expect(chartAxisIdForCurrency('eur')).toBe('y1');
    });

    it('dualCurrencyChartScales exposes y and y1', () => {
        const scales = dualCurrencyChartScales({stacked: false});
        expect(scales['y']).toBeTruthy();
        expect(scales['y1']).toBeTruthy();
        expect((scales['y1'] as {position: string}).position).toBe('right');
    });

    it('formatFxAmount guards null/NaN (NG02100 avoidance)', () => {
        expect(formatFxAmount(null)).toBe('');
        expect(formatFxAmount(Number.NaN)).toBe('');
        expect(formatFxAmount(undefined)).toBe('');
        expect(formatFxAmount(1.2345, 2)).toMatch(/1[.,]23/);
        expect(formatFxAmount(0.12345678, 8)).toMatch(/0[.,]12345678/);
    });

    it('clampFractionDigits stays in 0..8', () => {
        expect(clampFractionDigits(8)).toBe(8);
        expect(clampFractionDigits(0)).toBe(0);
        expect(clampFractionDigits(99)).toBe(8);
        expect(clampFractionDigits(-1)).toBe(0);
        expect(clampFractionDigits('x')).toBe(2);
    });
});
