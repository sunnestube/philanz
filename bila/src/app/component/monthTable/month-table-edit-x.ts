import {CELL_TYPE} from '../../model/CellType';
import {MonthCell} from '../../model/MonthCell';
import {FormulaService} from '../../service/formula.service';
import {WorkbookService} from '../../service/workbook.service';
import {Month} from '../../model/Month';
import {MonthTableEdit} from './month-table-edit';
import {MonthTableRange} from './month-table-range';

export class MonthTableEditX extends MonthTableEdit {
    readonly range: MonthTableRange;
    private skipFocusReset = false;

    constructor(
        formulaService: FormulaService,
        workbook: WorkbookService,
        private readonly monthRef: () => Month | undefined,
        focusBar: () => void,
        blurBar: () => void
    ) {
        super(formulaService, workbook, monthRef, focusBar, blurBar);
        this.range = new MonthTableRange(formulaService);
    }

    override selectCell(rowIndex: number, colIndex: number, cell: MonthCell): void {
        super.selectCell(rowIndex, colIndex, cell);
        if (this.skipFocusReset) {
            this.skipFocusReset = false;
            return;
        }
        if (!this.range.rowMode && !this.range.dragging) {
            this.range.reset(rowIndex, colIndex);
        }
    }

    override startEdit(rowIndex: number, colIndex: number, cell: MonthCell): void {
        super.startEdit(rowIndex, colIndex, cell);
        if (this.skipFocusReset) {
            this.range.extend(rowIndex, colIndex);
            this.skipFocusReset = false;
            return;
        }
        if (!this.range.rowMode) {
            this.range.reset(rowIndex, colIndex);
        }
    }

    override onCopy(event: ClipboardEvent, rowIndex: number, colIndex: number, cell: MonthCell): void {
        if (this.range.multi() || this.range.rowMode) {
            event.preventDefault();
            event.clipboardData?.setData('text/plain', this.range.copyTsv(this.monthRef()));
            return;
        }
        super.onCopy(event, rowIndex, colIndex, cell);
    }

    override onPaste(event: ClipboardEvent, rowIndex: number, colIndex: number, cell: MonthCell): void {
        const clip = event.clipboardData?.getData('text/plain') ?? '';
        const grid = this.parseClipboardGrid(clip);
        const block = grid.length > 1 || (grid[0]?.length ?? 0) > 1;
        if (block && (this.range.rowMode || this.isIndexCol(colIndex))) {
            event.preventDefault();
            this.pasteGrid(grid, rowIndex, this.range.copyCol, clip);
            return;
        }
        super.onPaste(event, rowIndex, colIndex, cell);
    }

