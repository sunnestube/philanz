import {ElementRef, NgZone} from '@angular/core';
import {WorkbookService} from '../../service/workbook.service';

export class MonthTablePointer {
    panning = false;
    private panCandidate = false;
    private panPointer = 0;
    private panFrame = 0;
    private panX = 0;
    private panY = 0;
    private panMoveX = 0;
    private panMoveY = 0;
    private panLeft = 0;
    private panTop = 0;
    private resizeKind: 'header' | 'text' | null = null;
    private resizeStart = 0;
    private resizeBase = 0;

    constructor(
        private readonly workbook: WorkbookService,
        private readonly zone: NgZone,
        private readonly scroller: () => ElementRef<HTMLDivElement> | undefined,
        private readonly blocked: () => boolean
    ) {}

    onHeaderResizeStart(event: PointerEvent): void {
        event.preventDefault();
        event.stopPropagation();
        this.resizeKind = 'header';
        this.resizeStart = event.clientY;
        this.resizeBase = this.workbook.headerRowHeight();
        (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
    }

    onTextResizeStart(event: PointerEvent): void {
        event.preventDefault();
        event.stopPropagation();
        this.resizeKind = 'text';
        this.resizeStart = event.clientX;
        this.resizeBase = this.workbook.textColWidth();
        (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
    }

    onPanStart(event: PointerEvent): void {
        if (this.blocked()) {
            return;
        }
        if (event.pointerType === 'mouse' && event.button !== 0 && event.button !== 1) {
            return;
        }
        const target = event.target as HTMLElement;
        if (target.closest('button, textarea, a, .row-resizer, .col-resizer, [balMonthCell]')) {
            return;
        }
        const el = this.scroller()?.nativeElement;
        if (!el) {
            return;
        }
        const rect = el.getBoundingClientRect();
        const gutter = 18;
        if (event.clientX >= rect.left + el.clientWidth - gutter || event.clientY >= rect.top + el.clientHeight - gutter) {
            return;
        }
        const onField = !!target.closest('input, select');
        this.panCandidate = true;
        this.panning = false;
        this.panPointer = event.pointerId;
        this.panX = event.clientX;
        this.panY = event.clientY;
        this.panMoveX = event.clientX;
        this.panMoveY = event.clientY;
        this.panLeft = el.scrollLeft;
        this.panTop = el.scrollTop;
        if (event.button === 1 || (event.pointerType !== 'mouse' && !onField)) {
            event.preventDefault();
            this.beginPan(el, event.pointerId);
        }
    }

    onPanMove(event: PointerEvent): void {
        if (this.resizeKind) {
            event.preventDefault();
            const kind = this.resizeKind;
            const next = kind === 'header'
                ? this.resizeBase + (event.clientY - this.resizeStart)
                : this.resizeBase + (event.clientX - this.resizeStart);
            this.zone.run(() => {
                if (kind === 'header') {
                    this.workbook.setHeaderRowHeight(next, false);
                } else {
                    this.workbook.setTextColWidth(next, false);
                }
            });
            return;
        }
        if (!this.panCandidate && !this.panning) {
            return;
        }
        if (this.panPointer && event.pointerId !== this.panPointer) {
            return;
        }
        const el = this.scroller()?.nativeElement;
        if (!el) {
            return;
        }
        this.panMoveX = event.clientX;
        this.panMoveY = event.clientY;
        if (!this.panning) {
            if (Math.hypot(this.panMoveX - this.panX, this.panMoveY - this.panY) < 8) {
                return;
            }
            this.beginPan(el, event.pointerId);
        }
        event.preventDefault();
        if (this.panFrame) {
            return;
        }
        this.panFrame = requestAnimationFrame(() => {
            this.panFrame = 0;
            const box = this.scroller()?.nativeElement;
            if (!box) {
                return;
            }
            box.scrollLeft = this.panLeft - (this.panMoveX - this.panX);
            box.scrollTop = this.panTop - (this.panMoveY - this.panY);
        });
    }

    onPanEnd(): void {
        if (this.resizeKind) {
            this.workbook.setHeaderRowHeight(this.workbook.headerRowHeight());
            this.workbook.setTextColWidth(this.workbook.textColWidth());
            this.resizeKind = null;
        }
        this.scroller()?.nativeElement?.classList.remove('dragging');
        this.panCandidate = false;
        this.panning = false;
        this.panPointer = 0;
        if (this.panFrame) {
            cancelAnimationFrame(this.panFrame);
            this.panFrame = 0;
        }
    }

    destroy(): void {
        if (this.panFrame) {
            cancelAnimationFrame(this.panFrame);
        }
    }

    private beginPan(el: HTMLDivElement, pointerId: number): void {
        if (this.panning) {
            return;
        }
        this.panning = true;
        el.classList.add('dragging');
        try {
            el.setPointerCapture(pointerId);
        } catch {
            /* ignore */
        }
        const active = document.activeElement as HTMLElement | null;
        if (active && el.contains(active) && typeof active.blur === 'function') {
            active.blur();
        }
    }
}
