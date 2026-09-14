import {Component, input, output} from '@angular/core';
import {ColumnView, SaldoColView} from '../month-table.vm';

@Component({
    selector: 'thead[balMonthHeader]',
    standalone: true,
    templateUrl: './month-table-header.component.html'
})
export class MonthTableHeaderComponent {
    readonly columns = input<ColumnView[]>([]);
    readonly saldos = input<SaldoColView[]>([]);
    readonly showSaldo = input(false);
    readonly showTotal = input(false);
    readonly totalTitle = input('Total');
    readonly headerResize = output<PointerEvent>();
    readonly textResize = output<PointerEvent>();
}
