import {CELL_TYPE} from '../../model/CellType';
import {Month} from '../../model/Month';
import {MonthCell} from '../../model/MonthCell';
import {MonthRow} from '../../model/MonthRow';
import {MonthTableEditCore} from './month-table-edit-core';

/** Production edit layer — history/paste/select fixes (Petr review #2/#4). */
export class MonthTableEdit extends MonthTableEditCore {
    selectCell(rowIndex: number, colIndex: number, cell: MonthCell): void {
        if (this.refPickMode && (this.editingRow !== rowIndex || this.editingCol !== colIndex)) {
            queueMicrotask(() => this.focusBar());
            return;
        }
        this.editingRow = rowIndex;
        this.editingCol = colIndex;
        this.editOriginal = cell.raw ?? '';
        this.draft = cell.raw ?? '';
        this.activeAddress = this.formulaService.addressFor(colIndex, rowIndex);
        this.formulaMode = false;
        this.refPickMode = false;
        this.liveEdit = false;
        const row = this.monthOf()?.rows[rowIndex];
        // Select binds ngModel to cell.value — baseline must match that, not stale raw.
        const baselineRaw = cell.type.id.indexOf('select') !== -1
            ? (cell.value ?? cell.raw ?? '')
            : (cell.raw ?? '');
        this.selectBaseline = {
            row: rowIndex,
            col: colIndex,
            raw: baselineRaw,
            color: row?.color ?? ''
        };
    }
    commitEdit(cell: MonthCell | null): void {
        if (!cell || this.suppressCommit || this.editingRow === null || this.editingCol === null) {
            this.liveEdit = false;
            return;
        }
        const next = this.draft ?? '';
        const changed = next !== (this.editOriginal ?? '');
        const row = this.editingRow;
        const col = this.editingCol;
        const month = this.monthOf();
        if (changed && month) {
            const history = this.workbook.history;
            // liveEdit / formula bar already mutate cell.raw — restore pre-edit for before.
            const beforeColors = history.captureColors(month, [row]);
            cell.raw = next;
            history.push({
                monthTitle: month.label.title,
                before: [{row, col, raw: this.editOriginal ?? ''}],
                after: [{row, col, raw: next}],
                beforeColors,
                afterColors: history.captureColors(month, [row])
            });
        } else if (changed) {
            cell.raw = next;
        }
        this.liveEdit = false;
        this.formulaMode = false;
        this.refPickMode = false;
        if (changed) {
            this.formulaService.recalculateAll();
            this.workbook.touch();
        }
    }
    onPaste(event: ClipboardEvent, rowIndex: number, colIndex: number, cell: MonthCell): void {
        event.preventDefault();
        const clip = event.clipboardData?.getData('text/plain') ?? '';
        const grid = this.parseClipboardGrid(clip);
        if (grid.length > 1 || (grid[0]?.length ?? 0) > 1) {
            this.pasteGrid(grid, rowIndex, colIndex, clip);
            return;
        }
        const month = this.monthOf();
        const next = this.formulaService.pasteFormula(colIndex, rowIndex, clip);
        if (month) {
            this.workbook.history.record(
                month,
                [{row: rowIndex, col: colIndex}],
                [rowIndex],
                () => {
                    this.draft = next;
                    cell.raw = next;
                }
            );
        } else {
            this.draft = next;
            cell.raw = next;
        }
        this.editOriginal = next;
        this.formulaMode = this.formulaService.isFormula(next);
        this.editingRow = rowIndex;
        this.editingCol = colIndex;
        this.liveEdit = false;
        this.activeAddress = this.formulaService.addressFor(colIndex, rowIndex);
        this.formulaService.recalculateAll();
        this.workbook.touch();
        if (this.formulaMode) {
            this.refPickMode = true;
            queueMicrotask(() => this.focusBar());
        }
    }
    applySelectSideEffects(cell: MonthCell, row: MonthRow, options: string[]): void {
        if (cell.type.id.indexOf(CELL_TYPE.select) === -1) {
            return;
        }
        if (!options.includes(cell.value)) {
            cell.value = '';
        }
        // Keep raw in sync with value so history patches restore the select correctly.
        cell.raw = cell.value ?? '';
        if (cell.type.id === CELL_TYPE.select_person) {
            row.color = (cell.value || '').toLowerCase();
        }
    }
    protected pasteGrid(grid: string[][], startRow: number, startCol: number, clipboardText?: string): void {
        const month = this.monthOf();
        if (!month) {
            return;
        }
        const tsv = clipboardText ?? grid.map((line) => line.join('\t')).join('\n');
        const origin = this.formulaService.pasteSource(tsv);
        const coords: Array<{row: number; col: number}> = [];
        const colorRows: number[] = [];
        // Same adjust path as single pasteFormula: origin + adjustFormula, else leave raw.
        this.workbook.history.record(month, coords, colorRows, () => {
            grid.forEach((line, rowOffset) => {
                const rowIndex = startRow + rowOffset;
                while (month.rows.length <= rowIndex) {
                    this.appendEmptyRow(month);
                }
                colorRows.push(rowIndex);
                line.forEach((value, colOffset) => {
                    const colIndex = startCol + colOffset;
                    const target = month.rows[rowIndex]?.cells[colIndex];
                    if (!target || target.type.id === CELL_TYPE.none || target.type.id === CELL_TYPE.index) {
                        return;
                    }
                    // Note coord *before* write so record() snapshots pre-state.
                    coords.push({row: rowIndex, col: colIndex});
                    if (this.formulaService.isFormula(value) && origin) {
                        target.raw = this.formulaService.adjustFormula(
                            value,
                            origin.col + colOffset,
                            origin.row + rowOffset,
                            colIndex,
                            rowIndex
                        );
                    } else {
                        target.raw = value;
                    }
                    if (target.type.id.indexOf('select') !== -1) {
                        target.value = value.trim().toUpperCase();
                        this.applySelectSideEffects(target, month.rows[rowIndex], [target.value, '']);
                    }
                });
            });
        });
        this.suppressCommit = true;
        this.formulaMode = false;
        this.refPickMode = false;
        this.liveEdit = false;
        this.draft = '';
        this.formulaService.recalculateAll();
        this.workbook.touch();
        queueMicrotask(() => { this.suppressCommit = false; });
    }
    /**
     * App undo/redo when not typing in an input/formula field.
     * While the cell input or formula-bar has focus, Ctrl/Cmd+Z uses native field undo.
     * Redo: Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z (both supported).
     */
    protected handleHistoryKeys(event: KeyboardEvent): boolean {
        if (!(event.ctrlKey || event.metaKey)) {
            return false;
        }
        // While caret is in an input/textarea, never steal Ctrl/Cmd+Z from native undo.
        if (event.target instanceof HTMLInputElement
            || event.target instanceof HTMLTextAreaElement) {
            return false;
        }
        const key = event.key.toLowerCase();
        const redo = key === 'y' || (key === 'z' && event.shiftKey);
        const undo = key === 'z' && !event.shiftKey;
        if (!undo && !redo) {
            return false;
        }
        event.preventDefault();
        event.stopPropagation();
        if (undo) {
            this.undo();
        } else {
            this.redo();
        }
        return true;
    }
    /** Select change after ngModel update — uses selectBaseline from selectCell. */
    recordSelectChange(cell: MonthCell, row: MonthRow, rowIndex: number, colIndex: number): void {
        const month = this.monthOf();
        const baseline = this.selectBaseline;
        if (!month || !baseline || baseline.row !== rowIndex || baseline.col !== colIndex) {
            return;
        }
        // Prefer value (ngModel); applySelectSideEffects already synced raw.
        const afterRaw = cell.value ?? cell.raw ?? '';
        cell.raw = afterRaw;
        const afterColor = row.color ?? '';
        if (baseline.raw === afterRaw && baseline.color === afterColor) {
            return;
        }
        this.workbook.history.push({
            monthTitle: month.label.title,
            before: [{row: rowIndex, col: colIndex, raw: baseline.raw}],
            after: [{row: rowIndex, col: colIndex, raw: afterRaw}],
            beforeColors: [{row: rowIndex, color: baseline.color}],
            afterColors: [{row: rowIndex, color: afterColor}]
        });
        this.selectBaseline = {
            row: rowIndex,
            col: colIndex,
            raw: afterRaw,
            color: afterColor
        };
    }
}
