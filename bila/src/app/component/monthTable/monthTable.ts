import {Component, ElementRef, HostListener, Input, ViewChild} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {Month} from '../../model/Month';
import {MonthCell} from '../../model/MonthCell';
import {MonthRow} from '../../model/MonthRow';
import {TableNavigationService} from '../../service/tableNavigation.service';
import {CELL_TYPE} from '../../model/CellType';
import {FormulaService} from '../../service/formula.service';
import {SaldoCombo, WorkbookService} from '../../service/workbook.service';

@Component({
    selector: 'bal-month-table',
    templateUrl: './monthTable.html',
    imports: [FormsModule],
    styleUrls: ['./monthTable.css']
})
export class MonthTable {
    private _month?: Month;
    editingRow: number | null = null;
    editingCol: number | null = null;
    formulaMode = false;
    refPickMode = false;
    draft = '';
    activeAddress = '';
    panning = false;
    private panX = 0;
    private panY = 0;
    private panLeft = 0;
    private panTop = 0;
    private cachedRev = -1;
    private cachedTitle = '';
    private cachedRunning: Array<Record<string, number>> = [];
    private readonly refTokenPattern = /(?:[A-Za-zÄÖÜäöü]{3}!)?\$?[A-Za-z]+\$?\d+/g;
    @ViewChild('formulaInput') formulaInput?: ElementRef<HTMLInputElement>;
    @ViewChild('scroller') scroller?: ElementRef<HTMLDivElement>;

    constructor(
        private readonly formulaService: FormulaService,
        readonly workbook: WorkbookService
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
        this.cachedRev = -1;
        this.formulaService.recalculateAll();
    }
    get month(): Month | undefined {
        return this._month;
    }

    cellId(rowIndex: number, colIndex: number): string {
        return TableNavigationService.cellId(this.month?.label.title ?? '', rowIndex, colIndex);
    }

    enterRefPick(): void {
        this.refPickMode = true;
        this.formulaMode = true;
    }

    leaveRefPick(): void {
        this.refPickMode = false;
    }

