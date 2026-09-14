import {Component, inject} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {WorkbookService} from '../../service/workbook.service';

@Component({
    selector: 'bal-settings-saldo',
    standalone: true,
    imports: [FormsModule],
    styleUrl: './settings-dialog.component.css',
    template: `
        <p class="hint">Virtuelle Saldospalten. Ohne eigenen Titel gilt Personname + Kontoname.</p>
        <table class="col-table">
            <thead>
            <tr><th>Anzeigen</th><th>Titel</th><th>Gruppe</th></tr>
            </thead>
            <tbody>
                @for (combo of workbook.saldoCombos(); track combo.key) {
                    <tr>
                        <td>
                            <input type="checkbox"
                                   [checked]="visible(combo.key)"
                                   (change)="workbook.setSaldoColumnPref(combo.key, {visible: $any($event.target).checked})"/>
                        </td>
                        <td>
                            <input [ngModel]="title(combo.key, workbook.saldoTitleFor(combo))"
                                   (ngModelChange)="workbook.setSaldoColumnPref(combo.key, {title: $event})"/>
                        </td>
                        <td>{{ workbook.personLabel(combo.person) }} · {{ workbook.accountLabel(combo.account) }}</td>
                    </tr>
                }
                <tr>
                    <td>
                        <input type="checkbox"
                               [checked]="workbook.saldoTotalPref().visible"
                               (change)="workbook.setSaldoTotalPref({visible: $any($event.target).checked})"/>
                    </td>
                    <td>
                        <input [ngModel]="workbook.saldoTotalPref().title"
                               (ngModelChange)="workbook.setSaldoTotalPref({title: $event})"/>
                    </td>
                    <td>Total</td>
                </tr>
            </tbody>
        </table>
    `
})
export class SettingsSaldoComponent {
    readonly workbook = inject(WorkbookService);

    visible(key: string): boolean {
        return this.workbook.saldoColumnPrefs()[key]?.visible !== false;
    }

    title(key: string, fallback: string): string {
        return this.workbook.saldoColumnPrefs()[key]?.title || fallback;
    }
}
