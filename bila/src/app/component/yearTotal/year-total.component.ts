import {Component, computed, ElementRef, HostBinding, HostListener, inject, ViewChild} from '@angular/core';
import {CELL_TYPE} from '../../model/CellType';
import {SECTION} from '../../model/Section';
import {ExpenseColumn, WorkbookService} from '../../service/workbook.service';
import {columnFillAmount} from '../../service/column-fill';

@Component({
    selector: 'bal-year-total',
    standalone: true,
    templateUrl: './year-total.component.html',
    styleUrl: './year-total.component.css'
})
export class YearTotalComponent {
    readonly workbook = inject(WorkbookService);
    readonly report = computed(() => {
        this.workbook.revision();
        return this.buildReport();
    });
    panning = false;
    private resizing = false;
    private resizeStart = 0;
    private resizeBase = 84;
    private panX = 0;
    private panY = 0;
    private panLeft = 0;
    private panTop = 0;
    @ViewChild('scroller') scroller?: ElementRef<HTMLDivElement>;

    @HostBinding('style.--title-h.px')
    get titleRowPx(): number {
        return this.workbook.headerRowHeight();
    }

    format(value: number): string {
        return value.toLocaleString('de-CH', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    }

    columnKind(title: string): string {
        const month = this.workbook.months()[0];
        const column = month?.columns.find((item) => item.title === title);
        if (!column) {
            return '';
        }
        return column.section === SECTION.EINGANG ? 'Einnahme' : 'Ausgabe';
    }

    onHeaderResizeStart(event: PointerEvent): void {
        event.preventDefault();
        event.stopPropagation();
        this.resizing = true;
        this.resizeStart = event.clientY;
        this.resizeBase = this.workbook.headerRowHeight();
        (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
    }

    onPanStart(event: PointerEvent): void {
        const target = event.target as HTMLElement;
        if (target.closest('input, select, button, textarea, a, .row-resizer')) {
            return;
        }
        const el = this.scroller?.nativeElement;
        if (!el) {
            return;
        }
        const rect = el.getBoundingClientRect();
        if (event.clientX >= rect.left + el.clientWidth - 2 || event.clientY >= rect.top + el.clientHeight - 2) {
            return;
        }
        const allowPan = event.pointerType === 'touch' || event.button === 1 || event.altKey;
        if (!allowPan) {
            return;
        }
        this.panning = true;
        this.panX = event.clientX;
        this.panY = event.clientY;
        this.panLeft = el.scrollLeft;
        this.panTop = el.scrollTop;
        el.setPointerCapture?.(event.pointerId);
        event.preventDefault();
    }

    @HostListener('document:pointermove', ['$event'])
    onPanMove(event: PointerEvent): void {
        if (this.resizing) {
            this.workbook.setHeaderRowHeight(this.resizeBase + (event.clientY - this.resizeStart), false);
            return;
        }
        if (!this.panning) {
            return;
        }
        const el = this.scroller?.nativeElement;
        if (!el) {
            return;
        }
        el.scrollLeft = this.panLeft - (event.clientX - this.panX);
        el.scrollTop = this.panTop - (event.clientY - this.panY);
    }

    @HostListener('document:pointerup')
    onPanEnd(): void {
        if (this.resizing) {
            this.workbook.setHeaderRowHeight(this.workbook.headerRowHeight());
            this.resizing = false;
        }
        this.panning = false;
    }

    private buildReport() {
        const base = this.workbook.yearExpenseReport();
        const extra = this.incomeColumns();
        if (!extra.length) {
            return base;
        }
        const months = this.workbook.months();
        const columns = [...base.columns, ...extra];
        const monthBlocks = base.months.map((block, index) => {
            const month = months[index];
            const byColumn = {...block.byColumn};
            const byPerson = {...block.byPerson};
            const personTotal = {...block.personTotal};
            extra.forEach((col) => {
                byColumn[col.title] = 0;
                base.persons.forEach((person) => {
                    byPerson[person] = {...byPerson[person], [col.title]: 0};
                });
            });
            if (!month) {
                return {...block, byColumn, byPerson, personTotal};
            }
            const personIdx = month.columns.findIndex((column) => column.type === CELL_TYPE.select_person);
            month.rows.forEach((row) => {
                const person = (row.cells[personIdx]?.raw ?? '').trim().toUpperCase();
                extra.forEach((col) => {
                    const filled = columnFillAmount(this.workbook, month, row, col.index);
                    const raw = row.cells[col.index]?.display || row.cells[col.index]?.raw || '0';
                    const parsed = Number(String(raw).replace(/['\s]/g, '').replace(',', '.'));
                    const value = filled ?? (Number.isFinite(parsed) ? parsed : 0);
                    byColumn[col.title] += value;
                    if (byPerson[person]) {
                        byPerson[person][col.title] += value;
                        personTotal[person] += value;
                    }
                });
            });
            const total = Object.values(byColumn).reduce((sum, value) => sum + value, 0);
            return {...block, byColumn, byPerson, personTotal, total};
        });
        const yearByColumn: Record<string, number> = {};
        columns.forEach((col) => {
            yearByColumn[col.title] = monthBlocks.reduce((sum, block) => sum + (block.byColumn[col.title] ?? 0), 0);
        });
        const yearExpense = base.yearExpense;
        const yearIncome = base.yearIncome;
        const divisor = Math.max(monthBlocks.length, 1);
        const monthAvgMap: Record<string, number> = {};
        const dayAvgMap: Record<string, number> = {};
        columns.forEach((col) => {
            monthAvgMap[col.title] = (yearByColumn[col.title] ?? 0) / divisor;
            dayAvgMap[col.title] = (yearByColumn[col.title] ?? 0) / 365;
        });
        return {
            ...base,
            columns,
            months: monthBlocks,
            yearExpense,
            yearIncome,
            summaryRows: [
                {label: 'Jahr', byColumn: yearByColumn, total: yearExpense + yearIncome},
                {label: 'Ø Monat', byColumn: monthAvgMap, total: (yearExpense + yearIncome) / divisor},
                {label: 'Ø Tag', byColumn: dayAvgMap, total: (yearExpense + yearIncome) / 365}
            ]
        };
    }

    private incomeColumns(): ExpenseColumn[] {
        const month = this.workbook.months()[0];
        if (!month) {
            return [];
        }
        return month.columns
            .map((column, index) => ({column, index}))
            .filter(({column}) => column.type === CELL_TYPE.number && column.section === SECTION.EINGANG)
            .map(({column, index}) => ({title: column.title, index}));
    }
}
