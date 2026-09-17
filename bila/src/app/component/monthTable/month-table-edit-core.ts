import {CELL_TYPE} from '../../model/CellType';
import {Month} from '../../model/Month';
import {MonthCell} from '../../model/MonthCell';
import {MonthRow} from '../../model/MonthRow';
import {FormulaService} from '../../service/formula.service';
import {TableNavigationService} from '../../service/tableNavigation.service';
import {WorkbookService} from '../../service/workbook.service';

export abstract class MonthTableEditCore {
    editingRow: number | null = null;
    editingCol: number | null = null;
    liveEdit = false;
    formulaMode = false;
    refPickMode = false;
    draft = '';
    activeAddress = '';
    protected editOriginal = '';
    protected ignoreFormulaBlur = false;
    protected suppressCommit = false;
    /** Captured on selectCell for select Undo (ngModel updates before change). */
    protected selectBaseline: {row: number; col: number; raw: string; color: string} | null = null;
    private readonly refTokenPattern = /(?:[A-Za-zÄÖÜäöü]{3}!)?\$?[A-Za-z]+\$?\d+/g;

    constructor(
        protected readonly formulaService: FormulaService,
        protected readonly workbook: WorkbookService,
        protected readonly monthOf: () => Month | undefined,
        protected readonly focusBar: () => void,
        protected readonly blurBar: () => void
    ) {}

    abstract selectCell(rowIndex: number, colIndex: number, cell: MonthCell): void;
    abstract commitEdit(cell: MonthCell | null): void;
    abstract onPaste(event: ClipboardEvent, rowIndex: number, colIndex: number, cell: MonthCell): void;
    abstract applySelectSideEffects(cell: MonthCell, row: MonthRow, options: string[]): void;
    protected abstract handleHistoryKeys(event: KeyboardEvent): boolean;
    protected abstract pasteGrid(grid: string[][], startRow: number, startCol: number, clipboardText?: string): void;


    activeCell(): MonthCell | null {
        const month = this.monthOf();
        if (!month || this.editingRow === null || this.editingCol === null) {
            return null;
        }
        return month.rows[this.editingRow]?.cells[this.editingCol] ?? null;
    }

    showRefColors(): boolean {
        return (this.formulaMode || this.refPickMode) && this.draft.trim().startsWith('=');
    }

    formulaPlaceholder(): string {
        return this.refPickMode
            ? 'Formel eingeben, Zelle anklicken für Bezug'
            : 'Zelle wählen – F2 oder hier klicken für Bezüge';
    }

