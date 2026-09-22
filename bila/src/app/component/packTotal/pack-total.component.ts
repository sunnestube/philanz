import {Component, computed, inject} from '@angular/core';
import {CurrencySelectComponent} from '../currencySelect/currency-select.component';
import {WorkbookService} from '../../service/workbook.service';
import {PackReportService} from '../../service/pack-report.service';

@Component({
    selector: 'bal-pack-total',
    standalone: true,
    imports: [CurrencySelectComponent],
    templateUrl: './pack-total.component.html',
    styleUrl: '../yearTotal/year-total.component.css',
    styles: [':host { padding: 12px; box-sizing: border-box; display: block; overflow: auto; }']
})
export class PackTotalComponent {
    private readonly pack = inject(PackReportService);
    readonly workbook = inject(WorkbookService);
    readonly report = computed(() => {
        this.workbook.fx.displayCurrency();
        return this.pack.mergedReport();
    });

    format(value: number): string {
        return this.workbook.fx.formatAmount(value ?? 0);
    }

    columnKind(col: {kind?: string}): string {
        return col.kind || 'Ausgabe';
    }
}
