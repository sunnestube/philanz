import {BASE_CURRENCY} from '../../model/CurrencyFx';
import {WorkbookService} from '../../service/workbook.service';

const BAR_COLORS = ['#60a5fa', '#818cf8', '#34d399', '#f472b6', '#fbbf24', '#fb923c', '#38bdf8', '#c084fc'];

export function withCurrencyBars(
    chart: {labels: string[]; datasets: Array<{label?: string; data?: number[]; backgroundColor?: unknown} & Record<string, unknown>>},
    workbook: WorkbookService,
    monthTitles: string[]
): {labels: string[]; datasets: object[]} {
    const codes = uniqueCodes(workbook);
    if (!chart?.datasets?.length || codes.length < 2) {
        return chart;
    }
    const display = workbook.fx.displayCurrency();
    const datasets: object[] = [];
    chart.datasets.forEach((dataset, index) => {
        codes.forEach((code, codeIndex) => {
            datasets.push({
                ...dataset,
                type: 'bar',
                label: `${dataset.label ?? ''} ${code}`.trim(),
                yAxisID: code === BASE_CURRENCY ? 'y' : 'y1',
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
