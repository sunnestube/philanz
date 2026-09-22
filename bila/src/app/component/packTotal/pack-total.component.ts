import {Component, effect, inject, untracked} from '@angular/core';
import {CurrencySelectComponent} from '../currencySelect/currency-select.component';
import {WorkbookService} from '../../service/workbook.service';
import {YearArchiveService} from '../../service/year-archive.service';
import {PackReportService} from '../../service/pack-report.service';

@Component({
    selector: 'bal-pack-total',
    standalone: true,
    imports: [CurrencySelectComponent],
    templateUrl: './pack-total.component.html',
    styleUrl: '../yearTotal/year-total.component.css',
    styles: [`
        :host {
            display: block !important;
            height: auto !important;
            min-height: 100%;
            overflow: auto !important;
            padding: 12px;
            box-sizing: border-box;
        }
        .year-total { height: auto !important; }
        .total-scroll { flex: none; max-height: calc(100vh - 220px); }
    `]
})
export class PackTotalComponent {
    private readonly pack = inject(PackReportService);
    readonly workbook = inject(WorkbookService);
    private readonly archive = inject(YearArchiveService);

    constructor() {
        effect(() => {
            this.workbook.fx.displayCurrency();
            this.archive.years();
            untracked(() => this.pack.refresh());
        });
    }

    report() {
        return this.pack.report();
    }

    error() {
        return this.pack.error();
    }

    format(value: number): string {
        return this.workbook.fx.formatAmount(value ?? 0);
    }

    columnKind(col: {kind?: string}): string {
        return col.kind || 'Ausgabe';
    }
}
