import {Component, ElementRef, HostListener, inject, Input, signal, ViewChild} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {NavigationEnd, Router, RouterLink, RouterLinkActive} from '@angular/router';
import {ToolbarModule} from 'primeng/toolbar';
import {filter} from 'rxjs/operators';
import {WorkbookService} from '../../service/workbook.service';
import {YearArchiveService, YearMeta} from '../../service/year-archive.service';
import {SettingsDialogComponent} from '../settingsDialog/settings-dialog.component';
import {installSaldoOrder} from '../../service/saldo-order';

/**
 * Overflow strategy (issue #46): CSS breakpoint max-width 640px.
 * Below that, primary route links (.nav-link) hide and the burger opens
 * a panel with the same routerLinks. Year select/+ stay in the bar.
 * Horizontal scroll is no longer the only mobile nav solution.
 */
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
    readonly workbook = inject(WorkbookService);
    private readonly archive = inject(YearArchiveService);
    private readonly router = inject(Router);

    readonly menuOpen = signal(false);

    @ViewChild('burgerBtn') burgerBtn?: ElementRef<HTMLButtonElement>;

    constructor() {
        installSaldoOrder(this.workbook);
        this.router.events.pipe(
            filter((e): e is NavigationEnd => e instanceof NavigationEnd),
            takeUntilDestroyed()
        ).subscribe(() => this.closeMenu(false));
    }

    openSettings(): void {
        this.workbook.openSettings();
    }

    onYear(): boolean {
        return this.router.url.startsWith('/year')
            || this.router.url.startsWith('/pack')
            || this.router.url.startsWith('/set');
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
        this.archive.open(id);
        if (this.router.url.startsWith('/year')) {
            void this.router.navigate(['/year', id]);
        }
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

    toggleMenu(): void {
        if (this.menuOpen()) {
            this.closeMenu(true);
        } else {
            this.menuOpen.set(true);
        }
    }

    closeMenu(restoreFocus: boolean): void {
        if (!this.menuOpen()) {
            return;
        }
        this.menuOpen.set(false);
        if (restoreFocus) {
            queueMicrotask(() => this.burgerBtn?.nativeElement.focus());
        }
    }

    onMenuNav(): void {
        this.closeMenu(false);
    }

    @HostListener('document:keydown.escape')
    onEscape(): void {
        if (this.menuOpen()) {
            this.closeMenu(true);
        }
    }

    private persistCurrent(): void {
        const csv = this.workbook.toCsv();
        const current = this.currentYear();
        if (csv && current) {
            this.archive.save(current, csv);
        }
    }
}
