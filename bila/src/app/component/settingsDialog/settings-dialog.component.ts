import {Component, inject} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {Dialog} from 'primeng/dialog';
import {Button} from 'primeng/button';
import {CELL_TYPE} from '../../model/CellType';
import {SECTION} from '../../model/Section';
import {MonthColumn} from '../../model/MonthColumn';
import {WorkbookService} from '../../service/workbook.service';

@Component({
    selector: 'bal-settings-dialog',
    standalone: true,
    imports: [FormsModule, Dialog, Button],
    templateUrl: './settings-dialog.component.html',
    styleUrl: './settings-dialog.component.css'
})
export class SettingsDialogComponent {
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

    newPerson = '';
    newAccount = '';
    tab: 'person' | 'account' | 'columns' = 'person';

    get visible(): boolean {
        return this.workbook.settingsOpen();
    }

    set visible(value: boolean) {
        this.workbook.settingsOpen.set(value);
    }

    columns(): MonthColumn[] {
        return this.workbook.months()[0]?.columns ?? [];
    }

    addPerson(): void {
        const code = this.newPerson.trim().toUpperCase();
        if (!code) {
            return;
        }
        this.workbook.setOptions({
            person: [...this.workbook.persons(), code],
            account: this.workbook.accounts()
        });
        this.newPerson = '';
    }

    removePerson(code: string): void {
        this.workbook.setOptions({
            person: this.workbook.persons().filter((item) => item !== code),
            account: this.workbook.accounts()
        });
    }

    addAccount(): void {
        const code = this.newAccount.trim().toUpperCase();
        if (!code) {
            return;
        }
        this.workbook.setOptions({
            person: this.workbook.persons(),
            account: [...this.workbook.accounts(), code]
        });
        this.newAccount = '';
    }

    removeAccount(code: string): void {
        this.workbook.setOptions({
            person: this.workbook.persons(),
            account: this.workbook.accounts().filter((item) => item !== code)
        });
    }

    addColumn(): void {
        this.workbook.addColumn();
    }

    removeColumn(index: number): void {
        this.workbook.removeColumn(index);
    }

    renameColumn(index: number, title: string): void {
        this.workbook.updateColumn(index, {title});
    }

    changeType(index: number, type: string): void {
        this.workbook.updateColumn(index, {type: type as CELL_TYPE});
    }

    changeSection(index: number, section: string): void {
        this.workbook.updateColumn(index, {section: section as SECTION});
    }
}
