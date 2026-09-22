import {Component, computed, effect, inject, signal, untracked} from '@angular/core';
import {CurrencySelectComponent} from '../currencySelect/currency-select.component';
import {WorkbookService} from '../../service/workbook.service';
import {YearArchiveService} from '../../service/year-archive.service';
import {PackReportService, PackYearSlice} from '../../service/pack-report.service';

@Component({
    selector: 'bal-pack-total',
    standalone: true,
    imports: [CurrencySelectComponent],
    templateUrl: './pack-total.component.html',
    styleUrl: '../yearTotal/year-total.component.css',
    styles: [':host { padding: 12px; box-sizing: border-box; }']
})
export class PackTotalComponent {
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
    readonly columns = computed(() => {
        const seen = new Map<string, {key: string; title: string; kind?: string}>();
        this.slices().forEach((slice) => {
            slice.report.columns.forEach((col) => {
                if (!seen.has(col.key)) {
                    seen.set(col.key, col);
                }
            });
        });
        return [...seen.values()];
    });
    readonly persons = computed(() => {
        const set = new Set<string>();
        this.slices().forEach((slice) => slice.report.persons.forEach((person) => set.add(person)));
        return [...set];
    });
    readonly totals = computed(() => {
        const list = this.slices();
        return {
            expense: list.reduce((sum, slice) => sum + (slice.report.yearExpense ?? 0), 0),
            income: list.reduce((sum, slice) => sum + (slice.report.yearIncome ?? 0), 0)
        };
    });

    format(value: number): string {
        return this.workbook.fx.formatAmount(value ?? 0);
    }

    columnKind(col: {kind?: string}): string {
        return col.kind || 'Ausgabe';
    }

    personValue(slice: PackYearSlice, person: string, key: string): number {
        return slice.report.months.reduce((sum, block) => sum + (block.byPerson[person]?.[key] ?? 0), 0);
    }

    personTotal(slice: PackYearSlice, person: string): number {
        return slice.report.months.reduce((sum, block) => sum + (block.personTotal[person] ?? 0), 0);
    }

    columnValue(slice: PackYearSlice, key: string): number {
        return slice.report.summaryRows[0]?.byColumn[key] ?? 0;
    }
}
