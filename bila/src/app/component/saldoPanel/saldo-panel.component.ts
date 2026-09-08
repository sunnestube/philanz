import {Component, computed, inject} from '@angular/core';
import {WorkbookService, ComboSaldo} from '../../service/workbook.service';

@Component({
    selector: 'bal-saldo-panel',
    standalone: true,
    templateUrl: './saldo-panel.component.html',
    styleUrl: './saldo-panel.component.css'
})
export class SaldoPanelComponent {
    private readonly workbook = inject(WorkbookService);

    readonly monthLabel = computed(() => this.workbook.selectedMonth()?.label.title ?? '');
    readonly monthRows = computed(() => this.workbook.comboSaldos('month'));
    readonly yearRows = computed(() => this.workbook.comboSaldos('year'));
    readonly persons = computed(() => this.workbook.personCodes());
    readonly accounts = computed(() => this.workbook.accountCodes());

    cell(person: string, account: string, rows: ComboSaldo[]): number {
        return rows.find((row) => row.person === person && row.account === account)?.balance ?? 0;
    }

    format(value: number): string {
        return value.toLocaleString('de-CH', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    personTotal(person: string, rows: ComboSaldo[]): number {
        return rows
            .filter((row) => row.person === person)
            .reduce((sum, row) => sum + row.balance, 0);
    }
}
