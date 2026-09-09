import {Component, inject, Input} from '@angular/core';
import {Router, RouterLink, RouterLinkActive} from '@angular/router';
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
    readonly workbook = inject(WorkbookService);
    private readonly router = inject(Router);

    openSettings(): void {
        this.workbook.openSettings();
    }

    onYear(): boolean {
        return this.router.url.startsWith('/year');
    }
}
