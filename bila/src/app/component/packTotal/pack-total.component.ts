import {Component, effect, inject, untracked} from '@angular/core';
import {CurrencySelectComponent} from '../currencySelect/currency-select.component';
import {WorkbookService} from '../../service/workbook.service';
import {YearArchiveService} from '../../service/year-archive.service';
import {PackMonthBlock, PackReportService} from '../../service/pack-report.service';

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
        .yoy-list {
            list-style: none;
            margin: 0 0 12px;
            padding: 0;
            font-size: 13px;
            line-height: 1.45;
        }
        .yoy-list li { padding: 2px 0; }
        .up { color: #166534; }
        .down { color: #9f1239; }
        tr.yoy td, tr.yoy th { background: #f8fafc; font-variant-numeric: tabular-nums; }
        @media (prefers-color-scheme: dark) {
            .yoy-list, .yoy-list li { color: #e2e8f0; }
            .up { color: #86efac; }
            .down { color: #fda4af; }
            tr.yoy td, tr.yoy th { background: #1e293b; color: #e2e8f0; }
        }
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

    formatDelta(value: number): string {
        const text = this.format(Math.abs(value ?? 0));
        if ((value ?? 0) > 0) {
            return `+${text}`;
        }
        if ((value ?? 0) < 0) {
            return `−${text}`;
        }
        return text;
    }

    formatPct(value: number | null | undefined): string {
        if (value == null || !Number.isFinite(value)) {
            return '';
        }
        const rounded = Math.round(value);
        return `${rounded > 0 ? '+' : rounded < 0 ? '−' : ''}${Math.abs(rounded)} %`;
    }

    deltaClass(value: number | null | undefined): string {
        if (value == null || value === 0) {
            return '';
        }
        return value > 0 ? 'up' : 'down';
    }

    rowSpan(block: PackMonthBlock, personCount: number): number {
        return personCount + 1 + (block.compare ? 1 : 0);
    }

    columnKind(col: {kind?: string}): string {
        return col.kind || 'Ausgabe';
    }
}
