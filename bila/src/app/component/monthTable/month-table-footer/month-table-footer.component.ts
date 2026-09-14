import {Component, input} from '@angular/core';
import {FooterRowView} from '../month-table.vm';
import {SaldoCellComponent} from '../saldo-cell/saldo-cell.component';

@Component({
    selector: 'tfoot[balMonthFooter]',
    standalone: true,
    imports: [SaldoCellComponent],
    templateUrl: './month-table-footer.component.html'
})
export class MonthTableFooterComponent {
    readonly rows = input<FooterRowView[]>([]);
    readonly showSaldo = input(false);
    readonly showTotal = input(false);
}
