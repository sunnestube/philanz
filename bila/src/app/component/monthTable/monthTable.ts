import {Component, ElementRef, HostBinding, Input, NgZone, OnDestroy, ViewChild} from '@angular/core';
import {CellFormatPipe} from '../../pipe/cell-format.pipe';
import {Month} from '../../model/Month';
import {MonthCell} from '../../model/MonthCell';
import {MonthRow} from '../../model/MonthRow';
import {CELL_TYPE} from '../../model/CellType';
import {TableNavigationService} from '../../service/tableNavigation.service';
import {FormulaService} from '../../service/formula.service';
import {WorkbookService} from '../../service/workbook.service';
import {columnFillAmount} from '../../service/column-fill';
import {FormulaBarComponent} from './formula-bar/formula-bar.component';
import {MonthTableHeaderComponent} from './month-table-header/month-table-header.component';
import {MonthTableCellComponent} from './month-table-cell/month-table-cell.component';
import {SaldoCellComponent} from './saldo-cell/saldo-cell.component';
import {MonthTableFooterComponent} from './month-table-footer/month-table-footer.component';
import {columnViews, cssTypeOf, saldoColViews} from './month-table.vm';
import {MonthTableEdit} from './month-table-edit';
import {MonthTablePointer} from './month-table-pointer';
import {MonthTableSaldo} from './month-table-saldo';

@Component({
    selector: 'bal-month-table',
    templateUrl: './monthTable.html',
    imports: [
        FormulaBarComponent,
        MonthTableHeaderComponent,
        MonthTableCellComponent,
        SaldoCellComponent,
        MonthTableFooterComponent
    ],
    styleUrls: ['./monthTable.css']
})
export class MonthTable implements OnDestroy {
    private _month?: Month;
    readonly edit: MonthTableEdit;
    readonly pointer: MonthTablePointer;
    readonly saldo: MonthTableSaldo;
    @ViewChild(FormulaBarComponent) formulaBar?: FormulaBarComponent;
    @ViewChild('scroller') scroller?: ElementRef<HTMLDivElement>;

    constructor(
        private readonly formulaService: FormulaService,
        readonly workbook: WorkbookService,
        zone: NgZone
    ) {
        this.edit = new MonthTableEdit(
            formulaService,
            workbook,
            () => this._month,
            () => this.formulaBar?.focusEnd(),
            () => this.formulaBar?.blur()
        );
        this.pointer = new MonthTablePointer(
            workbook,
            zone,
            () => this.scroller,
            () => this.edit.refPickMode || this.edit.formulaMode
        );
        this.saldo = new MonthTableSaldo(workbook, formulaService, () => this._month);
        zone.runOutsideAngular(() => {
            document.addEventListener('pointermove', this.onWindowPanMove, {passive: false});
            document.addEventListener('pointerup', this.onWindowPanEnd);
            document.addEventListener('pointercancel', this.onWindowPanEnd);
            document.addEventListener('keydown', this.onWindowEscape);
        });
    }

    private readonly onWindowPanMove = (event: PointerEvent) => this.pointer.onPanMove(event);
    private readonly onWindowPanEnd = () => this.pointer.onPanEnd();
    private readonly onWindowEscape = (event: KeyboardEvent) => {
        if (event.key === 'Escape' && (this.edit.formulaMode || this.edit.refPickMode || this.edit.editingRow !== null)) {
            event.preventDefault();
            this.edit.exitFormula();
        }
    };

    @HostBinding('style.--title-h.px')
    get titleRowPx(): number {
        return this.workbook.headerRowHeight();
    }

    @HostBinding('style.--text-w.px')
    get textColPx(): number {
        return this.workbook.textColWidth();
    }

    get panning(): boolean {
        return this.pointer.panning;
    }

    @Input()
    set month(month: Month) {
        month?.rows.forEach((row) => {
            row.cells.forEach((cell) => this.edit.applySelectSideEffects(cell, row, this.optionsFor(cell)));
        });
        this._month = month;
        this.saldo.invalidate();
        this.formulaService.recalculateAll();
    }
    get month(): Month | undefined {
        return this._month;
    }

    ngOnDestroy(): void {
        document.removeEventListener('pointermove', this.onWindowPanMove);
        document.removeEventListener('pointerup', this.onWindowPanEnd);
        document.removeEventListener('pointercancel', this.onWindowPanEnd);
        document.removeEventListener('keydown', this.onWindowEscape);
        this.pointer.destroy();
    }

    showSaldo(): boolean {
        return this.workbook.saldoColumnsOpen();
    }

    columnViews() {
        return columnViews(this.month?.columns ?? [], (index) => this.columnLetter(index));
    }

    saldoHeader() {
        return saldoColViews(this.saldo.combos(), (combo) => this.workbook.saldoTitleFor(combo));
    }

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

    cellId(rowIndex: number, colIndex: number): string {
        return TableNavigationService.cellId(this.month?.label.title ?? '', rowIndex, colIndex);
    }

    columnLetter(index: number): string {
        const visible = this.formulaService.visibleIndex(index, this.month?.columns);
        return visible === null ? '' : this.formulaService.columnLetter(visible);
    }

    isSelect(cell: MonthCell): boolean {
        return cell.type.id.indexOf('select') !== -1;
    }

    isIndex(cell: MonthCell): boolean {
        return cell.type.id === CELL_TYPE.index;
    }

    isFormula(cell: MonthCell): boolean {
        return this.formulaService.isFormula(cell.raw);
    }

    isEditing(rowIndex: number, colIndex: number): boolean {
        return this.edit.editingRow === rowIndex && this.edit.editingCol === colIndex;
    }

    cellCss(cell: MonthCell): string {
        return cssTypeOf(cell.type.id);
    }

    cellDisplay(cell: MonthCell, rowIndex: number, colIndex: number): string {
        if (this.isEditing(rowIndex, colIndex)) {
            return this.edit.draft;
        }
        if (this.month && cell.type.id === CELL_TYPE.number) {
            const row = this.month.rows[rowIndex];
            const filled = row ? columnFillAmount(this.workbook, this.month, row, colIndex) : null;
            if (filled != null) {
                return filled.toLocaleString('de-CH', {minimumFractionDigits: 2, maximumFractionDigits: 2});
            }
        }
        if (cell.error) {
            return cell.error;
        }
        const value = cell.display || cell.raw || '';
        if (cell.type.id === CELL_TYPE.date && value && !value.trim().startsWith('=')) {
            return CellFormatPipe.formatDate(value, this.month?.label.title ?? '');
        }
        return value;
    }

    onSelectChange(cell: MonthCell, row: MonthRow): void {
        this.edit.applySelectSideEffects(cell, row, this.optionsFor(cell));
        this.workbook.touch();
    }

    onBarCopy(event: ClipboardEvent): void {
        const cell = this.edit.activeCell();
        if (cell && this.edit.editingRow !== null && this.edit.editingCol !== null) {
            this.edit.onCopy(event, this.edit.editingRow, this.edit.editingCol, cell);
        }
    }

    onBarPaste(event: ClipboardEvent): void {
        const cell = this.edit.activeCell();
        if (cell && this.edit.editingRow !== null && this.edit.editingCol !== null) {
            this.edit.onPaste(event, this.edit.editingRow, this.edit.editingCol, cell);
        }
    }
}
