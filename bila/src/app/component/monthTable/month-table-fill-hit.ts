/**
 * Fill-drag hit helpers — scroll geometry when the target td is outside the virt DOM.
 * ROW_HEIGHT must match `.data-table tbody tr { height }` / monthTable.ts.
 */

export const FILL_ROW_HEIGHT = 18;
/** Sticky letter-row height; title row uses --title-h (workbook.headerRowHeight). */
export const FILL_LETTER_ROW_HEIGHT = 14;
/** Proximity to `.table-scroll` edge that triggers auto-scroll during fill. */
export const FILL_EDGE_PX = 28;
/** Pixels scrolled per animation frame while the pointer stays in the edge band. */
export const FILL_SCROLL_PX = 18;

/** Map pointer Y inside the scroller to a data-row index (0-based), clamped. */
export function rowFromScroll(
    scrollTop: number,
    pointerYInScroller: number,
    headerHeight: number,
    rowHeight: number,
    rowCount: number
): number | null {
    if (rowCount <= 0 || rowHeight <= 0) {
        return null;
    }
    const bodyY = scrollTop + pointerYInScroller - headerHeight;
    if (!Number.isFinite(bodyY)) {
        return null;
    }
    const row = Math.floor(bodyY / rowHeight);
    if (row < 0) {
        return 0;
    }
    return Math.min(row, rowCount - 1);
}

/** Map pointer X inside the scroller to a column index via cumulative widths. */
export function colFromOffsets(
    scrollLeft: number,
    pointerXInScroller: number,
    colWidths: number[]
): number | null {
    if (!colWidths.length) {
        return null;
    }
    const x = scrollLeft + pointerXInScroller;
    if (!Number.isFinite(x)) {
        return null;
    }
    if (x < 0) {
        return 0;
    }
    let acc = 0;
    for (let i = 0; i < colWidths.length; i++) {
        acc += colWidths[i];
        if (x < acc) {
            return i;
        }
    }
    return colWidths.length - 1;
}

/** Scroll delta when the pointer sits in the edge band of the scroller rect. */
export function edgeScrollDelta(
    clientX: number,
    clientY: number,
    rect: {top: number; bottom: number; left: number; right: number},
    edgePx: number,
    stepPx: number
): {dx: number; dy: number} {
    let dx = 0;
    let dy = 0;
    if (clientY > rect.bottom - edgePx) {
        dy = stepPx;
    } else if (clientY < rect.top + edgePx) {
        dy = -stepPx;
    }
    if (clientX > rect.right - edgePx) {
        dx = stepPx;
    } else if (clientX < rect.left + edgePx) {
        dx = -stepPx;
    }
    return {dx, dy};
}
