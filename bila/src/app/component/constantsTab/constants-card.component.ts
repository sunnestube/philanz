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
    template: `
        <article class="const-card" [class.column-card]="kind() === 'column'"
                 draggable="true"
                 (dragstart)="dragStart.emit($event)"
                 (dragover)="dragOver.emit($event)"
                 (drop)="dropped.emit($event)">
            <div class="name-row">
                <span class="drag-handle">⋮⋮</span>
                <input class="name-input" type="text" [value]="item().name" (change)="nameChange.emit($event)" [placeholder]="placeholder()"/>
                <button type="button" class="move-btn" (click)="nudge.emit(-1)" [disabled]="first()">←</button>
                <button type="button" class="move-btn" (click)="nudge.emit(1)" [disabled]="last()">→</button>
                <button type="button" class="const-remove" (click)="removed.emit()">×</button>
            </div>
            <ng-content/>
            <div class="month-grid">
                @for (label of months; track label; let monthIndex = $index) {
                    <label>{{ label }}
                        <input type="text"
                               inputmode="text"
                               [class.formula]="isFormula(item().months[monthIndex])"
                               [value]="item().months[monthIndex]"
                               (change)="monthChange.emit({index: monthIndex, event: $event})"
                               [title]="preview(label)"/>
                    </label>
                }
            </div>
            <div class="const-foot">
                <span>Ø {{ format(workbook().constantAverage(item())) }}</span>
                <span>Σ {{ format(workbook().constantTotal(item())) }}</span>
            </div>
        </article>
    `
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
