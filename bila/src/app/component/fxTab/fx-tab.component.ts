import {Component, computed, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {WorkbookService} from '../../service/workbook.service';
import {fillForwardRate, formatFxAmount, parseFxPasteRates} from '../../model/CurrencyFx';


@Component({
    selector: 'bal-fx-tab',
    standalone: true,
    imports: [FormsModule],
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

    /**
     * Excel Ctrl/Cmd+V: paste a rate column from the focused day (or day 0).
     * Single-cell paste (Excel often adds a trailing newline) stays native.
     * TSV / multi-line pastes write via setRatesFromPaste.
     */
    onPaste(event: ClipboardEvent): void {
        const series = this.selected();
        if (!series) {
            return;
        }
        const clip = event.clipboardData?.getData('text/plain') ?? '';
        const rates = parseFxPasteRates(clip);
        if (!rates.length) {
            return;
        }
        const active = document.activeElement as HTMLElement | null;
        const focusedRate = active?.classList?.contains('rate-input') ? active : null;
        const hasTab = clip.includes('\t');
        // Excel single-cell copy is often "0.95\n" — still one rate → native input paste.
        if (rates.length === 1 && focusedRate && !hasTab) {
            return;
        }

        event.preventDefault();
        let start = 0;
        if (focusedRate) {
            const attr = focusedRate.getAttribute('data-day-index');
            const parsed = attr != null ? Number(attr) : NaN;
            if (Number.isFinite(parsed) && parsed >= 0) {
                start = parsed;
            }
        }
        this.workbook.fx.setRatesFromPaste(series.code, start, rates);
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

    onFractionDigits(event: Event): void {
        const series = this.selected();
        if (!series) {
            return;
        }
        const value = Number((event.target as HTMLInputElement).value);
        this.workbook.fx.setFractionDigits(series.code, value);
        this.workbook.persistFx();
    }

    effectiveText(dayIndex: number): string {
        const series = this.selected();
        if (!series) {
            return '';
        }
        return formatFxAmount(this.effective(dayIndex), series.fractionDigits);
    }

}
