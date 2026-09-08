import {Component, inject, Input} from '@angular/core';
import {RouterLink, RouterLinkActive} from '@angular/router';
import {ToolbarModule} from 'primeng/toolbar';
import {ButtonModule} from 'primeng/button';
import {WorkbookService} from '../../service/workbook.service';
import {SettingsDialogComponent} from '../settingsDialog/settings-dialog.component';

@Component({
    selector: 'bal-toolbar',
    standalone: true,
    imports: [
        RouterLink,
        RouterLinkActive,
        ToolbarModule,
        ButtonModule,
        SettingsDialogComponent
    ],
    templateUrl: './toolbar.component.html',
    styleUrl: './toolbar.component.css'
})
export class ToolbarComponent {
    @Input() title: string = 'Bilanz';
    private readonly workbook = inject(WorkbookService);

    openSettings(): void {
        this.workbook.openSettings();
    }
}