    formulaTokens(): Array<{text: string; color: number | null}> {
        const raw = this.draft || '';
        if (!raw.startsWith('=')) {
            return [{text: raw, color: null}];
        }
        const colors = this.refColorMap();
        const tokens: Array<{text: string; color: number | null}> = [];
        const pattern = new RegExp(this.refTokenPattern.source, 'g');
        let last = 0;
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(raw)) !== null) {
            if (match.index > last) {
                tokens.push({text: raw.slice(last, match.index), color: null});
            }
            tokens.push({text: match[0], color: colors.get(match[0].replace(/\$/g, '').toUpperCase()) ?? 0});
            last = match.index + match[0].length;
        }
        if (last < raw.length) {
            tokens.push({text: raw.slice(last), color: null});
        }
        return tokens.length ? tokens : [{text: raw, color: null}];
    }

    refColorAt(rowIndex: number, colIndex: number): number | null {
        if (!this.showRefColors() || (rowIndex === this.editingRow && colIndex === this.editingCol)) {
            return null;
        }
        const title = this.monthOf()?.label.title ?? '';
        for (const [token, color] of this.refColorMap()) {
            const parsed = this.formulaService.parseAddress(token, title);
            if (parsed && (!parsed.monthTitle || parsed.monthTitle === title) && parsed.row === rowIndex && parsed.col === colIndex) {
                return color;
            }
        }
        return null;
    }

    enterRefPick(): void {
        this.formulaMode = true;
        this.refPickMode = (this.draft || '').trim().startsWith('=');
    }


    startEdit(rowIndex: number, colIndex: number, cell: MonthCell): void {
        this.selectCell(rowIndex, colIndex, cell);
        if (this.refPickMode) {
            return;
        }
        this.liveEdit = true;
        this.formulaMode = this.formulaService.isFormula(this.draft);
    }

    onCellInput(event: Event, cell: MonthCell): void {
        const value = (event.target as HTMLInputElement).value;
        this.draft = value;
        cell.raw = value;
        this.liveEdit = true;
        this.formulaMode = value.trim().startsWith('=');
        if (this.formulaMode) {
            this.refPickMode = true;
            queueMicrotask(() => this.focusBar());
        }
    }

    onFormulaInput(event: Event): void {
        const value = (event.target as HTMLInputElement).value;
        this.draft = value;
        this.formulaMode = value.trim().startsWith('=');
        const cell = this.activeCell();
        if (cell) {
            cell.raw = value;
        }
    }


    exitFormula(): void {
        const cell = this.activeCell();
        if (cell) {
            cell.raw = this.editOriginal;
        }
        this.ignoreFormulaBlur = true;
        this.formulaMode = false;
        this.refPickMode = false;
        this.liveEdit = false;
        this.draft = this.editOriginal;
        this.blurBar();
        queueMicrotask(() => { this.ignoreFormulaBlur = false; });
    }

    onFormulaBlur(): void {
        if (this.ignoreFormulaBlur) {
            return;
        }
        if (this.refPickMode) {
            queueMicrotask(() => this.focusBar());
            return;
        }
        this.commitEdit(this.activeCell());
    }

    onCellBlur(cell: MonthCell): void {
        if (!this.refPickMode) {
            this.commitEdit(cell);
        }
    }

    onCopy(event: ClipboardEvent, rowIndex: number, colIndex: number, cell: MonthCell): void {
        const raw = (this.editingRow === rowIndex && this.editingCol === colIndex ? this.draft : cell.raw) || '';
        const text = this.formulaService.copyFormula(raw, colIndex, rowIndex);
        event.preventDefault();
        event.clipboardData?.setData('text/plain', text);
        if (!event.clipboardData) {
            void navigator.clipboard.writeText(text);
        }
    }


    onKeydown(event: KeyboardEvent, rowIndex: number, colIndex: number, cell: MonthCell): void {
        if (event.key === 'Escape') {
            event.preventDefault();
            this.exitFormula();
            return;
        }
        if (this.handleHistoryKeys(event)) {
            return;
        }
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v') {
            return;
        }
        if (event.key === 'F2') {
            event.preventDefault();
            this.startEdit(rowIndex, colIndex, cell);
            this.formulaMode = true;
            this.refPickMode = true;
            queueMicrotask(() => this.focusBar());
            return;
        }
        if (this.refPickMode) {
            this.onFormulaKeydown(event);
            return;
        }
        if (event.key === '=' && !this.liveEdit) {
            this.startEdit(rowIndex, colIndex, cell);
            this.formulaMode = true;
            this.refPickMode = true;
            this.draft = '=';
            cell.raw = '=';
            event.preventDefault();
            queueMicrotask(() => this.focusBar());
            return;
        }
        const moving = event.key === 'Enter' || event.key === 'Tab'
            || ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key);
        if (moving) {
            if (this.liveEdit) {
                this.commitEdit(cell);
            }
            this.navigate(event, rowIndex, colIndex);
            return;
        }
        if (!this.liveEdit && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
            event.preventDefault();
            this.startEdit(rowIndex, colIndex, cell);
            this.draft = event.key;
            cell.raw = event.key;
            this.formulaMode = event.key === '=';
            if (this.formulaMode) {
                this.refPickMode = true;
                queueMicrotask(() => this.focusBar());
            }
        }
    }

    onFormulaKeydown(event: KeyboardEvent): void {
        const cell = this.activeCell();
        if (!cell || this.editingRow === null || this.editingCol === null) {
            return;
        }
        if ((event.ctrlKey || event.metaKey) && (event.key.toLowerCase() === 'c' || event.key.toLowerCase() === 'v')) {
            return;
        }
        const rowIndex = this.editingRow;
        const colIndex = this.editingCol;
        const title = this.monthOf()?.label.title ?? '';
        if (event.key === 'Escape') {
            event.preventDefault();
            this.exitFormula();
            return;
        }
        if (event.key === 'Enter') {
            event.preventDefault();
            this.commitEdit(cell);
            TableNavigationService.navigate('Enter', rowIndex, colIndex, this.monthOf()?.columns?.length, title);
            return;
        }
        if (event.key === 'Tab') {
            event.preventDefault();
            this.commitEdit(cell);
            TableNavigationService.navigate(event.shiftKey ? 'ArrowLeft' : 'ArrowRight', rowIndex, colIndex, this.monthOf()?.columns?.length, title);
            return;
        }
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
            event.preventDefault();
            const next = this.shiftAddress(rowIndex, colIndex, event.key);
            this.insertReference(next.row, next.col);
            this.editingRow = rowIndex;
            this.editingCol = colIndex;
            queueMicrotask(() => this.focusBar());
        }
    }

    onCellMouseDown(event: MouseEvent, rowIndex: number, colIndex: number): void {
        if (!this.refPickMode || this.editingRow === null || (rowIndex === this.editingRow && colIndex === this.editingCol)) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        this.ignoreFormulaBlur = true;
        this.insertReference(rowIndex, colIndex);
        queueMicrotask(() => {
            this.focusBar();
            this.ignoreFormulaBlur = false;
        });
    }

    navigate(event: KeyboardEvent, rowIndex: number, cellIndex: number): void {
        TableNavigationService.navigate(event.key, rowIndex, cellIndex, this.monthOf()?.columns?.length, this.monthOf()?.label.title ?? '');
    }


    private refColorMap(): Map<string, number> {
        const map = new Map<string, number>();
        const raw = this.draft || '';
        const pattern = new RegExp(this.refTokenPattern.source, 'g');
        let index = 0;
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(raw)) !== null) {
            const key = match[0].replace(/\$/g, '').toUpperCase();
            if (!map.has(key)) {
                map.set(key, index % 6);
                index++;
            }
        }
        return map;
    }

    private insertReference(rowIndex: number, colIndex: number): void {
        const address = this.formulaService.addressFor(colIndex, rowIndex);
        const current = this.draft || '=';
        const withoutTrailingRef = current.replace(/(?:[A-Za-zÄÖÜäöü]{3}!)?\$?[A-Za-z]+\$?\d+$/, '');
        const needsOperator = /[+\-*/×÷(]$/.test(withoutTrailingRef.trim()) || withoutTrailingRef.trim() === '=';
        this.draft = needsOperator ? `${withoutTrailingRef}${address}` : `${withoutTrailingRef}+${address}`;
        const cell = this.activeCell();
        if (cell) {
            cell.raw = this.draft;
        }
    }

    private shiftAddress(rowIndex: number, colIndex: number, key: string): {row: number; col: number} {
        const month = this.monthOf();
        const lastCol = (month?.columns.length ?? 1) - 1;
        const lastRow = (month?.rows.length ?? 1) - 1;
        let row = rowIndex;
        let col = colIndex;
        const trailing = this.draft.match(/(?:[A-Za-zÄÖÜäöü]{3}!)?\$?[A-Za-z]+\$?\d+$/);
        if (trailing) {
            const parsed = this.formulaService.parseAddress(trailing[0], month?.label.title ?? '');
            if (parsed) {
                row = parsed.row;
                col = parsed.col;
            }
        }
        if (key === 'ArrowUp') {
            row = Math.max(0, row - 1);
        } else if (key === 'ArrowDown') {
            row = Math.min(lastRow, row + 1);
        } else if (key === 'ArrowLeft') {
            col = Math.max(0, col - 1);
        } else {
            col = Math.min(lastCol, col + 1);
        }
        return {row, col};
    }

    protected parseClipboardGrid(text: string): string[][] {
        const lines = (text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
        while (lines.length && lines[lines.length - 1] === '') {
            lines.pop();
        }
        return lines.length ? lines.map((line) => line.split('\t')) : [['']];
    }

    protected refresh(): void {
        this.formulaService.recalculateAll();
        this.workbook.touch();
    }




    undo(): boolean {
        const month = this.monthOf();
        if (!month || !this.workbook.history.undo(month)) {
            return false;
        }
        this.afterHistoryApply(month);
        return true;
    }

    redo(): boolean {
        const month = this.monthOf();
        if (!month || !this.workbook.history.redo(month)) {
            return false;
        }
        this.afterHistoryApply(month);
        return true;
    }


    private afterHistoryApply(month: Month): void {
        this.suppressCommit = true;
        this.liveEdit = false;
        this.formulaMode = false;
        this.refPickMode = false;
        this.draft = '';
        if (this.editingRow !== null && this.editingCol !== null) {
            const cell = month.rows[this.editingRow]?.cells[this.editingCol];
            this.editOriginal = cell?.raw ?? '';
            this.draft = this.editOriginal;
        }
        this.formulaService.recalculateAll();
        this.workbook.touch();
        queueMicrotask(() => { this.suppressCommit = false; });
    }

    protected appendEmptyRow(month: Month): void {
        const rowIndex = month.rows.length;
        const row = new MonthRow(rowIndex, month.columns);
        row.cells.forEach((cell) => {
            if (cell.type.id === CELL_TYPE.none) {
                cell.raw = month.label.title;
            }
            if (cell.type.id === CELL_TYPE.index) {
                cell.raw = String(rowIndex);
            }
        });
        month.rows.push(row);
    }
}
