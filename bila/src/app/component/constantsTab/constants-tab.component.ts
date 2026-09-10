import {Component, inject} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {CONSTANT_MONTHS, ConstantDef, WorkbookService} from '../../service/workbook.service';

@Component({
    selector: 'bal-constants-tab',
    standalone: true,
    imports: [FormsModule],
    templateUrl: './constants-tab.component.html',
    styleUrl: './constants-tab.component.css'
})
export class ConstantsTabComponent {
    readonly workbook = inject(WorkbookService);
    readonly months = CONSTANT_MONTHS;

    constants(): ConstantDef[] {
        this.workbook.revision();
        return this.workbook.constants();
    }

    onName(item: ConstantDef, event: Event): void {
        this.workbook.setConstantName(item.id, (event.target as HTMLInputElement).value);
    }

    onMonth(item: ConstantDef, index: number, event: Event): void {
        this.workbook.setConstantMonth(item.id, index, (event.target as HTMLInputElement).value);
    }

    insertPrev(item: ConstantDef, index: number): void {
        if (index <= 0) {
            return;
        }
        this.workbook.setConstantMonth(item.id, index, '↑');
    }

    isPrevRef(raw: string | null | undefined): boolean {
        const text = (raw ?? '').trim();
        return text === '↑' || text === '=↑' || text.toLowerCase() === '=vorzeile';
    }

    move(id: string, toIndex: number): void {
        const list = [...this.workbook.constants()];
        const from = list.findIndex((item) => item.id === id);
        if (from < 0) {
            return;
        }
        const target = Math.max(0, Math.min(list.length - 1, toIndex));
        if (from === target) {
            return;
        }
        const [item] = list.splice(from, 1);
        list.splice(target, 0, item);
        this.workbook.constants.set(list);
        const first = list[0];
        if (first) {
            this.workbook.setConstantName(first.id, first.name);
        }
    }

    onDragStart(event: DragEvent, id: string): void {
        event.dataTransfer?.setData('text/plain', id);
        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move';
        }
    }

    onDragOver(event: DragEvent): void {
        event.preventDefault();
    }

    onDrop(event: DragEvent, toIndex: number): void {
        event.preventDefault();
        const id = event.dataTransfer?.getData('text/plain');
        if (id) {
            this.move(id, toIndex);
        }
    }

    preview(item: ConstantDef, monthTitle: string): string {
        const index = CONSTANT_MONTHS.indexOf(monthTitle as typeof CONSTANT_MONTHS[number]);
        const raw = item.months[index] ?? '';
        if (this.isPrevRef(raw) || this.workbook.isFormula(raw)) {
            return this.format(this.workbook.constantAmount(item, monthTitle));
        }
        return raw;
    }

    format(value: number): string {
        if (!value) {
            return '';
        }
        return value.toLocaleString('de-CH', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    }
}
