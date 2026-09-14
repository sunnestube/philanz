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
            this.pasteGrid(grid, rowIndex, this.range.copyCol);
            return;
        }
        super.onPaste(event, rowIndex, colIndex, cell);
    }

    override onKeydown(event: KeyboardEvent, rowIndex: number, colIndex: number, cell: MonthCell): void {
        const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
        if (event.key === 'Delete' || (event.key === 'Backspace' && !typing)) {
            event.preventDefault();
            this.clearRange();
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

    private clearRange(): void {
        const month = this.monthRef();
        if (!month) {
            return;
        }
        this.suppressCommit = true;
        for (let row = this.range.row0; row <= this.range.row1; row++) {
            const line = month.rows[row];
            if (!line) {
                continue;
            }
            for (let col = this.range.col0; col <= this.range.col1; col++) {
                const cell = line.cells[col];
                if (!cell || cell.type.id === CELL_TYPE.none || cell.type.id === CELL_TYPE.index) {
                    continue;
                }
                cell.raw = '';
                cell.display = '';
                cell.error = null;
                if (cell.type.id.indexOf('select') !== -1) {
                    cell.value = '';
                }
            }
            const person = line.cells.find((cell) => cell.type.id === CELL_TYPE.select_person);
            const code = (person?.value || person?.raw || '').trim();
            line.color = code ? code.toLowerCase() : '';
        }
        this.draft = '';
        this.refresh();
        queueMicrotask(() => { this.suppressCommit = false; });
    }
}
