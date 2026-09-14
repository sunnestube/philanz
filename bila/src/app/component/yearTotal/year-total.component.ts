import {Component, computed, ElementRef, HostBinding, HostListener, inject, ViewChild} from '@angular/core';
import {SECTION} from '../../model/Section';
import {WorkbookService} from '../../service/workbook.service';
import {buildYearTotalReport} from './year-total.report';

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
        return buildYearTotalReport(this.workbook);
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
        const column = this.workbook.months()[0]?.columns.find((item) => item.title === title);
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
        if (event.pointerType !== 'touch' && event.button !== 1 && !event.altKey) {
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
}
