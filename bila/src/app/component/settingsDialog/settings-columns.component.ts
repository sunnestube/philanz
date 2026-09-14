import {Component, inject} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {Button} from 'primeng/button';
import {CELL_TYPE} from '../../model/CellType';
import {SECTION} from '../../model/Section';
import {MonthColumn} from '../../model/MonthColumn';
import {WorkbookService} from '../../service/workbook.service';

@Component({
    selector: 'bal-settings-columns',
    standalone: true,
    imports: [FormsModule, Button],
    styleUrl: './settings-dialog.component.css',
    template: `
        <p class="hint">Spalten hinzufügen, umbenennen oder entfernen. Month/Line bleiben geschützt. Formeln (=A1) starten bei Datum = A und werden mitverschoben.</p>
        <table class="col-table">
            <thead>
            <tr><th>Titel</th><th>Typ</th><th>Bereich</th><th></th></tr>
            </thead>
            <tbody>
                @for (column of columns(); track $index) {
                    <tr>
                        <td>
                            <input [ngModel]="column.title" (ngModelChange)="rename($index, $event)" [disabled]="workbook.isLockedColumn($index)"/>
                        </td>
                        <td>
                            <select [ngModel]="column.type" (ngModelChange)="changeType($index, $event)" [disabled]="workbook.isLockedColumn($index)">
                                @for (type of types; track type.id) {
                                    <option [value]="type.id">{{ type.label }}</option>
                                }
                            </select>
                        </td>
                        <td>
                            <select [ngModel]="column.section" (ngModelChange)="changeSection($index, $event)" [disabled]="workbook.isLockedColumn($index)">
                                @for (section of sections; track section.id) {
                                    <option [value]="section.id">{{ section.label }}</option>
                                }
                            </select>
                        </td>
                        <td class="col-actions">
                            @if (!workbook.isLockedColumn($index)) {
                                <button type="button" (click)="workbook.insertColumn($index)">Davor</button>
                                <button type="button" class="danger" (click)="workbook.removeColumn($index)">Entfernen</button>
                            }
                        </td>
                    </tr>
                }
            </tbody>
        </table>
        <p-button label="Spalte hinzufügen" icon="pi pi-plus" size="small" (onClick)="workbook.addColumn()"/>
    `
})
export class SettingsColumnsComponent {
    readonly workbook = inject(WorkbookService);
    readonly types = [
        {id: CELL_TYPE.number, label: 'Zahl'},
        {id: CELL_TYPE.text, label: 'Text'},
        {id: CELL_TYPE.date, label: 'Datum'},
        {id: CELL_TYPE.select_person, label: 'Person'},
        {id: CELL_TYPE.select_account, label: 'Konto'}
    ];
    readonly sections = [
        {id: SECTION.AUSGANG, label: 'Ausgang (A)'},
        {id: 'A2' as SECTION, label: 'Ausgang 2 (A2)'},
        {id: SECTION.EINGANG, label: 'Eingang (E)'},
        {id: SECTION.DEFAULT, label: 'Standard (D)'},
        {id: SECTION.SALDO, label: 'Saldo (S)'}
    ];

    columns(): MonthColumn[] {
        return this.workbook.months()[0]?.columns ?? [];
    }

    rename(index: number, title: string): void {
        this.workbook.updateColumn(index, {title});
    }

    changeType(index: number, type: string): void {
        this.workbook.updateColumn(index, {type: type as CELL_TYPE});
    }

    changeSection(index: number, section: string): void {
        this.workbook.updateColumn(index, {section: section as SECTION});
    }
}
