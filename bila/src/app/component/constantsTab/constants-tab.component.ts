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

    preview(item: ConstantDef, monthTitle: string): string {
        const index = CONSTANT_MONTHS.indexOf(monthTitle as typeof CONSTANT_MONTHS[number]);
        const raw = item.months[index] ?? '';
        if (!this.workbook.isFormula(raw)) {
            return raw;
        }
        return this.format(this.workbook.constantAmount(item, monthTitle));
    }

    format(value: number): string {
        if (!value) {
            return '';
        }
        return value.toLocaleString('de-CH', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    }
}
