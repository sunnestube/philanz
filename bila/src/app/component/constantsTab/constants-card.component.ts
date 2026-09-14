import {Component, input, output} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {CONSTANT_MONTHS, ConstantDef, WorkbookService} from '../../service/workbook.service';

export type ConstantKind = 'transfer' | 'column';
export type RichConstant = ConstantDef & {kind?: ConstantKind; columnTitle?: string};

@Component({
    selector: 'bal-constants-card',
    standalone: true,
    imports: [FormsModule],
    styleUrl: './constants-tab.component.css',
    templateUrl: './constants-card.component.html'
})
export class ConstantsCardComponent {
    readonly item = input.required<RichConstant>();
    readonly kind = input<ConstantKind>('transfer');
    readonly first = input(false);
    readonly last = input(false);
    readonly placeholder = input('Name');
    readonly workbook = input.required<WorkbookService>();
    readonly nameChange = output<Event>();
    readonly monthChange = output<{index: number; event: Event}>();
    readonly nudge = output<number>();
    readonly removed = output();
    readonly dragStart = output<DragEvent>();
    readonly dragOver = output<DragEvent>();
    readonly dropped = output<DragEvent>();
    readonly months = CONSTANT_MONTHS;

    isFormula(raw: string): boolean {
        const text = (raw ?? '').trim();
        return this.workbook().isFormula(raw) || text === '↑' || text === '=↑' || text.toLowerCase() === '=vorzeile';
    }

    preview(monthTitle: string): string {
        const index = CONSTANT_MONTHS.indexOf(monthTitle as typeof CONSTANT_MONTHS[number]);
        const raw = this.item().months[index] ?? '';
        if (this.isFormula(raw)) {
            return this.format(this.workbook().constantAmount(this.item(), monthTitle));
        }
        return raw;
    }

    format(value: number): string {
        return value ? value.toLocaleString('de-CH', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '';
    }
}
