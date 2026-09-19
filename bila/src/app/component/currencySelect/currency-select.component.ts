import {Component, inject} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {WorkbookService} from '../../service/workbook.service';
import {BASE_CURRENCY} from '../../model/CurrencyFx';

@Component({
    selector: 'bal-currency-select',
    standalone: true,
    imports: [FormsModule],
    template: `
        <label class="fx-select" title="Anzeigewährung — Beträge aus CHF mit Tageskurs umrechnen (Fill-Forward; vor erstem Kurs 1:1)">
            <span>Währung</span>
            <select [ngModel]="workbook.fx.displayCurrency()"
                    (ngModelChange)="onChange($event)">
                @for (code of workbook.fx.codes(); track code) {
                    <option [value]="code">{{ code }}</option>
                }
            </select>
        </label>
    `,
    styles: [`
        .fx-select {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-size: 12px;
            color: #334155;
            background: #fff;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            padding: 4px 8px;
        }
        .fx-select span { font-weight: 600; }
        .fx-select select {
            border: 0;
            background: transparent;
            font-weight: 700;
            color: #0f172a;
            cursor: pointer;
        }
    `]
})
export class CurrencySelectComponent {
    readonly workbook = inject(WorkbookService);
    readonly base = BASE_CURRENCY;

    onChange(code: string): void {
        this.workbook.fx.setDisplayCurrency(code);
        this.workbook.persistFx();
    }
}
