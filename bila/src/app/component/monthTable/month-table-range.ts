import {Month} from '../../model/Month';
import {FormulaService} from '../../service/formula.service';
import {TableNavigationService} from '../../service/tableNavigation.service';

export class MonthTableRange {
    anchorRow = 0;
    anchorCol = 0;
    focusRow = 0;
    focusCol = 0;
    dragging = false;
    copyRow = 0;
    copyCol = 0;

    constructor(private readonly formula: FormulaService) {}

    reset(row: number, col: number): void {
        this.anchorRow = row;
        this.anchorCol = col;
        this.focusRow = row;
        this.focusCol = col;
        this.dragging = false;
    }

    extend(row: number, col: number): void {
        this.focusRow = row;
        this.focusCol = col;
    }

    get row0(): number {
        return Math.min(this.anchorRow, this.focusRow);
    }

    get row1(): number {
        return Math.max(this.anchorRow, this.focusRow);
    }

    get col0(): number {
        return Math.min(this.anchorCol, this.focusCol);
    }

    get col1(): number {
        return Math.max(this.anchorCol, this.focusCol);
    }

    contains(row: number, col: number): boolean {
        return row >= this.row0 && row <= this.row1 && col >= this.col0 && col <= this.col1;
    }

    multi(): boolean {
        return this.row0 !== this.row1 || this.col0 !== this.col1;
    }

    step(month: Month | undefined, row: number, col: number, key: string): {row: number; col: number} {
        return this.move(month, row, col, key, false);
    }

    jump(month: Month | undefined, row: number, col: number, key: string): {row: number; col: number} {
        return this.move(month, row, col, key, true);
    }

    copyTsv(month: Month | undefined): string {
        if (!month) {
            return '';
        }
        this.copyRow = this.row0;
        this.copyCol = this.col0;
        const lines: string[] = [];
        for (let row = this.row0; row <= this.row1; row++) {
            const cells: string[] = [];
            for (let col = this.col0; col <= this.col1; col++) {
                const raw = month.rows[row]?.cells[col]?.raw ?? '';
                this.formula.copyFormula(raw, col, row);
                cells.push(raw);
            }
            lines.push(cells.join('\t'));
        }
        return lines.join('\n');
    }

    focusCell(monthTitle: string, row: number, col: number): void {
        document.getElementById(TableNavigationService.cellId(monthTitle, row, col))?.focus();
    }

    private move(
        month: Month | undefined,
        row: number,
        col: number,
        key: string,
        toEdge: boolean
    ): {row: number; col: number} {
        const lastRow = Math.max(0, (month?.rows.length ?? 1) - 1);
        const lastCol = Math.max(0, (month?.columns.length ?? 1) - 1);
        const delta = {ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1]}[key];
        if (!delta) {
            return {row, col};
        }
        const [dr, dc] = delta;
        if (!toEdge) {
            return {
                row: clamp(row + dr, 0, lastRow),
                col: clamp(col + dc, 0, lastCol)
            };
        }
        const empty = (r: number, c: number) => !(month?.rows[r]?.cells[c]?.raw ?? '').trim();
        const inside = (r: number, c: number) => r >= 0 && r <= lastRow && c >= 0 && c <= lastCol;
        let nextRow = row + dr;
        let nextCol = col + dc;
        if (!inside(nextRow, nextCol)) {
            return {row, col};
        }
        if (empty(nextRow, nextCol)) {
            while (inside(nextRow + dr, nextCol + dc) && empty(nextRow, nextCol)) {
                nextRow += dr;
                nextCol += dc;
            }
            return {row: nextRow, col: nextCol};
        }
        while (inside(nextRow + dr, nextCol + dc) && !empty(nextRow + dr, nextCol + dc)) {
            nextRow += dr;
            nextCol += dc;
        }
        return {row: nextRow, col: nextCol};
    }
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}
