import {Component, inject, Input} from '@angular/core';
import {Router, RouterLink, RouterLinkActive} from '@angular/router';
import {ToolbarModule} from 'primeng/toolbar';
import {WorkbookService} from '../../service/workbook.service';
import {YearArchiveService, YearMeta} from '../../service/year-archive.service';
import {SettingsDialogComponent} from '../settingsDialog/settings-dialog.component';
import {installSaldoOrder} from '../../service/saldo-order';
import {APP_VERSION} from '../../version';

@Component({
    selector: 'bal-toolbar',
    standalone: true,
    imports: [
        RouterLink,
        RouterLinkActive,
        ToolbarModule,
        SettingsDialogComponent
    ],
    templateUrl: './toolbar.component.html',
    styleUrl: './toolbar.component.css'
})
export class ToolbarComponent {
    @Input() title: string = 'Bilanz';
    readonly version = APP_VERSION;
    readonly workbook = inject(WorkbookService);
    private readonly archive = inject(YearArchiveService);
    private readonly router = inject(Router);

    constructor() {
        installSaldoOrder(this.workbook);
    }

    openSettings(): void {
        this.workbook.openSettings();
    }

    onYear(): boolean {
        return this.router.url.startsWith('/year');
    }

    years(): YearMeta[] {
        const list = this.archive.years();
        if (list.length) {
            return list;
        }
        const name = this.archive.suggestedName();
        return [{id: name, name, updated: Date.now()}];
    }

    currentYear(): string {
        const fromUrl = this.router.url.match(/^\/year\/([^/?#]+)/);
        if (fromUrl?.[1]) {
            return this.archive.normalize(decodeURIComponent(fromUrl[1]));
        }
        return this.archive.activeId() || this.archive.suggestedName();
    }

    onPickYear(event: Event): void {
        const id = this.archive.normalize((event.target as HTMLSelectElement).value);
        if (!id || id === this.currentYear()) {
            return;
        }
        this.persistCurrent();
        void this.router.navigate(['/year', id]);
    }

    newYear(): void {
        const fallback = String(new Date().getFullYear());
        const typed = window.prompt('Neues Jahr', fallback);
        if (typed == null) {
            return;
        }
        const id = this.archive.normalize(typed);
        this.persistCurrent();
        this.archive.ensure(id);
        void this.router.navigate(['/year', id]);
    }

    private persistCurrent(): void {
        const csv = this.workbook.toCsv();
        const current = this.currentYear();
        if (csv && current) {
            this.archive.save(current, csv);
        }
    }
}
