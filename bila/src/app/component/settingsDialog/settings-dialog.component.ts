import {Component, inject} from '@angular/core';
import {Dialog} from 'primeng/dialog';
import {WorkbookService} from '../../service/workbook.service';
import {SettingsCodesComponent} from './settings-codes.component';
import {SettingsColumnsComponent} from './settings-columns.component';
import {SettingsSaldoComponent} from './settings-saldo.component';

@Component({
    selector: 'bal-settings-dialog',
    standalone: true,
    imports: [Dialog, SettingsCodesComponent, SettingsColumnsComponent, SettingsSaldoComponent],
    templateUrl: './settings-dialog.component.html',
    styleUrl: './settings-dialog.component.css'
})
export class SettingsDialogComponent {
    readonly workbook = inject(WorkbookService);
    tab: 'person' | 'account' | 'columns' | 'saldo' = 'person';

    get visible(): boolean {
        return this.workbook.settingsOpen();
    }

    set visible(value: boolean) {
        this.workbook.settingsOpen.set(value);
    }
}
