import {CELL_TYPE} from '../../model/CellType';
import {Month} from '../../model/Month';
import {FormulaService} from '../../service/formula.service';
import {SaldoCombo, WorkbookService} from '../../service/workbook.service';
import {
    ColumnView,
    FooterRowView,
    SaldoCellView,
    SaldoColView,
    formatSaldo,
    saldoCellView
} from './month-table.vm';

export class MonthTableSaldo {
    private cachedRev = -1;
    private cachedTitle = '';
    private cachedRunning: Array<Record<string, number>> = [];
    private cachedFooterRev = -1;
    private cachedFooterTitle = '';
    private cachedFooter: FooterRowView[] | null = null;

    constructor(
        private readonly workbook: WorkbookService,
        private readonly formulaService: FormulaService,
        private readonly monthOf: () => Month | undefined
    ) {}

    invalidate(): void {
        this.cachedRev = -1;
        this.cachedFooterRev = -1;
        this.cachedFooter = null;
    }

    combos(): SaldoCombo[] {
        this.workbook.revision();
        return this.workbook.visibleSaldoCombos();
    }

    runningRows(): Array<Record<string, number>> {
        const rev = this.workbook.revision();
        const title = (this.monthOf()?.label.title ?? '') + '|' + this.workbook.fx.displayCurrency();
        if (this.cachedRev === rev && this.cachedTitle === title) {
            return this.cachedRunning;
        }
        this.cachedRunning = this.workbook.runningSaldosForMonth(this.monthOf());
        this.cachedRev = rev;
        this.cachedTitle = title;
        return this.cachedRunning;
    }

    saldoAt(rowIndex: number, key: string): number {
        return this.runningRows()[rowIndex]?.[key] ?? 0;
    }

    previousSaldo(rowIndex: number, key: string): number {
        if (rowIndex <= 0) {
            const [person, account] = key.split('|');
            return this.workbook.openingOf(person, account);
        }
        return this.runningRows()[rowIndex - 1]?.[key] ?? 0;
    }

    saldoDelta(rowIndex: number, key: string): number {
        return this.saldoAt(rowIndex, key) - this.previousSaldo(rowIndex, key);
    }

    saldoTotal(rowIndex: number): number {
        const row = this.runningRows()[rowIndex];
        return row ? Object.values(row).reduce((sum, value) => sum + value, 0) : 0;
    }

    saldoTotalDelta(rowIndex: number): number {
        const current = this.saldoTotal(rowIndex);
        if (rowIndex <= 0) {
            return current - this.workbook.openingGrandTotal();
        }
        return current - this.saldoTotal(rowIndex - 1);
    }

    rowSaldos(header: SaldoColView[], rowIndex: number): SaldoCellView[] {
        const day = this.rowDay(rowIndex);
        return header.map((col) => saldoCellView(
            col,
            this.workbook.fx.toDisplay(this.saldoAt(rowIndex, col.key), day),
            this.workbook.fx.toDisplay(this.saldoDelta(rowIndex, col.key), day)
        ));
    }

    rowTotal(rowIndex: number): SaldoCellView | null {
        if (!this.workbook.saldoTotalVisible() || !this.combos().length) {
            return null;
        }
        const day = this.rowDay(rowIndex);
        return saldoCellView(
            {key: 'total', person: '', personClass: 'total-col', title: this.workbook.saldoTotalTitle(), first: false},
            this.workbook.fx.toDisplay(this.saldoTotal(rowIndex), day),
            this.workbook.fx.toDisplay(this.saldoTotalDelta(rowIndex), day)
        );
    }

    private rowDay(rowIndex: number): number {
        const month = this.monthOf();
        return this.workbook.fx.dayIndexForRow(month, month?.rows[rowIndex]);
    }

    footerRows(): Array<{person: string | null; label: string; color: string}> {
        this.workbook.revision();
        return [
            ...this.workbook.personCodes().map((person) => ({
                person,
                label: `Total ${this.workbook.personLabel(person)}`,
                color: person.toLowerCase()
            })),
            {person: null, label: 'Total', color: 'grand'}
        ];
    }

