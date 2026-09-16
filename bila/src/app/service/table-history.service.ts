import {Injectable} from '@angular/core';
import {Month} from '../model/Month';
import {CELL_TYPE} from '../model/CellType';

/** Inverse-diff snapshot of one cell (raw only; display/error come from recalc). */
export interface CellPatch {
    row: number;
    col: number;
    raw: string;
}

export interface RowColorPatch {
    row: number;
    color: string;
}

/** One undoable mutation for a single month (PO: current-month stack). */
export interface HistoryCommand {
    monthTitle: string;
    before: CellPatch[];
    after: CellPatch[];
    beforeColors: RowColorPatch[];
    afterColors: RowColorPatch[];
}

interface MonthStack {
    undo: HistoryCommand[];
    redo: HistoryCommand[];
}

/**
 * Command / inverse-diff history for the month table.
 * Depth capped at {@link TableHistoryService.MAX_DEPTH} entries per month.
 */
@Injectable({
    providedIn: 'root'
})
export class TableHistoryService {
    /** Sensible Excel-like depth without unbounded memory growth. */
    static readonly MAX_DEPTH = 50;

    private readonly stacks = new Map<string, MonthStack>();

    canUndo(monthTitle: string): boolean {
        return (this.stacks.get(monthTitle)?.undo.length ?? 0) > 0;
    }

    canRedo(monthTitle: string): boolean {
        return (this.stacks.get(monthTitle)?.redo.length ?? 0) > 0;
    }

    clear(monthTitle?: string): void {
        if (monthTitle) {
            this.stacks.delete(monthTitle);
            return;
        }
        this.stacks.clear();
    }

    captureCells(month: Month, coords: Array<{row: number; col: number}>): CellPatch[] {
        const seen = new Set<string>();
        const patches: CellPatch[] = [];
        for (const {row, col} of coords) {
            const key = `${row}:${col}`;
            if (seen.has(key)) {
                continue;
            }
            seen.add(key);
            const cell = month.rows[row]?.cells[col];
            if (!cell || cell.type.id === CELL_TYPE.none || cell.type.id === CELL_TYPE.index) {
                continue;
            }
            patches.push({row, col, raw: cell.raw ?? ''});
        }
        return patches;
    }

    captureColors(month: Month, rows: number[]): RowColorPatch[] {
        const seen = new Set<number>();
        const patches: RowColorPatch[] = [];
        for (const row of rows) {
            if (seen.has(row)) {
                continue;
            }
            seen.add(row);
            const line = month.rows[row];
            if (!line) {
                continue;
            }
            patches.push({row, color: line.color ?? ''});
        }
        return patches;
    }

    push(command: HistoryCommand): void {
        if (!command.before.length && !command.beforeColors.length
            && !command.after.length && !command.afterColors.length) {
            return;
        }
        if (this.samePatches(command.before, command.after)
            && this.sameColors(command.beforeColors, command.afterColors)) {
            return;
        }
        const stack = this.stackFor(command.monthTitle);
        stack.undo.push(command);
        stack.redo = [];
        while (stack.undo.length > TableHistoryService.MAX_DEPTH) {
            stack.undo.shift();
        }
    }

    /**
     * Records a mutation: captures `before`, runs `mutate`, captures `after`, pushes.
     * `coords` / `colorRows` describe the affected region (may grow inside mutate for paste-append).
     */
    record(
        month: Month,
        coords: Array<{row: number; col: number}>,
        colorRows: number[],
        mutate: () => void
    ): void {
        const before = this.captureCells(month, coords);
        const beforeColors = this.captureColors(month, colorRows);
        mutate();
        const afterCoords = coords.length
            ? coords
            : before.map((p) => ({row: p.row, col: p.col}));
        const after = this.captureCells(month, afterCoords);
        const afterColors = this.captureColors(month, colorRows.length
            ? colorRows
            : beforeColors.map((c) => c.row));
        this.push({
            monthTitle: month.label.title,
            before,
            after,
            beforeColors,
            afterColors
        });
    }

    undo(month: Month): boolean {
        const stack = this.stacks.get(month.label.title);
        const command = stack?.undo.pop();
        if (!command) {
            return false;
        }
        this.apply(month, command.before, command.beforeColors);
        stack!.redo.push(command);
        return true;
    }

    redo(month: Month): boolean {
        const stack = this.stacks.get(month.label.title);
        const command = stack?.redo.pop();
        if (!command) {
            return false;
        }
        this.apply(month, command.after, command.afterColors);
        stack!.undo.push(command);
        return true;
    }

    apply(month: Month, cells: CellPatch[], colors: RowColorPatch[]): void {
        for (const patch of cells) {
            const cell = month.rows[patch.row]?.cells[patch.col];
            if (!cell) {
                continue;
            }
            cell.raw = patch.raw;
            cell.display = '';
            cell.error = null;
            if (cell.type.id.indexOf('select') !== -1) {
                cell.value = patch.raw;
            }
        }
        for (const patch of colors) {
            const line = month.rows[patch.row];
            if (line) {
                line.color = patch.color;
            }
        }
        // Re-sync person colors from person cells when color patches empty but person cells restored
        if (!colors.length) {
            const rows = new Set(cells.map((c) => c.row));
            rows.forEach((row) => month.rows[row]?.syncColor());
        }
    }

    private stackFor(monthTitle: string): MonthStack {
        let stack = this.stacks.get(monthTitle);
        if (!stack) {
            stack = {undo: [], redo: []};
            this.stacks.set(monthTitle, stack);
        }
        return stack;
    }

    private samePatches(a: CellPatch[], b: CellPatch[]): boolean {
        if (a.length !== b.length) {
            return false;
        }
        const map = new Map(a.map((p) => [`${p.row}:${p.col}`, p.raw]));
        return b.every((p) => map.get(`${p.row}:${p.col}`) === p.raw);
    }

    private sameColors(a: RowColorPatch[], b: RowColorPatch[]): boolean {
        if (a.length !== b.length) {
            return false;
        }
        const map = new Map(a.map((p) => [p.row, p.color]));
        return b.every((p) => map.get(p.row) === p.color);
    }
}
