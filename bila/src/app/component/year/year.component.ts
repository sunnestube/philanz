import {ChangeDetectionStrategy, Component, DestroyRef, effect, inject, OnDestroy, OnInit, signal, untracked} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {ActivatedRoute, Router} from '@angular/router';
import {MonthComponent} from '../month/month.component';
import {Month} from '../../model/Month';
import {MonthRow} from '../../model/MonthRow';
import {CELL_TYPE} from '../../model/CellType';
import {ImportComponent} from '../import/import.component';
import {WorkbookService, YearView} from '../../service/workbook.service';
import {applyColumnFills} from '../../service/column-fill';
import {YearArchiveService, YearMeta} from '../../service/year-archive.service';
import {SaldoPanelComponent} from '../saldoPanel/saldo-panel.component';
import {StartTabComponent} from '../startTab/start-tab.component';
import {ConstantsTabComponent} from '../constantsTab/constants-tab.component';
import {YearTotalComponent} from '../yearTotal/year-total.component';
import {YearGrafComponent} from '../yearGraf/year-graf.component';
import {YearTabsComponent} from './year-tabs.component';
import {FxTabComponent} from '../fxTab/fx-tab.component';
import {YearAutosave} from './year-autosave';

const MIN_ROWS = 36;

@Component({
    templateUrl: './year.component.html',
    imports: [
        MonthComponent,
        ImportComponent,
        SaldoPanelComponent,
        StartTabComponent,
        ConstantsTabComponent,
        YearTotalComponent,
        YearGrafComponent,
        YearTabsComponent,
        FxTabComponent
    ],
    styleUrls: ['./year.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class YearComponent implements OnInit, OnDestroy {
    readonly workbook = inject(WorkbookService);
    readonly archive = inject(YearArchiveService);
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly destroyRef = inject(DestroyRef);
    saveMessage = '';
    yearName = '';
    /** Visible when applyCsv/fillRows fails for a year switch. */
    readonly loadError = signal('');
    warmGen = 0;
    private readonly warmedMonths = new Set<string>();
    private readonly warmedViews = new Set<YearView>();
    private warmTimer = 0;
    /** Reentrancy guard for singleton workbook applyCsv. */
    private yearLoadBusy = false;
    private pendingYearId: string | null = null;
    /** Revision last written to archive (issue #31 dirty check). */
    private savedRevision = 0;
    private detachAutosave: (() => void) | null = null;
    private readonly autosave = new YearAutosave({
        isDirty: () => this.isDirty(),
        persistDirty: () => this.persistDirtyYear()
    });

    constructor() {
        effect(() => {
            this.workbook.revision();
            untracked(() => this.autosave.schedule());
        });
    }

    ngOnInit(): void {
        this.ensureSaldoColumns();
        this.yearName = this.archive.suggestedName();
        this.syncCalendarYear();
        this.detachAutosave = this.autosave.attachDocument();
        this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
            const id = params.get('id');
            if (!id) {
                const active = this.archive.activeId();
                if (active && this.archive.csvOf(active)) {
                    void this.router.navigate(['/year', active], {replaceUrl: true});
                    return;
                }
                if (this.workbook.months().length) {
                    try {
                        this.fillRows();
                    } catch {
                        this.loadError.set('Jahr nicht lesbar');
                    }
                }
                return;
            }
            this.persistActive();
            this.loadYear(this.archive.normalize(id));
        });
    }

    years(): YearMeta[] {
        return this.archive.years();
    }

    needsImport(): boolean {
        return !this.workbook.months().length && !this.archive.years().some((item) => !!this.archive.csvOf(item.id));
    }

    protected import(months: Month[]): void {
        this.yearName = this.archive.activeId() || this.yearName;
        this.syncCalendarYear();
        this.workbook.setMonths(months);
        this.fillRows();
        const id = this.archive.activeId() || this.yearName;
        if (id && this.workbook.toCsv()) {
            this.archive.save(id, this.workbook.toCsv());
            this.markClean();
            void this.router.navigate(['/year', id], {replaceUrl: true});
        }
    }

    protected selectTab(month: Month): void {
        this.workbook.selectMonth(month);
        this.workbook.setView('month');
        this.ensureMonth(month);
        this.pruneMonthsToWindow();
        this.scheduleWarm();
    }

    protected openView(view: YearView): void {
        this.ensureView(view);
        this.workbook.setView(view);
    }

    protected isMonthReady(month: Month): boolean {
        this.warmGen;
        return this.warmedMonths.has(month.label.title);
    }

    protected isViewReady(view: YearView): boolean {
        this.warmGen;
        return this.warmedViews.has(view);
    }

    ngOnDestroy(): void {
        // Cancel debounce; pagehide/visibility already flushed year-key if needed.
        // Full save (incl. pack) only when still dirty — Angular teardown / year leave.
        this.autosave.cancel();
        this.detachAutosave?.();
        this.detachAutosave = null;
        this.persistActive();
        if (this.warmTimer) {
            clearTimeout(this.warmTimer);
            this.warmTimer = 0;
        }
    }

    private isDirty(): boolean {
        return this.workbook.revision() !== this.savedRevision;
    }

    private markClean(): void {
        this.savedRevision = this.workbook.revision();
        this.autosave.cancel();
    }

    /** Debounced / pagehide path: year key only, no pack rewrite. */
    private persistDirtyYear(): void {
        const csv = this.workbook.toCsv();
        const id = this.yearName || this.archive.activeId();
        if (!csv || !id || !this.isDirty()) {
            return;
        }
        this.archive.saveYear(id, csv);
        this.markClean();
    }

    private persistActive(): void {
        if (!this.isDirty()) {
            return;
        }
        const csv = this.workbook.toCsv();
        const id = this.yearName || this.archive.activeId();
        if (csv && id) {
            this.archive.save(id, csv);
            this.markClean();
        }
    }

    protected openYear(id: string): void {
        this.persistActive();
        void this.router.navigate(['/year', this.archive.normalize(id)]);
    }

    protected deleteYear(id: string): void {
        if (!confirm(`Jahr ${id} löschen?`)) {
            return;
        }
        this.archive.remove(id);
        if (this.yearName === id) {
            const next = this.archive.activeId();
            if (next) {
                this.openYear(next);
            }
        }
    }

    /**
     * Load archive CSV for `id` into the singleton workbook.
     * Concurrent calls queue the latest id and run after the current finish (no overlapping applyCsv).
     */
    private loadYear(id: string): void {
        if (this.yearLoadBusy) {
            this.pendingYearId = id;
            return;
        }
        this.yearLoadBusy = true;
        try {
            for (;;) {
                this.applyYearCsv(id);
                if (this.pendingYearId == null) {
                    break;
                }
                id = this.pendingYearId;
                this.pendingYearId = null;
            }
        } finally {
            this.yearLoadBusy = false;
        }
    }

    private applyYearCsv(id: string): void {
        this.archive.ensure(id);
        const previousId = this.yearName || this.archive.activeId();
        const previousCsv = this.workbook.months().length ? this.workbook.toCsv() : '';
        this.yearName = id;
        this.syncCalendarYear();
        const csv = this.archive.open(id);
        if (!csv) {
            this.loadError.set('');
            return;
        }
        try {
            this.workbook.applyCsv(csv);
            this.fillRows();
            this.loadError.set('');
        } catch {
            this.restoreAfterLoadError(id, previousId, previousCsv);
        }
    }

    private restoreAfterLoadError(failedId: string, previousId: string, previousCsv: string): void {
        try {
            if (previousCsv) {
                this.workbook.applyCsv(previousCsv);
                this.fillRows();
            } else {
                this.workbook.setMonths([]);
            }
        } catch {
            this.workbook.setMonths([]);
        }
        if (previousId && previousId !== failedId) {
            this.yearName = previousId;
            this.syncCalendarYear();
            if (this.archive.csvOf(previousId) != null) {
                this.archive.open(previousId);
            }
        }
        this.loadError.set(`Jahr ${failedId} nicht lesbar`);
    }

    private syncCalendarYear(): void {
        const match = /^(\d{4})/.exec(this.yearName || '');
        const year = match ? Number(match[1]) : new Date().getFullYear();
        this.workbook.fx.setCalendarYear(year);
    }

    private ensureSaldoColumns(): void {
        if (!this.workbook.saldoColumnsOpen()) {
            this.workbook.toggleSaldoColumns();
        }
    }

    private fillRows(min = MIN_ROWS): void {
        this.resetWarm();
        this.workbook.months().forEach((month) => {
            while (month.rows.length < min) {
                const rowIndex = month.rows.length;
                const row = new MonthRow(rowIndex, month.columns);
                row.cells.forEach((cell) => {
                    if (cell.type.id === CELL_TYPE.none) {
                        cell.raw = month.label.title;
                    }
                    if (cell.type.id === CELL_TYPE.index) {
                        cell.raw = String(rowIndex);
                    }
                });
                month.rows.push(row);
            }
        });
        applyColumnFills(this.workbook);
        this.workbook.touch();
        this.markClean();
        this.afterDataReady();
    }

    private afterDataReady(): void {
        const current = this.workbook.selectedMonth();
        if (current) {
            this.ensureMonth(current);
        }
        this.ensureView(this.workbook.view());
        this.pruneMonthsToWindow();
        this.scheduleWarm();
    }

    private resetWarm(): void {
        this.warmedMonths.clear();
        this.warmedViews.clear();
        this.warmGen++;
        if (this.warmTimer) {
            clearTimeout(this.warmTimer);
            this.warmTimer = 0;
        }
    }

    private ensureMonth(month: Month): void {
        const key = month.label.title;
        if (this.warmedMonths.has(key)) {
            return;
        }
        this.warmedMonths.add(key);
        this.warmGen++;
    }

    private ensureView(view: YearView): void {
        if (this.warmedViews.has(view)) {
            return;
        }
        this.warmedViews.add(view);
        this.warmGen++;
    }

    /** Keep at most active month ±1 mounted in the DOM. */
    private monthWindowKeys(): Set<string> {
        const months = this.workbook.months();
        const selected = this.workbook.selectedMonth();
        const keys = new Set<string>();
        if (!selected) {
            return keys;
        }
        const idx = months.indexOf(selected);
        if (idx < 0) {
            return keys;
        }
        keys.add(months[idx].label.title);
        if (idx > 0) {
            keys.add(months[idx - 1].label.title);
        }
        if (idx + 1 < months.length) {
            keys.add(months[idx + 1].label.title);
        }
        return keys;
    }

    private pruneMonthsToWindow(): void {
        const keep = this.monthWindowKeys();
        if (!keep.size) {
            return;
        }
        let removed = false;
        for (const key of [...this.warmedMonths]) {
            if (!keep.has(key)) {
                this.warmedMonths.delete(key);
                removed = true;
            }
        }
        if (removed) {
            this.warmGen++;
        }
    }

    private scheduleWarm(): void {
        if (this.warmTimer) {
            return;
        }
        this.warmTimer = window.setTimeout(() => {
            this.warmTimer = 0;
            this.warmNext();
        }, 50);
    }

    private warmNext(): void {
        const months = this.workbook.months();
        const selected = this.workbook.selectedMonth();
        const selectedIdx = selected ? months.indexOf(selected) : -1;
        // Only pre-warm neighbors (±1). Far months mount lazily on tab click.
        const order: Month[] = [];
        if (selectedIdx >= 0) {
            if (months[selectedIdx + 1]) {
                order.push(months[selectedIdx + 1]);
            }
            if (selectedIdx > 0) {
                order.push(months[selectedIdx - 1]);
            }
        }
        const pending = order.find((month) => !this.warmedMonths.has(month.label.title));
        if (pending) {
            this.ensureMonth(pending);
            this.pruneMonthsToWindow();
            this.scheduleWarm();
            return;
        }
        const extra: YearView[] = ['start', 'constants', 'fx', 'total', 'graf'];
        const nextView = extra.find((view) => !this.warmedViews.has(view));
        if (nextView) {
            this.ensureView(nextView);
            this.scheduleWarm();
        }
    }

}
