import {BASE_CURRENCY, chartAxisIdForCurrency} from '../../model/CurrencyFx';
import {WorkbookService} from '../../service/workbook.service';

const BAR_COLORS = ['#60a5fa', '#818cf8', '#34d399', '#f472b6', '#fbbf24', '#fb923c', '#38bdf8', '#c084fc'];

export type BarChart = {
    labels: string[];
    datasets: Array<{label?: string; data?: number[]; backgroundColor?: unknown} & Record<string, unknown>>;
};

export type FxBarChart = {
    code: string;
    chart: BarChart;
};

export function withCurrencyBars(
    chart: BarChart,
    workbook: WorkbookService,
    monthTitles: string[]
): BarChart {
    const codes = uniqueCodes(workbook);
    if (!chart?.datasets?.length || codes.length < 2) {
        return chart;
    }
    return withCodes(chart, workbook, monthTitles, codes);
}

/**
 * Display currency stays in the first diagram; each other currency gets its own
 * companion chart so BTC (etc.) keeps a useful Y scale instead of sitting on the
 * floor next to EUR/USD on a shared axis.
 */
export function splitCurrencyCharts(
    chart: BarChart,
    workbook: WorkbookService,
    monthTitles: string[]
): {display: BarChart; fxCharts: FxBarChart[]} {
    if (!chart?.datasets?.length) {
        return {display: chart, fxCharts: []};
    }
    const display = workbook.fx.displayCurrency();
    const fxCodes = uniqueCodes(workbook).filter((code) => code !== display);
    if (!fxCodes.length) {
        return {display: chart, fxCharts: []};
    }
    return {
        display: chart,
        fxCharts: fxCodes.map((code) => ({
            code,
            chart: withCodes(chart, workbook, monthTitles, [code])
        }))
    };
}

function withCodes(
    chart: BarChart,
    workbook: WorkbookService,
    monthTitles: string[],
    codes: string[]
): BarChart {
    const display = workbook.fx.displayCurrency();
    const datasets: BarChart['datasets'] = [];
    chart.datasets.forEach((dataset, index) => {
        codes.forEach((code, codeIndex) => {
            datasets.push({
                ...dataset,
                type: 'bar',
                label: `${dataset.label ?? ''} ${code}`.trim(),
                // Solo currency → left `y` (full auto-scale). Mixed CHF+FX → dual axes.
                yAxisID: axisIdForCodes(code, codes),
                order: 1,
                fill: undefined,
                tension: undefined,
                borderColor: undefined,
                backgroundColor: BAR_COLORS[(index * codes.length + codeIndex) % BAR_COLORS.length],
                data: (dataset.data || []).map((value, monthIndex) =>
                    convertAmount(workbook, value ?? 0, display, code, monthTitles[monthIndex] || ''))
            });
        });
    });
    return {labels: chart.labels, datasets};
}

/** One series → left axis; several → CHF left / foreign right (same as trend chart). */
export function axisIdForCodes(code: string, codesInChart: string[]): 'y' | 'y1' {
    if (codesInChart.length <= 1) {
        return 'y';
    }
    return chartAxisIdForCurrency(code);
}

function uniqueCodes(workbook: WorkbookService): string[] {
    const codes = [BASE_CURRENCY, ...workbook.fx.currencies().map((item) => item.code)];
    return [...new Set(codes.filter(Boolean))];
}

function convertAmount(
    workbook: WorkbookService,
    value: number,
    fromCode: string,
    toCode: string,
    monthTitle: string
): number {
    if (!Number.isFinite(value)) {
        return 0;
    }
    if (fromCode === toCode) {
        return value;
    }
    const day = workbook.fx.dayIndexForMonth(monthTitle);
    const chf = fromCode === BASE_CURRENCY
        ? value
        : value * workbook.fx.rate(day, fromCode);
    return workbook.fx.toDisplay(chf, day, toCode);
}
