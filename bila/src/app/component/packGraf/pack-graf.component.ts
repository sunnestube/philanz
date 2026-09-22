import {Component, computed, effect, inject, signal, untracked} from '@angular/core';
import {ChartModule} from 'primeng/chart';
import {CurrencySelectComponent} from '../currencySelect/currency-select.component';
import {WorkbookService} from '../../service/workbook.service';
import {YearArchiveService} from '../../service/year-archive.service';
import {PackReportService, PackYearSlice} from '../../service/pack-report.service';
import {BASE_CURRENCY, dualCurrencyChartScales} from '../../model/CurrencyFx';
import 'chart.js/auto';

@Component({
    selector: 'bal-pack-graf',
    standalone: true,
    imports: [ChartModule, CurrencySelectComponent],
    templateUrl: './pack-graf.component.html',
    styleUrl: '../yearGraf/year-graf.component.css',
    styles: [':host { padding: 12px; box-sizing: border-box; overflow: auto; }']
})
export class PackGrafComponent {
    private readonly pack = inject(PackReportService);
    readonly workbook = inject(WorkbookService);
    private readonly archive = inject(YearArchiveService);
    private readonly slicesSig = signal<PackYearSlice[]>([]);
    readonly slices = this.slicesSig.asReadonly();

    constructor() {
        effect(() => {
            this.workbook.fx.displayCurrency();
            this.archive.years();
            untracked(() => this.slicesSig.set(this.pack.collect()));
        });
    }
    readonly displayCode = computed(() => {
        this.workbook.revision();
        return this.workbook.fx.displayCurrency();
    });
    readonly charts = computed(() => {
        const slices = this.slices();
        const labels = slices.map((slice) => slice.title);
        const persons = new Set<string>();
        slices.forEach((slice) => slice.report.persons.forEach((person: string) => persons.add(person)));
        const palette = ['#60a5fa', '#818cf8', '#fbbf24', '#fb923c', '#34d399', '#f472b6'];
        const personStack = {
            labels,
            datasets: [...persons].map((person, index) => ({
                label: this.workbook.personLabel(person),
                backgroundColor: palette[index % palette.length],
                data: slices.map((slice) =>
                    slice.report.months.reduce((sum: number, block: {personTotal: Record<string, number>}) => sum + (block.personTotal[person] ?? 0), 0))
            }))
        };
        const incomeExpense = {
            labels,
            datasets: [
                {
                    label: 'Einnahmen',
                    backgroundColor: '#4ade80',
                    data: slices.map((slice) => slice.report.yearIncome)
                },
                {
                    label: 'Ausgaben',
                    backgroundColor: '#f472b6',
                    data: slices.map((slice) => slice.report.yearExpense)
                }
            ]
        };
        const fxPalette = ['#0f172a', '#2563eb', '#dc2626', '#059669', '#d97706'];
        const codes = [BASE_CURRENCY, ...this.workbook.fx.currencies().map((item) => item.code)];
        const currencyCompare = {
            labels,
            datasets: codes.map((code, index) => ({
                label: `Ausgaben ${code}`,
                borderColor: fxPalette[index % fxPalette.length],
                backgroundColor: 'transparent',
                tension: 0.25,
                yAxisID: code === BASE_CURRENCY ? 'y' : 'y1',
                data: slices.map((slice) => {
                    const chf = slice.report.yearExpense;
                    return code === BASE_CURRENCY
                        ? chf
                        : this.workbook.fx.toDisplay(chf, 180, code);
                })
            }))
        };
        return {personStack, incomeExpense, currencyCompare};
    });

    readonly options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {legend: {labels: {color: '#111', boxWidth: 12}}},
        scales: dualCurrencyChartScales({stacked: true})
    };
    readonly groupedOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {legend: {labels: {color: '#111', boxWidth: 12}}},
        scales: dualCurrencyChartScales({stacked: false})
    };
    readonly lineOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {legend: {labels: {color: '#111', boxWidth: 12}}},
        scales: dualCurrencyChartScales({stacked: false})
    };
}
