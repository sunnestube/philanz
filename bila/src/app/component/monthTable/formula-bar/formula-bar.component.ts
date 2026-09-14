import {Component, ElementRef, input, output, viewChild} from '@angular/core';

@Component({
    selector: 'bal-formula-bar',
    standalone: true,
    templateUrl: './formula-bar.component.html',
    styleUrl: './formula-bar.component.css'
})
export class FormulaBarComponent {
    readonly draft = input('');
    readonly activeAddress = input('');
    readonly active = input(false);
    readonly colorize = input(false);
    readonly placeholder = input('');
    readonly tokens = input<Array<{text: string; color: number | null}>>([]);
    readonly formulaFocus = output();
    readonly formulaInput = output<Event>();
    readonly formulaKeydown = output<KeyboardEvent>();
    readonly formulaCopy = output<ClipboardEvent>();
    readonly formulaPaste = output<ClipboardEvent>();
    readonly formulaBlur = output<FocusEvent>();
    private readonly field = viewChild<ElementRef<HTMLInputElement>>('formulaInput');

    focusEnd(): void {
        const inputEl = this.field()?.nativeElement;
        if (!inputEl) {
            return;
        }
        inputEl.focus();
        const end = inputEl.value.length;
        inputEl.setSelectionRange(end, end);
    }

    blur(): void {
        this.field()?.nativeElement?.blur();
    }
}
