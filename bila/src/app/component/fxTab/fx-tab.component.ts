import {Component, computed, inject, signal} from '@angular/core';
import {DecimalPipe} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {WorkbookService} from '../../service/workbook.service';
import {fillForwardRate} from '../../model/CurrencyFx';

@Component({
    selector: 'bal-fx-tab',
    standalone: true,
    imports: [FormsModule, DecimalPipe],
    templateUrl: './fx-tab.component.html',
    styleUrl: './fx-tab.component.css'
})
export class FxTabComponent {
    readonly workbook = inject(WorkbookService);
    readonly selectedCode = signal('');
    readonly newCode = signal('');
    readonly newName = signal('');

    readonly selected = computed(() => {
        this.workbook.revision();
        const code = this.selectedCode() || this.workbook.fx.currencies()[0]?.code || '';
        return this.workbook.fx.currencies().find((item) => item.code === code) ?? null;
    });

    readonly days = computed(() => {
        this.workbook.revision();
        this.workbook.fx.calendarYear();
        return this.workbook.fx.dayLabels();
    });

    add(): void {
        const series = this.workbook.fx.addCurrency(this.newCode(), this.newName());
        if (series) {
            this.selectedCode.set(series.code);
            this.newCode.set('');
            this.newName.set('');
            this.workbook.persistFx();
        }
    }

    remove(code: string): void {
        if (!confirm(`Währung ${code} und alle Kurse löschen?`)) {
            return;
        }
        this.workbook.fx.removeCurrency(code);
        this.selectedCode.set(this.workbook.fx.currencies()[0]?.code || '');
        this.workbook.persistFx();
    }

    select(code: string): void {
        this.selectedCode.set(code);
    }

    onRate(dayIndex: number, event: Event): void {
        const series = this.selected();
        if (!series) {
            return;
        }
        this.workbook.fx.setRateFromInput(series.code, dayIndex, (event.target as HTMLInputElement).value);
        this.workbook.persistFx();
    }

    onName(event: Event): void {
        const series = this.selected();
        if (!series) {
            return;
        }
        this.workbook.fx.renameCurrency(series.code, (event.target as HTMLInputElement).value);
        this.workbook.persistFx();
    }

    effective(dayIndex: number): number {
        const series = this.selected();
        if (!series) {
            return 1;
        }
        return fillForwardRate(series.rates, dayIndex);
    }

    rateText(dayIndex: number): string {
        const series = this.selected();
        const value = series?.rates[dayIndex];
        return value == null ? '' : String(value);
    }
}
