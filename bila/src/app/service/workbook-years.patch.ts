import {Month} from '../model/Month';
import {MonthRow} from '../model/MonthRow';
import {CELL_TYPE} from '../model/CellType';
import {WorkbookService} from './workbook.service';

type Book = WorkbookService & {
    persistSettings(): void;
};

WorkbookService.prototype.moveConstant = function (this: Book, id: string, toIndex: number): void {
    const list = [...this.constants()];
    const from = list.findIndex((item) => item.id === id);
    if (from < 0) {
        return;
    }
    const target = Math.max(0, Math.min(list.length - 1, toIndex));
    if (from === target) {
        return;
    }
    const [item] = list.splice(from, 1);
    list.splice(target, 0, item);
    this.constants.set(list);
    this.persistSettings();
    this.touch();
};

const originalHit = WorkbookService.prototype.constantHit;
WorkbookService.prototype.constantHit = function (this: Book, month: Month, row: MonthRow) {
    const hit = originalHit.call(this, month, row);
    if (!hit) {
        return null;
    }
    const match = this.matchConstant(month, row);
    if (!match || (match.person && match.account)) {
        return hit;
    }
    const personIdx = month.columns.findIndex((column) => column.type === CELL_TYPE.select_person);
    const accountIdx = month.columns.findIndex((column) => column.type === CELL_TYPE.select_account);
    const payer = (row.cells[personIdx]?.raw ?? '').trim().toUpperCase();
    const payerAccount = (row.cells[accountIdx]?.raw ?? '').trim().toUpperCase();
    const creditPerson = match.person || payer;
    const creditAccount = match.account || (!match.person ? payerAccount : '');
    const creditKey = creditPerson && creditAccount ? `${creditPerson}|${creditAccount}` : null;
    return {...hit, creditKey};
};

declare module './workbook.service' {
    interface WorkbookService {
        moveConstant(id: string, toIndex: number): void;
    }
}
