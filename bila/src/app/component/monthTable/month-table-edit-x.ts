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
        this.range.reset(rowIndex, colIndex);
    }

    override onCopy(event: ClipboardEvent, rowIndex: number, colIndex: number, cell: MonthCell): void {
        if (this.range.multi()) {
            event.preventDefault();
            event.clipboardData?.setData('text/plain', this.range.copyTsv(this.monthRef()));
            return;
        }
        super.onCopy(event, rowIndex, colIndex, cell);
    }

    override onKeydown(event: KeyboardEvent, rowIndex: number, colIndex: number, cell: MonthCell): void {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)
            && (event.shiftKey || event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            const from = this.range;
            const next = (event.ctrlKey || event.metaKey)
                ? from.jump(this.monthRef(), from.focusRow, from.focusCol, event.key)
                : from.step(this.monthRef(), from.focusRow, from.focusCol, event.key);
            if (event.shiftKey) {
                from.extend(next.row, next.col);
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
        if (this.range.dragging && !this.refPickMode) {
            this.range.extend(rowIndex, colIndex);
        }
    }

    endDrag(): void {
        this.range.dragging = false;
    }

    inRange(rowIndex: number, colIndex: number): boolean {
        return this.range.contains(rowIndex, colIndex);
    }
}
