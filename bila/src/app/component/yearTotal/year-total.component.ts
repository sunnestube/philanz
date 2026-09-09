import {Component, computed, ElementRef, HostListener, inject, ViewChild} from '@angular/core';
import {WorkbookService} from '../../service/workbook.service';

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
        return this.workbook.yearExpenseReport();
    });
    panning = false;
    private panX = 0;
    private panY = 0;
    private panLeft = 0;
    private panTop = 0;
    @ViewChild('scroller') scroller?: ElementRef<HTMLDivElement>;

    format(value: number): string {
        return value.toLocaleString('de-CH', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    }

    onPanStart(event: PointerEvent): void {
        const target = event.target as HTMLElement;
        if (target.closest('input, select, button, textarea, a')) {
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
        this.panning = false;
    }
}
