import {Component, input} from '@angular/core';
import {SaldoCellView} from '../month-table.vm';

@Component({
    selector: 'td[balSaldoCell]',
    standalone: true,
    templateUrl: './saldo-cell.component.html',
    host: {
        '[class]': 'hostClass()'
    }
})
export class SaldoCellComponent {
    readonly vm = input.required<SaldoCellView>();

    hostClass(): string {
        const item = this.vm();
        return [
            'number',
            'S',
            item.personClass === 'total-col' ? 'total-col' : `person-${item.personClass}`,
            item.first ? 'saldo-start' : '',
            item.up ? 'up' : '',
            item.down ? 'down' : '',
            item.neg ? 'neg' : '',
            item.zero ? 'zero' : ''
        ].filter(Boolean).join(' ');
    }
}
