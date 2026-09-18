import {describe, it, expect, beforeEach} from 'vitest';
import {ConstantDef, WorkbookService} from './workbook.service';
import {FormulaService} from './formula.service';
import {TableHistoryService} from './table-history.service';
import {CurrencyFxService} from './currency-fx.service';
import {Month} from '../model/Month';
import {MonthLabel, MonthKey} from '../model/MonthLabel';
import {MonthColumn} from '../model/MonthColumn';
import {MonthRow} from '../model/MonthRow';
import {CELL_TYPE} from '../model/CellType';
import {SECTION} from '../model/Section';

describe('WorkbookService constant API (ex-Year patches)', () => {
    let workbook: WorkbookService;

    beforeEach(() => {
        workbook = new WorkbookService(new FormulaService(), new TableHistoryService(), new CurrencyFxService());
    });

    it('resolves ↑ to the previous month amount', () => {
        const item: ConstantDef = {
            id: '1',
            name: 'Miete',
            person: '',
            account: 'K',
            months: ['100', '↑', '↑', '0', '0', '0', '0', '0', '0', '0', '0', '0']
        };
        expect(workbook.constantAmount(item, 'Jan')).toBe(100);
        expect(workbook.constantAmount(item, 'Feb')).toBe(100);
        expect(workbook.constantAmount(item, 'Mär')).toBe(100);
    });

    it('matchConstant ignores column-fill constants', () => {
        workbook.constants.set([
            {id: 'c', name: 'X', person: '§COL', account: '', months: Array(12).fill('1')}
        ]);
        const columns = [
            new MonthColumn('Text', CELL_TYPE.text, SECTION.DEFAULT),
            new MonthColumn('A', CELL_TYPE.number, SECTION.AUSGANG)
        ];
        const month = new Month(new MonthLabel(MonthKey.JAN), columns);
        const row = new MonthRow(0, columns);
        row.cells[0].raw = 'X';
        month.rows.push(row);
        expect(workbook.matchConstant(month, row)).toBeNull();
    });

    it('constantHit credits payer account when constant has account only', () => {
        const item: ConstantDef = {
            id: '1',
            name: 'Fee',
            person: '',
            account: 'K',
            months: Array.from({length: 12}, () => '50')
        };
        workbook.constants.set([item]);
        const columns = [
            new MonthColumn('Text', CELL_TYPE.text, SECTION.DEFAULT),
            new MonthColumn('Pers', CELL_TYPE.select_person, SECTION.DEFAULT),
            new MonthColumn('Acc', CELL_TYPE.select_account, SECTION.DEFAULT)
        ];
        const month = new Month(new MonthLabel(MonthKey.JAN), columns);
        const row = new MonthRow(0, columns);
        row.cells[0].raw = 'Fee';
        row.cells[1].raw = 'P';
        row.cells[2].raw = 'B';
        month.rows.push(row);
        const hit = workbook.constantHit(month, row);
        expect(hit?.amount).toBe(50);
        expect(hit?.debitKey).toBe('P|B');
        expect(hit?.creditKey).toBe('P|K');
    });
});
