import {dualCurrencyChartScales} from '../../model/CurrencyFx';

export function prefersDarkGraf(): boolean {
    return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
}

export function grafChartOptions(kind: 'bar' | 'line' = 'bar') {
    const dark = prefersDarkGraf();
    const ink = dark ? '#e2e8f0' : '#111';
    const muted = dark ? '#94a3b8' : '#64748b';
    const grid = dark ? '#334155' : '#d4d4d8';
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                labels: {color: ink, boxWidth: 12, font: {size: 11}}
            }
        },
        scales: dualCurrencyChartScales({
            stacked: false,
            ink,
            muted,
            grid
        }),
        datasets: kind === 'line' ? {line: {spanGaps: true}} : undefined
    };
}
