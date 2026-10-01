import {ChangeDetectorRef, ElementRef, NgZone} from '@angular/core';
import {WorkbookService} from '../../service/workbook.service';
import {Month} from '../../model/Month';
import {
    FILL_EDGE_PX,
    FILL_LETTER_ROW_HEIGHT,
    FILL_ROW_HEIGHT,
    FILL_SCROLL_PX,
    colFromOffsets,
    edgeScrollDelta,
    rowFromScroll
} from './month-table-fill-hit';

type RangeLike = {
    reset(row: number, col: number): void;
    extend(row: number, col: number): void;
    dragging: boolean;
    anchorRow: number;
    anchorCol: number;
};

type EditLike = {
    range: RangeLike;
    fillRange(fromRow: number, fromCol: number, toRow: number, toCol: number): void;
};

/**
 * Fill-handle drag session: scroll-geometry hit-test + edge auto-scroll (#29).
 */
export class MonthTableFillDrag {
    active = false;
    private from: {row: number; col: number} | null = null;
    private to: {row: number; col: number} | null = null;
    private pointer: PointerEvent | null = null;
    private edgeFrame = 0;

    constructor(
        private readonly workbook: WorkbookService,
        private readonly zone: NgZone,
        private readonly cdr: ChangeDetectorRef,
        private readonly edit: EditLike,
        private readonly scrollerOf: () => ElementRef<HTMLDivElement> | undefined,
        private readonly monthOf: () => Month | undefined,
        private readonly ensureRowVisible: (row: number) => void,
        private readonly syncViewFromScroll: (force?: boolean) => void
    ) {}

    start(event: PointerEvent, rowIndex: number, colIndex: number): void {
        event.preventDefault();
        event.stopPropagation();
        this.active = true;
        this.pointer = event;
        this.from = {row: rowIndex, col: colIndex};
        this.to = {row: rowIndex, col: colIndex};
        this.edit.range.reset(rowIndex, colIndex);
        this.edit.range.dragging = true;
        this.cdr.markForCheck();
    }

    move(event: PointerEvent): void {
        this.pointer = event;
        this.tickEdgeScroll();
        this.applyHit(event);
    }

    commit(): void {
        const from = this.from;
        const to = this.to;
        this.active = false;
        this.from = null;
        this.to = null;
        this.stopEdgeScroll();
        this.edit.range.dragging = false;
        if (!from || !to || (from.row === to.row && from.col === to.col)) {
            this.cdr.markForCheck();
            return;
        }
        this.zone.run(() => {
            this.edit.fillRange(from.row, from.col, to.row, to.col);
            this.edit.range.reset(from.row, from.col);
            this.cdr.markForCheck();
        });
    }

    abort(): void {
        this.active = false;
        this.from = null;
        this.to = null;
        this.edit.range.dragging = false;
        this.stopEdgeScroll();
    }

    destroy(): void {
        this.stopEdgeScroll();
    }

    private applyHit(event: PointerEvent): void {
        const hit = this.hitCell(event);
        if (!hit || !this.from) {
            return;
        }
        if (this.to && this.to.row === hit.row && this.to.col === hit.col) {
            return;
        }
        this.to = hit;
        this.zone.run(() => {
            this.edit.range.anchorRow = this.from!.row;
            this.edit.range.anchorCol = this.from!.col;
            this.edit.range.extend(hit.row, hit.col);
            this.edit.range.dragging = true;
            this.ensureRowVisible(hit.row);
            this.cdr.markForCheck();
        });
    }

    private tickEdgeScroll(): void {
        const scroller = this.scrollerOf()?.nativeElement;
        const pointer = this.pointer;
        if (!scroller || !pointer || !this.active) {
            return;
        }
        const rect = scroller.getBoundingClientRect();
        const {dx, dy} = edgeScrollDelta(
            pointer.clientX,
            pointer.clientY,
            rect,
            FILL_EDGE_PX,
            FILL_SCROLL_PX
        );
        if (!dx && !dy) {
            return;
        }
        const prevTop = scroller.scrollTop;
        const prevLeft = scroller.scrollLeft;
        scroller.scrollTop = prevTop + dy;
        scroller.scrollLeft = prevLeft + dx;
        if (scroller.scrollTop === prevTop && scroller.scrollLeft === prevLeft) {
            return;
        }
        this.syncViewFromScroll(true);
        if (this.edgeFrame) {
            return;
        }
        this.edgeFrame = requestAnimationFrame(() => {
            this.edgeFrame = 0;
            if (!this.active || !this.pointer) {
                return;
            }
            this.tickEdgeScroll();
            this.applyHit(this.pointer);
        });
    }

    private stopEdgeScroll(): void {
        if (this.edgeFrame) {
            cancelAnimationFrame(this.edgeFrame);
            this.edgeFrame = 0;
        }
        this.pointer = null;
    }

    private hitCell(event: PointerEvent): {row: number; col: number} | null {
        const el = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
        const td = el?.closest?.('td[data-row]') as HTMLElement | null;
        if (td?.dataset?.['row'] != null && td.dataset['col'] != null) {
            const row = Number(td.dataset['row']);
            const col = Number(td.dataset['col']);
            if (Number.isFinite(row) && Number.isFinite(col)) {
                return {row, col};
            }
        }
        return this.hitCellFromScroll(event);
    }

    private hitCellFromScroll(event: PointerEvent): {row: number; col: number} | null {
        const scroller = this.scrollerOf()?.nativeElement;
        const month = this.monthOf();
        if (!scroller || !month) {
            return null;
        }
        const rect = scroller.getBoundingClientRect();
        const y = event.clientY - rect.top;
        const x = event.clientX - rect.left;
        const header = scroller.querySelector('thead') as HTMLElement | null;
        const headerH = header?.offsetHeight
            ?? (FILL_LETTER_ROW_HEIGHT + this.workbook.headerRowHeight());
        const row = rowFromScroll(
            scroller.scrollTop,
            y,
            headerH,
            FILL_ROW_HEIGHT,
            month.rows.length
        );
        if (row == null) {
            return null;
        }
        const widths = this.dataColWidths();
        let col = colFromOffsets(scroller.scrollLeft, x, widths);
        if (col == null) {
            col = this.to?.col ?? this.from?.col ?? null;
        }
        if (col == null) {
            return null;
        }
        return {row, col};
    }

    private dataColWidths(): number[] {
        const scroller = this.scrollerOf()?.nativeElement;
        const colCount = this.monthOf()?.columns.length ?? 0;
        if (!scroller || colCount <= 0) {
            return [];
        }
        const row = scroller.querySelector('tbody tr:not(.virt-pad)');
        if (row) {
            const tds = row.querySelectorAll('td[data-col]');
            if (tds.length) {
                return Array.from(tds, (td) => (td as HTMLElement).offsetWidth);
            }
        }
        const ths = scroller.querySelectorAll('thead tr.letter-row th');
        const widths: number[] = [];
        for (let i = 0; i < colCount && i < ths.length; i++) {
            widths.push((ths[i] as HTMLElement).offsetWidth);
        }
        return widths;
    }
}
