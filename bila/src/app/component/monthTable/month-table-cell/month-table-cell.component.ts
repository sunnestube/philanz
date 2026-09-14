import {Component, input, output} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {MonthCell} from '../../../model/MonthCell';

@Component({
    selector: 'td[balMonthCell]',
    standalone: true,
    imports: [FormsModule],
    templateUrl: './month-table-cell.component.html',
    host: {
        '[class]': 'hostClass()',
        '[attr.data-ref]': 'refColor()',
        '(mousedown)': 'cellMouseDown.emit($event)',
        '(mouseenter)': 'cellEnter.emit()'
    }
})
export class MonthTableCellComponent {
    readonly cell = input.required<MonthCell>();
    readonly cssType = input('');
    readonly isSelect = input(false);
    readonly isIndex = input(false);
    readonly isFormula = input(false);
    readonly editing = input(false);
    readonly refTarget = input(false);
    readonly refColor = input<number | null>(null);
    readonly display = input('');
    readonly cellId = input('');
    readonly options = input<string[]>([]);
    readonly rowIndex = input(0);
    readonly selected = input(false);
    readonly cellMouseDown = output<MouseEvent>();
    readonly cellEnter = output();
    readonly selectChange = output();
    readonly selectNavigate = output<KeyboardEvent>();
    readonly valueFocus = output();
    readonly valueInput = output<Event>();
    readonly valueBlur = output();
    readonly valueKeydown = output<KeyboardEvent>();
    readonly copy = output<ClipboardEvent>();
    readonly paste = output<ClipboardEvent>();

    hostClass(): string {
        return [
            this.cssType(),
            this.isFormula() ? 'formula' : '',
            this.editing() ? 'editing' : '',
            this.refTarget() ? 'ref-target' : '',
            this.selected() ? 'selected' : ''
        ].filter(Boolean).join(' ');
    }

    onSelectArrowDown(event: KeyboardEvent): void {
        if (event.key.startsWith('Arrow')) {
            event.preventDefault();
        }
    }

    onSelectArrowUp(event: KeyboardEvent): void {
        if (event.key.startsWith('Arrow')) {
            this.selectNavigate.emit(event);
        }
    }
}
