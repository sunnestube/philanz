import {describe, it, expect, beforeEach} from 'vitest';
import {axisIdForCodes, splitCurrencyCharts, type BarChart} from './currency-bars';
import {CurrencyFxService} from '../../service/currency-fx.service';
import {BASE_CURRENCY} from '../../model/CurrencyFx';

describe('currency-bars split + axis', () => {
    it('solo currency uses left axis; mixed uses CHF left / FX right', () => {
        expect(axisIdForCodes('BTC', ['BTC'])).toBe('y');
        expect(axisIdForCodes(BASE_CURRENCY, [BASE_CURRENCY, 'BTC'])).toBe('y');
        expect(axisIdForCodes('BTC', [BASE_CURRENCY, 'BTC'])).toBe('y1');
    });

    it('splitCurrencyCharts yields one companion chart per FX code', () => {
        const fx = new CurrencyFxService();
        fx.setCalendarYear(2025);
        fx.addCurrency('EUR');
        fx.addCurrency('BTC');
        fx.setFractionDigits('BTC', 8);
        fx.displayCurrency.set(BASE_CURRENCY);

        const chart: BarChart = {
            labels: ['Jan', 'Feb'],
            datasets: [{label: 'Ausgaben', data: [1000, 2000]}]
        };
        const workbook = {fx} as any;
        const split = splitCurrencyCharts(chart, workbook, ['Januar', 'Februar']);
        expect(split.fxCharts.map((item) => item.code).sort()).toEqual(['BTC', 'EUR']);
        expect(split.fxCharts.every((item) => item.chart.datasets.every((d) => d['yAxisID'] === 'y'))).toBe(true);
        // Display chart stays the original (CHF) series.
        expect(split.display.datasets[0].data).toEqual([1000, 2000]);
    });
});
