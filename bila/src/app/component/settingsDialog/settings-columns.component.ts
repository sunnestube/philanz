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
    templateUrl: './settings-columns.component.html'
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
