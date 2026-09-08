import {Component, ElementRef, Input, ViewChild} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {Month} from '../../model/Month';
import {NewRowButtonsComponent} from '../newRowButtons/newRowButtons.component';
import {MonthCell} from '../../model/MonthCell';
import {MonthRow} from '../../model/MonthRow';
import {TableNavigationService} from '../../service/tableNavigation.service';
import {CELL_TYPE} from '../../model/CellType';
import {FormulaService} from '../../service/formula.service';
import {WorkbookService} from '../../service/workbook.service';

@Component({
    selector: 'bal-month-table',
    templateUrl: './monthTable.html',
    imports: [FormsModule, NewRowButtonsComponent],
    styleUrls: ['./monthTable.css']
})
export class MonthTable {
    private _month?: Month;
    editingRow: number | null = null;
    editingCol: number | null = null;
    formulaMode = false;
    draft = '';
    activeAddress = '';
    @ViewChild('formulaInput') formulaInput?: ElementRef<HTMLInputElement>;

    constructor(
        private readonly formulaService: FormulaService,
        private readonly workbook: WorkbookService
    ) {}

    optionsFor(cell: MonthCell): string[] {
        this.workbook.revision();
        if (cell.type.id === CELL_TYPE.select_person) {
            return this.workbook.persons();
        }
        if (cell.type.id === CELL_TYPE.select_account) {
            return this.workbook.accounts();
        }
        return [''];
    }

    @Input()
    set month(month: Month) {
        month?.rows.forEach((row) => {
            row.cells.forEach((cell) => this.applySelectSideEffects(cell, row));
        });
        this._month = month;
        this.formulaService.recalculateAll();
    }
    get month(): Month | undefined {
        return this._month;
    }