    showRefColors(): boolean {
        return (this.formulaMode || this.refPickMode) && this.draft.trim().startsWith('=');
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
            tokens.push({
                text: match[0],
                color: colors.get(match[0].replace(/\$/g, '').toUpperCase()) ?? 0
            });
            last = match.index + match[0].length;
        }
        if (last < raw.length) {
            tokens.push({text: raw.slice(last), color: null});
        }
        return tokens.length ? tokens : [{text: raw, color: null}];
    }

    refColorAt(rowIndex: number, colIndex: number): number | null {
        if (!this.showRefColors()) {
            return null;
        }
        if (rowIndex === this.editingRow && colIndex === this.editingCol) {
            return null;
        }
        const title = this.month?.label.title ?? '';
        const colors = this.refColorMap();
        for (const [token, color] of colors) {
            const parsed = this.formulaService.parseAddress(token, title);
            if (!parsed) {
                continue;
            }
            if (parsed.monthTitle && parsed.monthTitle !== title) {
                continue;
            }
            if (parsed.row === rowIndex && parsed.col === colIndex) {
                return color;
            }
        }
        return null;
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

    saldoCombos(): SaldoCombo[] {
        this.workbook.revision();
        return this.workbook.saldoCombos();
    }

    runningRows(): Array<Record<string, number>> {
        const rev = this.workbook.revision();
        const title = this.month?.label.title ?? '';
        if (this.cachedRev === rev && this.cachedTitle === title) {
            return this.cachedRunning;
        }
        this.cachedRunning = this.workbook.runningSaldosForMonth(this.month);
        this.cachedRev = rev;
        this.cachedTitle = title;
        return this.cachedRunning;
    }

    previousSaldo(rowIndex: number, key: string): number {
        if (rowIndex <= 0) {
            const [person, account] = key.split('|');
            return this.workbook.openingOf(person, account);
        }
        return this.runningRows()[rowIndex - 1]?.[key] ?? 0;
    }

    saldoAt(rowIndex: number, key: string): number {
        return this.runningRows()[rowIndex]?.[key] ?? 0;
    }

    saldoDelta(rowIndex: number, key: string): number {
        return this.saldoAt(rowIndex, key) - this.previousSaldo(rowIndex, key);
    }

    saldoTotal(rowIndex: number): number {
        const row = this.runningRows()[rowIndex];
        if (!row) {
            return 0;
        }
        return Object.values(row).reduce((sum, value) => sum + value, 0);
    }

    saldoTotalDelta(rowIndex: number): number {
        const current = this.saldoTotal(rowIndex);
        if (rowIndex <= 0) {
            return current - this.workbook.openingGrandTotal();
        }
        return current - this.saldoTotal(rowIndex - 1);
    }

    isSaldoHit(rowIndex: number, combo: SaldoCombo): boolean {
        const row = this.month?.rows[rowIndex];
        if (!row) {
            return false;
        }
        const person = row.cells.find((cell) => cell.type.id === CELL_TYPE.select_person)?.raw ?? '';
        const account = row.cells.find((cell) => cell.type.id === CELL_TYPE.select_account)?.raw ?? '';
        return person.trim().toUpperCase() === combo.person
            && account.trim().toUpperCase() === combo.account;
    }

    formatSaldo(value: number): string {
        return value.toLocaleString('de-CH', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    extraColCount(): number {
        if (!this.workbook.saldoColumnsOpen()) {
            return 0;
        }
        const combos = this.saldoCombos().length;
        return combos ? combos + 1 : 0;
    }

    onPanStart(event: PointerEvent): void {
        if (this.refPickMode) {
            return;
        }
        const target = event.target as HTMLElement;
        if (target.closest('input, select, button, textarea, a')) {
            return;
        }
        const el = this.scroller?.nativeElement;
        if (!el) {
            return;
        }
        this.panning = true;
        this.panX = event.clientX;
        this.panY = event.clientY;
        this.panLeft = el.scrollLeft;
        this.panTop = el.scrollTop;
        el.setPointerCapture?.(event.pointerId);
        event.preventDefault();
    }

    @HostListener('document:pointermove', ['$event'])
    onPanMove(event: PointerEvent): void {
        if (!this.panning) {
            return;
        }
        const el = this.scroller?.nativeElement;
        if (!el) {
            return;
        }
        el.scrollLeft = this.panLeft - (event.clientX - this.panX);
        el.scrollTop = this.panTop - (event.clientY - this.panY);
    }

    @HostListener('document:pointerup')
    onPanEnd(): void {
        this.panning = false;
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
        this.refPickMode = false;
    }
    onCellInput(event: Event, cell: MonthCell): void {
        const value = (event.target as HTMLInputElement).value;
        this.draft = value;
        cell.raw = value;
        this.formulaMode = value.trim().startsWith('=');
        if (this.formulaMode) {
            this.refPickMode = true;
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
        this.refPickMode = false;
        this.editingRow = null;
        this.editingCol = null;
    }
    cancelEdit(cell: MonthCell | null): void {
        if (cell && this.editingRow !== null) {
            this.formulaService.recalculateAll();
        }
        this.formulaMode = false;
        this.refPickMode = false;
        this.editingRow = null;
        this.editingCol = null;
        this.draft = '';
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
    onPaste(event: ClipboardEvent, rowIndex: number, colIndex: number, cell: MonthCell): void {
        event.preventDefault();
        const clip = event.clipboardData?.getData('text/plain') ?? '';
        const next = this.formulaService.pasteFormula(colIndex, rowIndex, clip);
        this.draft = next;
        cell.raw = next;
        this.formulaMode = this.formulaService.isFormula(next);
        this.editingRow = rowIndex;
        this.editingCol = colIndex;
        this.activeAddress = this.cellAddress(rowIndex, colIndex);
        this.formulaService.recalculateAll();
        this.workbook.touch();
        if (this.formulaMode) {
            this.refPickMode = true;
            queueMicrotask(() => this.focusFormulaBar());
        }
    }
    onKeydown(event: KeyboardEvent, rowIndex: number, colIndex: number, cell: MonthCell): void {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') {
            const raw = (this.editingRow === rowIndex && this.editingCol === colIndex ? this.draft : cell.raw) || '';
            this.formulaService.copyFormula(raw, colIndex, rowIndex);
            return;
        }
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v') {
            return;
        }
        if (event.key === 'F2') {
            event.preventDefault();
            this.formulaMode = true;
            this.refPickMode = true;
            queueMicrotask(() => this.focusFormulaBar());
            return;
        }
        if (this.refPickMode) {
            this.onFormulaKeydown(event, rowIndex, colIndex, cell);
            return;
        }
        if (event.key === '=' && !this.draft) {
            this.formulaMode = true;
            this.refPickMode = true;
            this.draft = '=';
            cell.raw = '=';
            event.preventDefault();
            queueMicrotask(() => this.focusFormulaBar());
            return;
        }
        if (event.key === 'Enter' || event.key === 'Tab' || ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
            this.commitEdit(cell);
        }
        this.navigate(event, rowIndex, colIndex);
    }
    onFormulaKeydown(event: KeyboardEvent, rowIndex: number, colIndex: number, cell: MonthCell): void {
        if ((event.ctrlKey || event.metaKey) && (event.key.toLowerCase() === 'c' || event.key.toLowerCase() === 'v')) {
            return;
        }
        const title = this.month?.label.title ?? '';
        if (event.key === 'Escape') {
            event.preventDefault();
            this.cancelEdit(cell);
            return;
        }
        if (event.key === 'Enter') {
            event.preventDefault();
            this.commitEdit(cell);
            TableNavigationService.navigate('Enter', rowIndex, colIndex, this.month?.columns?.length, title);
            return;
        }
        if (event.key === 'Tab') {
            event.preventDefault();
            this.commitEdit(cell);
            TableNavigationService.navigate(event.shiftKey ? 'ArrowLeft' : 'ArrowRight', rowIndex, colIndex, this.month?.columns?.length, title);
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
        if (!this.refPickMode || this.editingRow === null) {
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
        TableNavigationService.navigate(
            event.key,
            rowIndex,
            cellIndex,
            this.month?.columns?.length,
            this.month?.label.title ?? ''
        );
    }
    private insertReference(rowIndex: number, colIndex: number): void {
        const address = this.cellAddress(rowIndex, colIndex);
        const current = this.draft || '=';
        const withoutTrailingRef = current.replace(/(?:[A-Za-z\u00c4\u00d6\u00dc\u00e4\u00f6\u00fc]{3}!)?\$?[A-Za-z]+\$?\d+$/, '');
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
        const trailing = this.draft.match(/(?:[A-Za-z\u00c4\u00d6\u00dc\u00e4\u00f6\u00fc]{3}!)?\$?[A-Za-z]+\$?\d+$/);
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