    override onKeydown(event: KeyboardEvent, rowIndex: number, colIndex: number, cell: MonthCell): void {
        if (this.handleHistoryKeys(event)) {
            return;
        }
        const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
        const mod = event.ctrlKey || event.metaKey;
        // Ctrl/Cmd+A — select all editable cells (works across virtualization; data-model range).
        if (mod && event.key.toLowerCase() === 'a' && !typing) {
            event.preventDefault();
            this.selectAllEditable();
            return;
        }
        // Ctrl/Cmd+Shift+End — extend selection to last data row / last editable col.
        if (mod && event.shiftKey && event.key === 'End' && !typing) {
            event.preventDefault();
            const month = this.monthRef();
            if (month?.rows.length) {
                this.range.extend(month.rows.length - 1, this.lastCol());
                this.skipFocusReset = true;
                this.range.focusCell(month.label.title, month.rows.length - 1, this.range.col1);
            }
            return;
        }
        if (event.key === 'Delete' || (event.key === 'Backspace' && !typing)) {
            event.preventDefault();
            this.clearRange();
            return;
        }
        if (event.key === 'Home' || event.key === 'End') {
            event.preventDefault();
            const nextCol = event.key === 'Home' ? this.letterCol('A') : this.letterCol('AF');
            if (this.liveEdit) {
                this.commitEdit(cell);
            }
            if (event.shiftKey) {
                this.range.extend(rowIndex, nextCol);
                this.skipFocusReset = true;
            } else {
                this.range.reset(rowIndex, nextCol);
            }
            this.range.focusCell(this.monthRef()?.label.title ?? '', rowIndex, nextCol);
            return;
        }
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)
            && (event.shiftKey || event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            const from = this.range;
            const next = (event.ctrlKey || event.metaKey)
                ? from.jump(this.monthRef(), from.focusRow, from.focusCol, event.key)
                : from.step(this.monthRef(), from.focusRow, from.focusCol, event.key);
            if (event.shiftKey) {
                if (from.rowMode) {
                    from.selectRows(next.row, this.lastCol(), true);
                } else {
                    from.extend(next.row, next.col);
                }
                this.skipFocusReset = true;
            } else {
                this.commitEdit(cell);
                from.reset(next.row, next.col);
            }
            from.focusCell(this.monthRef()?.label.title ?? '', next.row, next.col);
            return;
        }
        super.onKeydown(event, rowIndex, colIndex, cell);
    }

    override onCellMouseDown(event: MouseEvent, rowIndex: number, colIndex: number): void {
        if (this.isIndexCol(colIndex)) {
            event.preventDefault();
            this.range.selectRows(rowIndex, this.lastCol(), event.shiftKey);
            return;
        }
        if (!this.refPickMode) {
            if (event.shiftKey) {
                event.preventDefault();
                this.range.extend(rowIndex, colIndex);
            } else {
                this.range.reset(rowIndex, colIndex);
            }
            this.range.dragging = true;
            return;
        }
        super.onCellMouseDown(event, rowIndex, colIndex);
    }

    onCellEnter(rowIndex: number, colIndex: number): void {
        if (!this.range.dragging || this.refPickMode) {
            return;
        }
        if (this.range.rowMode) {
            this.range.selectRows(rowIndex, this.lastCol(), true);
            return;
        }
        this.range.extend(rowIndex, colIndex);
    }

    endDrag(): void {
        this.range.dragging = false;
    }

    inRange(rowIndex: number, colIndex: number): boolean {
        return this.range.contains(rowIndex, colIndex);
    }

    private lastCol(): number {
        return Math.max(0, (this.monthRef()?.columns.length ?? 1) - 1);
    }

    private isIndexCol(colIndex: number): boolean {
        return this.monthRef()?.columns[colIndex]?.type === CELL_TYPE.index;
    }

    private letterCol(letter: string): number {
        const columns = this.monthRef()?.columns ?? [];
        const raw = this.formulaRawIndex(letter, columns);
        if (raw >= 0 && raw < columns.length) {
            const type = columns[raw]?.type;
            if (type && type !== CELL_TYPE.none && type !== CELL_TYPE.index) {
                return raw;
            }
        }
        let last = 0;
        for (let i = 0; i < columns.length; i++) {
            const type = columns[i]?.type;
            if (type && type !== CELL_TYPE.none && type !== CELL_TYPE.index) {
                if (letter.toUpperCase() === 'A') {
                    return i;
                }
                last = i;
            }
        }
        return last;
    }

    private formulaRawIndex(letter: string, columns: Array<{type: string}>): number {
        const visible = this.lettersToVisible(letter);
        let count = 0;
        for (let i = 0; i < columns.length; i++) {
            const type = columns[i]?.type;
            if (type && type !== CELL_TYPE.none && type !== CELL_TYPE.index) {
                if (count === visible) {
                    return i;
                }
                count++;
            }
        }
        return visible;
    }

    private lettersToVisible(letters: string): number {
        let n = 0;
        for (const ch of letters.toUpperCase()) {
            n = n * 26 + (ch.charCodeAt(0) - 64);
        }
        return n - 1;
    }

    /** Select every editable cell in the month (ignores virtualization window). */
    selectAllEditable(): void {
        const month = this.monthRef();
        if (!month?.rows.length) {
            return;
        }
        this.range.reset(0, 0);
        this.range.extend(month.rows.length - 1, this.lastCol());
        this.range.rowMode = true;
        this.skipFocusReset = true;
        this.range.focusCell(month.label.title, this.range.row0, this.range.col0);
    }

    /**
     * Clear the selected range on the data model (not the DOM).
     * Virtualization must not skip off-screen rows — we iterate range.row0..row1 on month.rows.
     * Coords are pre-computed so history.record snapshots once (avoids per-cell push listener thrash
     * on ~120-row clears that previously tripped MaxListenersExceededWarning paths).
     * Entire clear is one history.record undo step.
     */
    private clearRange(): void {
        const month = this.monthRef();
        if (!month) {
            return;
        }
        const row0 = this.range.row0;
        const row1 = this.range.row1;
        const col0 = this.range.col0;
        const col1 = this.range.col1;
        const coords: Array<{row: number; col: number}> = [];
        const colorRows: number[] = [];
        for (let row = row0; row <= row1; row++) {
            const line = month.rows[row];
            if (!line) {
                continue;
            }
            colorRows.push(row);
            for (let col = col0; col <= col1; col++) {
                const cell = line.cells[col];
                if (!cell || cell.type.id === CELL_TYPE.none || cell.type.id === CELL_TYPE.index) {
                    continue;
                }
                coords.push({row, col});
            }
        }
        if (!coords.length && !colorRows.length) {
            return;
        }
        this.suppressCommit = true;
        this.workbook.history.record(month, coords, colorRows, () => {
            for (const {row, col} of coords) {
                const cell = month.rows[row]?.cells[col];
                if (!cell) {
                    continue;
                }
                cell.raw = '';
                cell.display = '';
                cell.error = null;
                if (cell.type.id.indexOf('select') !== -1) {
                    cell.value = '';
                }
            }
            for (const row of colorRows) {
                const line = month.rows[row];
                if (!line) {
                    continue;
                }
                const person = line.cells.find((cell) => cell.type.id === CELL_TYPE.select_person);
                const code = (person?.value || person?.raw || '').trim();
                line.color = code ? code.toLowerCase() : '';
            }
        });
        this.draft = '';
        this.refresh();
        queueMicrotask(() => { this.suppressCommit = false; });
    }
}
