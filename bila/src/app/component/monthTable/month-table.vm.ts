import {CELL_TYPE} from '../../model/CellType';
import {Month} from '../../model/Month';
import {MonthColumn} from '../../model/MonthColumn';
import {SaldoCombo, WorkbookService} from '../../service/workbook.service';

export interface ColumnView {
    index: number;
    title: string;
    type: string;
    section: string;
    cssType: string;
    letter: string;
    isText: boolean;
}

export interface SaldoColView {
    key: string;
    person: string;
    personClass: string;
    title: string;
    first: boolean;
}

export interface SaldoCellView extends SaldoColView {
    value: number;
    delta: number;
    up: boolean;
    down: boolean;
    neg: boolean;
    zero: boolean;
    text: string;
}

export interface FooterRowView {
    person: string | null;
    label: string;
    color: string;
    offset: string;
    cells: Array<{text: string; cssType: string; section: string}>;
    saldos: SaldoCellView[];
    total: SaldoCellView | null;
}

export function cssTypeOf(type: string): string {
    return String(type).split('_')[0];
}

export function formatSaldo(value: number): string {
    return value.toLocaleString('de-CH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

export function columnViews(columns: MonthColumn[], letterOf: (index: number) => string): ColumnView[] {
    return columns.map((column, index) => ({
        index,
        title: column.title,
        type: String(column.type),
        section: String(column.section),
        cssType: cssTypeOf(String(column.type)),
        letter: letterOf(index),
        isText: column.type === CELL_TYPE.text
    }));
}

export function saldoColViews(combos: SaldoCombo[], titleOf: (combo: SaldoCombo) => string): SaldoColView[] {
    return combos.map((combo, index) => ({
        key: combo.key,
        person: combo.person,
        personClass: combo.person.toLowerCase(),
        title: titleOf(combo),
        first: index === 0
    }));
}

export function saldoCellView(
    col: SaldoColView,
    value: number,
    delta: number
): SaldoCellView {
    return {
        ...col,
        value,
        delta,
        up: delta > 0,
        down: delta < 0,
        neg: value < 0,
        zero: value === 0,
        text: formatSaldo(value)
    };
}