    columnLetter(index: number): string {
        return this.formulaService.columnLetter(index);
    }
    cellAddress(rowIndex: number, colIndex: number): string {
        return this.formulaService.addressFor(colIndex, rowIndex);
    }
    displayValue(cell: MonthCell): string {
        if (cell.error) {
            return cell.error;
        }
        return cell.display || cell.raw || '';
    }
    isFormula(cell: MonthCell): boolean {
        return this.formulaService.isFormula(cell.raw);
    }
    onSelectChange(cell: MonthCell, row: MonthRow): void {
        this.applySelectSideEffects(cell, row);
        this.workbook.touch();
    }
    private applySelectSideEffects(cell: MonthCell, row: MonthRow): void {
        if (cell.type.id.indexOf(CELL_TYPE.select) === -1) {
            return;
        }
        const options = this.optionsFor(cell);
        if (!options.includes(cell.value)) {
            cell.value = '';
        }
        if (cell.type.id === CELL_TYPE.select_person) {
            row.color = (cell.value || '').toLowerCase();
        }
    }
    startEdit(rowIndex: number, colIndex: number, cell: MonthCell): void {
        this.editingRow = rowIndex;
        this.editingCol = colIndex;
        this.draft = cell.raw ?? '';
        this.activeAddress = this.cellAddress(rowIndex, colIndex);
        this.formulaMode = this.formulaService.isFormula(this.draft);
        if (this.formulaMode) {
            queueMicrotask(() => this.focusFormulaBar());
        }
    }
    onCellInput(event: Event, cell: MonthCell): void {
        const value = (event.target as HTMLInputElement).value;
        this.draft = value;
        cell.raw = value;
        this.formulaMode = value.trim().startsWith('=');
        if (this.formulaMode) {
            queueMicrotask(() => this.focusFormulaBar());
        }
    }
    onFormulaInput(event: Event, cell: MonthCell | null): void {
        const value = (event.target as HTMLInputElement).value;
        this.draft = value;
        this.formulaMode = value.trim().startsWith('=');
        if (cell) {
            cell.raw = value;
        }
    }
    commitEdit(cell: MonthCell | null): void {
        if (!cell) {
            return;
        }
        cell.raw = this.draft;
        this.formulaService.recalculateAll();
        this.workbook.touch();
        this.formulaMode = false;
        this.editingRow = null;
        this.editingCol = null;
    }
    cancelEdit(cell: MonthCell | null): void {
        if (cell && this.editingRow !== null) {
            this.formulaService.recalculateAll();
        }
        this.formulaMode = false;
        this.editingRow = null;
        this.editingCol = null;
        this.draft = '';
    }
    onKeydown(event: KeyboardEvent, rowIndex: number, colIndex: number, cell: MonthCell): void {
        if (this.formulaMode) {
            this.onFormulaKeydown(event, rowIndex, colIndex, cell);
            return;
        }
        if (event.key === '=' && !this.draft) {
            this.formulaMode = true;
            this.draft = '=';
            cell.raw = '=';
            event.preventDefault();
            queueMicrotask(() => this.focusFormulaBar());
            return;
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
            this.commitEdit(cell);
        }
        this.navigate(event, rowIndex, colIndex);
    }
    onFormulaKeydown(event: KeyboardEvent, rowIndex: number, colIndex: number, cell: MonthCell): void {
        if (event.key === 'Escape') {
            event.preventDefault();
            this.cancelEdit(cell);
            return;
        }
        if (event.key === 'Enter') {
            event.preventDefault();
            this.commitEdit(cell);
            TableNavigationService.navigate('Enter', rowIndex, colIndex, this.month?.columns?.length);
            return;
        }
        if (event.key === 'Tab') {
            event.preventDefault();
            this.commitEdit(cell);
            TableNavigationService.navigate(event.shiftKey ? 'ArrowLeft' : 'ArrowRight', rowIndex, colIndex, this.month?.columns?.length);
            return;
        }
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
            event.preventDefault();
            const next = this.shiftAddress(rowIndex, colIndex, event.key);
            this.insertReference(next.row, next.col);
            this.editingRow = rowIndex;
            this.editingCol = colIndex;
            queueMicrotask(() => this.focusFormulaBar());
        }
    }
    onCellMouseDown(event: MouseEvent, rowIndex: number, colIndex: number): void {
        if (!this.formulaMode || this.editingRow === null) {
            return;
        }
        if (rowIndex === this.editingRow && colIndex === this.editingCol) {
            return;
        }
        event.preventDefault();
        this.insertReference(rowIndex, colIndex);
        queueMicrotask(() => this.focusFormulaBar());
    }
    activeCell(): MonthCell | null {
        if (!this.month || this.editingRow === null || this.editingCol === null) {
            return null;
        }
        return this.month.rows[this.editingRow]?.cells[this.editingCol] ?? null;
    }
    navigate(event: KeyboardEvent, rowIndex: number, cellIndex: number): void {
        TableNavigationService.navigate(event.key, rowIndex, cellIndex, this.month?.columns?.length);
    }
    private insertReference(rowIndex: number, colIndex: number): void {
        const address = this.cellAddress(rowIndex, colIndex);
        const current = this.draft || '=';
        const withoutTrailingRef = current.replace(/([A-Za-z\u00c4\u00d6\u00dc\u00e4\u00f6\u00fc]{3}!)?[A-Za-z]+\d+$/, '');
        const needsOperator = /[+\-*/\u00d7\u00f7(]$/.test(withoutTrailingRef.trim()) || withoutTrailingRef.trim() === '=';
        this.draft = needsOperator ? `${withoutTrailingRef}${address}` : `${withoutTrailingRef}+${address}`;
        const cell = this.activeCell();
        if (cell) {
            cell.raw = this.draft;
        }
    }
    private shiftAddress(rowIndex: number, colIndex: number, key: string): {row: number; col: number} {
        const lastCol = (this.month?.columns.length ?? 1) - 1;
        const lastRow = (this.month?.rows.length ?? 1) - 1;
        let row = rowIndex;
        let col = colIndex;
        const trailing = this.draft.match(/([A-Za-z\u00c4\u00d6\u00dc\u00e4\u00f6\u00fc]{3}!)?[A-Za-z]+\d+$/);
        if (trailing) {
            const parsed = this.formulaService.parseAddress(trailing[0], this.month?.label.title ?? '');
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
        } else if (key === 'ArrowRight') {
            col = Math.min(lastCol, col + 1);
        }
        return {row, col};
    }
    private focusFormulaBar(): void {
        this.formulaInput?.nativeElement?.focus();
        const input = this.formulaInput?.nativeElement;
        if (input) {
            const end = input.value.length;
            input.setSelectionRange(end, end);
        }
    }
}
