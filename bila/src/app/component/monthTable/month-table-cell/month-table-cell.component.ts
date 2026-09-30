import {ChangeDetectionStrategy, Component, effect, ElementRef, input, output, viewChild} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {MonthCell} from '../../../model/MonthCell';

@Component({
    selector: 'td[balMonthCell]',
    standalone: true,
    imports: [FormsModule],
    templateUrl: './month-table-cell.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        '[class]': 'hostClass()',
        '[attr.data-ref]': 'refColor()',
        '[class.readonly]': 'isReadonly()',
        '[class.fill-anchor]': 'fillHandle()',
        '[attr.data-row]': 'rowIndex()',
        '[attr.data-col]': 'cell().columnIndex',
        '[attr.aria-readonly]': 'isReadonly() || null',
        '(mousedown)': 'onHostMouseDown($event)',
        '(mouseenter)': 'onHostEnter()',
        '(dblclick)': 'onHostDblClick()'
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
    readonly isReadonly = input(false);
    readonly fillHandle = input(false);
    readonly cellMouseDown = output<MouseEvent>();
    readonly cellEnter = output();
    readonly cellDblClick = output();
    readonly selectChange = output();
    readonly selectNavigate = output<KeyboardEvent>();
    readonly valueFocus = output();
    readonly valueInput = output<Event>();
    readonly valueBlur = output();
    readonly valueKeydown = output<KeyboardEvent>();
    readonly copy = output<ClipboardEvent>();
    readonly paste = output<ClipboardEvent>();
    readonly fillStart = output<PointerEvent>();
    private readonly editInput = viewChild<ElementRef<HTMLInputElement>>('editInput');

    constructor() {
        effect(() => {
            const inputEl = this.editInput();
            if (this.editing() && inputEl) {
                queueMicrotask(() => inputEl.nativeElement.focus());
            }
        });
    }

    hostClass(): string {
        return [
            this.cssType(),
            this.isFormula() ? 'formula' : '',
            this.editing() ? 'editing' : '',
            this.refTarget() ? 'ref-target' : '',
            this.selected() ? 'selected' : '',
            this.isReadonly() ? 'readonly' : ''
        ].filter(Boolean).join(' ');
    }

    onHostMouseDown(event: MouseEvent): void {
        if (!this.isReadonly()) {
            this.cellMouseDown.emit(event);
        }
    }

    onHostEnter(): void {
        if (!this.isReadonly()) {
            this.cellEnter.emit();
        }
    }

    onHostDblClick(): void {
        if (!this.isReadonly()) {
            this.cellDblClick.emit();
        }
    }

    onSelectArrowDown(event: KeyboardEvent): void {
        if (event.key.startsWith('Arrow') || event.key === 'Home' || event.key === 'End') {
            event.preventDefault();
        }
    }

    onSelectArrowUp(event: KeyboardEvent): void {
        if (this.isReadonly()) {
            return;
        }
        if (event.key.startsWith('Arrow') || event.key === 'Home' || event.key === 'End') {
            this.selectNavigate.emit(event);
        }
    }

    onReadFocus(): void {
        if (!this.isReadonly()) {
            this.valueFocus.emit();
        }
    }

    onReadKeydown(event: KeyboardEvent): void {
        if (!this.isReadonly()) {
            this.valueKeydown.emit(event);
        }
    }

    onReadPaste(event: ClipboardEvent): void {
        if (!this.isReadonly()) {
            this.paste.emit(event);
        }
    }

    onFillDown(event: PointerEvent): void {
        event.preventDefault();
        event.stopPropagation();
        this.fillStart.emit(event);
    }
}