    footerViews(columns: ColumnView[], saldos: SaldoColView[]): FooterRowView[] {
        const rev = this.workbook.revision();
        const title = (this.monthOf()?.label.title ?? '') + '|' + this.workbook.fx.displayCurrency();
        if (this.cachedFooter && this.cachedFooterRev === rev && this.cachedFooterTitle === title) {
            return this.cachedFooter;
        }
        const rows = this.footerRows();
        this.cachedFooterRev = rev;
        this.cachedFooterTitle = title;
        this.cachedFooter = rows.map((foot, index) => ({
            ...foot,
            offset: `${Math.max(0, rows.length - 1 - index) * 20}px`,
            cells: columns.map((column) => ({
                text: this.footerValue(foot.person, column.index),
                cssType: column.cssType,
                section: column.section
            })),
            saldos: saldos.map((col) => {
                const value = this.footerSaldo(foot.person, col.key);
                const day = this.footerDay();
                const view = saldoCellView(col, value == null ? 0 : this.workbook.fx.toDisplay(value, day), 0);
                return value === null ? {...view, text: ''} : view;
            }),
            total: this.workbook.saldoTotalVisible() && saldos.length
                ? saldoCellView(
                    {key: 'total', person: '', personClass: 'total-col', title: this.workbook.saldoTotalTitle(), first: false},
                    this.workbook.fx.toDisplay(this.footerSaldoTotal(foot.person), this.footerDay()),
                    0
                )
                : null
        }));
        return this.cachedFooter;
    }

    extraColCount(): number {
        if (!this.workbook.saldoColumnsOpen()) {
            return 0;
        }
        const combos = this.combos().length;
        return combos ? combos + (this.workbook.saldoTotalVisible() ? 1 : 0) : 0;
    }

    private footerDay(): number {
        const month = this.monthOf();
        const rows = month?.rows ?? [];
        const last = rows[rows.length - 1];
        return this.workbook.fx.dayIndexForRow(month, last);
    }

    private footerLabelCol(): number {
        const columns = this.monthOf()?.columns ?? [];
        const text = columns.findIndex((column) => column.type === CELL_TYPE.text);
        return text >= 0 ? text : columns.findIndex((column) => column.type === CELL_TYPE.date);
    }

    private footerValue(person: string | null, colIndex: number): string {
        const column = this.monthOf()?.columns[colIndex];
        if (!column) {
            return '';
        }
        if (colIndex === this.footerLabelCol()) {
            return person ? `Total ${this.workbook.personLabel(person)}` : 'Total';
        }
        if (column.type === CELL_TYPE.select_person) {
            return person ?? '';
        }
        if (column.type !== CELL_TYPE.number) {
            return '';
        }
        return formatSaldo(this.footerSum(person, colIndex));
    }

    private footerSum(person: string | null, colIndex: number): number {
        const month = this.monthOf();
        if (!month) {
            return 0;
        }
        const personIdx = month.columns.findIndex((column) => column.type === CELL_TYPE.select_person);
        let sum = 0;
        month.rows.forEach((row) => {
            if (person) {
                const code = (row.cells[personIdx]?.raw ?? '').trim().toUpperCase();
                if (code !== person) {
                    return;
                }
            }
            const cell = row.cells[colIndex];
            const amountChf = this.formulaService.toNumber(cell?.display || cell?.raw || '') ?? 0;
            const day = this.workbook.fx.dayIndexForRow(month, row);
            sum += this.workbook.fx.toDisplay(amountChf, day);
        });
        return sum;
    }

    private footerSaldo(person: string | null, key: string): number | null {
        const [comboPerson] = key.split('|');
        if (person && comboPerson !== person) {
            return null;
        }
        const rows = this.runningRows();
        const last = rows[rows.length - 1];
        if (last) {
            return last[key] ?? 0;
        }
        const [, account] = key.split('|');
        return person ? this.workbook.openingOf(person, account) : this.workbook.openingOf(comboPerson, account);
    }

    private footerSaldoTotal(person: string | null): number {
        return this.combos().reduce((sum, combo) => sum + (this.footerSaldo(person, combo.key) ?? 0), 0);
    }
}
