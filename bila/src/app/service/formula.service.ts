import {Injectable} from '@angular/core';
import {Month} from '../model/Month';
import {MonthCell} from '../model/MonthCell';
import {CELL_TYPE} from '../model/CellType';
import {MonthKey} from '../model/MonthLabel';

export interface CellAddress {
    monthTitle: string | null;
    col: number;
    row: number;
    colAbs: boolean;
    rowAbs: boolean;
    token: string;
}

export interface FormulaClipboard {
    raw: string;
    col: number;
    row: number;
}

@Injectable({
    providedIn: 'root'
})
export class FormulaService {
    months: Month[] = [];
    clipboard: FormulaClipboard | null = null;

    setMonths(months: Month[]): void {
        this.months = months;
        this.recalculateAll();
    }

    recalculateAll(): void {
        for (const month of this.months) {
            for (const row of month.rows) {
                for (const cell of row.cells) {
                    cell.error = null;
                    cell.display = '';
                }
            }
        }
        for (const month of this.months) {
            for (const row of month.rows) {
                for (const cell of row.cells) {
                    this.evaluateCell(month, cell, new Set<string>());
                }
            }
        }
    }

    isFormula(raw: string | null | undefined): boolean {
        return !!raw && raw.trim().startsWith('=');
    }

    addressFor(colIndex: number, rowIndex: number, monthTitle?: string): string {
        const local = `${this.columnLetter(colIndex)}${rowIndex + 1}`;
        return monthTitle ? `${monthTitle}!${local}` : local;
    }

    columnLetter(index: number): string {
        let n = index + 1;
        let letters = '';
        while (n > 0) {
            const rem = (n - 1) % 26;
            letters = String.fromCharCode(65 + rem) + letters;
            n = Math.floor((n - 1) / 26);
        }
        return letters;
    }

    shiftAfterColumnRemoved(removedIndex: number): void {
        this.rewriteFormulaRefs((col, colAbs) => {
            if (colAbs) {
                return col;
            }
            if (col === removedIndex) {
                return null;
            }
            return col > removedIndex ? col - 1 : col;
        });
    }

    shiftAfterColumnInserted(insertedIndex: number): void {
        this.rewriteFormulaRefs((col, colAbs) => {
            if (colAbs) {
                return col;
            }
            return col >= insertedIndex ? col + 1 : col;
        });
    }

    rewriteFormulaRefs(mapColumn: (col: number, colAbs: boolean) => number | null): void {
        const pattern = /(?:([A-Za-zÄÖÜäöü]{3})!)?(\$)?([A-Za-z]+)(\$)?(\d+)/g;
        for (const month of this.months) {
            for (const row of month.rows) {
                for (const cell of row.cells) {
                    const raw = cell.raw ?? '';
                    if (!raw.trim().startsWith('=')) {
                        continue;
                    }
                    cell.raw = raw.replace(pattern, (full, monthName, colDollar, letters, rowDollar, digits) => {
                        const col = this.letterToIndex(String(letters).toUpperCase());
                        const colAbs = !!colDollar;
                        const nextCol = mapColumn(col, colAbs);
                        if (nextCol === null) {
                            return '#BEZUG!';
                        }
                        const next = `${colDollar ?? ''}${this.columnLetter(nextCol)}${rowDollar ?? ''}${digits}`;
                        return monthName ? `${monthName}!${next}` : next;
                    });
                }
            }
        }
    }

    parseAddress(token: string, fallbackMonth: string): CellAddress | null {
        const match = token.trim().match(/^(?:([A-Za-zÄÖÜäöü]{3})!)?(\$)?([A-Za-z]+)(\$)?(\d+)$/);
        if (!match) {
            return null;
        }
        const monthTitle = match[1] ? this.normalizeMonthTitle(match[1]) : fallbackMonth;
        const colAbs = !!match[2];
        const letters = match[3].toUpperCase();
        const rowAbs = !!match[4];
        const col = this.letterToIndex(letters);
        const row = Number(match[5]) - 1;
        if (col < 0 || row < 0) {
            return null;
        }
        const local = `${colAbs ? '$' : ''}${letters}${rowAbs ? '$' : ''}${match[5]}`;
        return {
            monthTitle,
            col,
            row,
            colAbs,
            rowAbs,
            token: monthTitle && monthTitle !== fallbackMonth
                ? `${monthTitle}!${local}`
                : local
        };
    }

    copyFormula(raw: string, col: number, row: number): string {
        const text = raw ?? '';
        this.clipboard = {raw: text, col, row};
        return text;
    }

    pasteFormula(targetCol: number, targetRow: number, clipboardText?: string): string {
        const text = (clipboardText ?? this.clipboard?.raw ?? '').trim();
        if (!text) {
            return '';
        }
        const source = this.clipboard && (!clipboardText || this.sameFormula(clipboardText, this.clipboard.raw))
            ? this.clipboard
            : null;
        if (!this.isFormula(text) || !source) {
            return text;
        }
        return this.adjustFormula(text, source.col, source.row, targetCol, targetRow);
    }

    adjustFormula(raw: string, fromCol: number, fromRow: number, toCol: number, toRow: number): string {
        const pattern = /(?:([A-Za-zÄÖÜäöü]{3})!)?(\$)?([A-Za-z]+)(\$)?(\d+)/g;
        return raw.replace(pattern, (full, monthName, colDollar, letters, rowDollar, digits) => {
            const colAbs = !!colDollar;
            const rowAbs = !!rowDollar;
            const col = this.letterToIndex(String(letters).toUpperCase());
            const row = Number(digits) - 1;
            const nextCol = colAbs ? col : col + (toCol - fromCol);
            const nextRow = rowAbs ? row : row + (toRow - fromRow);
            if (nextCol < 0 || nextRow < 0) {
                return '#BEZUG!';
            }
            const local = `${colAbs ? '$' : ''}${this.columnLetter(nextCol)}${rowAbs ? '$' : ''}${nextRow + 1}`;
            return monthName ? `${monthName}!${local}` : local;
        });
    }

    evaluateCell(month: Month, cell: MonthCell, visiting: Set<string>): number | string {
        const key = this.cellKey(month.label.title, cell.columnIndex, cell.rowIndex);
        if (cell.display !== '' && cell.error === null && !visiting.has(key)) {
            const numeric = this.toNumber(cell.display);
            return numeric === null ? cell.display : numeric;
        }
        if (visiting.has(key)) {
            cell.error = '#ZYKLUS!';
            cell.display = '#ZYKLUS!';
            return cell.display;
        }

        const raw = (cell.raw ?? cell.value ?? '').trim();
        if (!this.isFormula(raw)) {
            if (!raw) {
                cell.display = '';
                cell.error = null;
                return 0;
            }
            const asNumber = this.toNumber(raw);
            if (asNumber !== null && this.isNumericType(cell)) {
                cell.display = this.formatNumber(asNumber);
                return asNumber;
            }
            cell.display = raw;
            return asNumber !== null ? asNumber : raw;
        }

        visiting.add(key);
        try {
            const result = this.evaluateExpression(raw.slice(1), month, visiting);
            if (typeof result === 'number' && Number.isFinite(result)) {
                cell.display = this.formatNumber(result);
                cell.error = null;
                return result;
            }
            cell.display = String(result);
            return result;
        } catch (err) {
            const message = err instanceof Error ? err.message : '#ERR';
            cell.error = message;
            cell.display = message;
            return message;
        } finally {
            visiting.delete(key);
        }
    }

    private evaluateExpression(source: string, month: Month, visiting: Set<string>): number {
        const tokens = this.tokenize(source);
        let index = 0;
        const peek = (): string | undefined => tokens[index];
        const consume = (): string => {
            const token = tokens[index];
            index++;
            return token;
        };
        const parseExpression = (): number => {
            let value = parseTerm();
            while (peek() === '+' || peek() === '-') {
                const op = consume();
                const right = parseTerm();
                value = op === '+' ? value + right : value - right;
            }
            return value;
        };
        const parseTerm = (): number => {
            let value = parseFactor();
            while (peek() === '*' || peek() === '/' || peek() === '×' || peek() === '÷') {
                const op = consume();
                const right = parseFactor();
                if (op === '/' || op === '÷') {
                    if (right === 0) {
                        throw new Error('#DIV/0!');
                    }
                    value = value / right;
                } else {
                    value = value * right;
                }
            }
            return value;
        };
        const parseFactor = (): number => {
            const token = peek();
            if (token === '+' || token === '-') {
                consume();
                const value = parseFactor();
                return token === '-' ? -value : value;
            }
            if (token === '(') {
                consume();
                const value = parseExpression();
                if (peek() !== ')') {
                    throw new Error('#ERR');
                }
                consume();
                return value;
            }
            if (token === undefined) {
                throw new Error('#ERR');
            }
            consume();
            if (this.isNumberToken(token)) {
                const value = this.toNumber(token);
                if (value === null) {
                    throw new Error('#ERR');
                }
                return value;
            }
            const address = this.parseAddress(token, month.label.title);
            if (!address) {
                throw new Error('#NAME?');
            }
            const target = this.findCell(address);
            if (!target) {
                const monthExists = this.months.some((item) =>
                    item.label.title === address.monthTitle
                    || item.label.title.toLowerCase() === address.monthTitle?.toLowerCase()
                );
                if (!monthExists) {
                    throw new Error('#BEZUG!');
                }
                return 0;
            }
            const resolved = this.evaluateCell(target.month, target.cell, visiting);
            if (typeof resolved === 'number') {
                return resolved;
            }
            if (resolved === '' || resolved === null || resolved === undefined) {
                return 0;
            }
            const numeric = this.toNumber(String(resolved));
            if (numeric === null) {
                if (!String(resolved).trim()) {
                    return 0;
                }
                throw new Error('#WERT!');
            }
            return numeric;
        };
        const result = parseExpression();
        if (index !== tokens.length) {
            throw new Error('#ERR');
        }
        return result;
    }

    private tokenize(source: string): string[] {
        const tokens: string[] = [];
        const input = source.replace(/\s+/g, '');
        const pattern = /([A-Za-zÄÖÜäöü]{3}!)?\$?[A-Za-z]+\$?\d+|\d+(?:['’]\d{3})*(?:[.,]\d+)?|[+\-*/×÷()]|[A-Za-zÄÖÜäöü]+/g;
        let match: RegExpExecArray | null;
        let cursor = 0;
        while ((match = pattern.exec(input)) !== null) {
            if (match.index !== cursor) {
                throw new Error('#ERR');
            }
            tokens.push(match[0]);
            cursor = match.index + match[0].length;
        }
        if (cursor !== input.length) {
            throw new Error('#ERR');
        }
        return tokens;
    }

    private findCell(address: CellAddress): {month: Month; cell: MonthCell} | null {
        const month = this.months.find((item) => item.label.title === address.monthTitle)
            ?? this.months.find((item) => item.label.title.toLowerCase() === address.monthTitle?.toLowerCase());
        if (!month) {
            return null;
        }
        const row = month.rows[address.row];
        const cell = row?.cells[address.col];
        if (!cell) {
            return null;
        }
        return {month, cell};
    }

    private cellKey(monthTitle: string, col: number, row: number): string {
        return `${monthTitle}!${this.columnLetter(col)}${row + 1}`;
    }

    private letterToIndex(letters: string): number {
        let n = 0;
        for (const ch of letters) {
            n = n * 26 + (ch.charCodeAt(0) - 64);
        }
        return n - 1;
    }

    private normalizeMonthTitle(value: string): string {
        const match = Object.values(MonthKey).find(
            (key) => key.toLowerCase() === value.toLowerCase()
        );
        return match ?? value;
    }

    private isNumericType(cell: MonthCell): boolean {
        return cell.type?.id === CELL_TYPE.number || cell.type?.id === CELL_TYPE.none;
    }

    private isNumberToken(token: string): boolean {
        return this.toNumber(token) !== null;
    }

    private sameFormula(a: string, b: string): boolean {
        return a.replace(/^\s+|\s+$/g, '') === b.replace(/^\s+|\s+$/g, '');
    }

    toNumber(value: string): number | null {
        if (value === null || value === undefined) {
            return null;
        }
        const trimmed = String(value).trim();
        if (!trimmed || trimmed.startsWith('=')) {
            return null;
        }
        const normalized = trimmed.replace(/['’\s]/g, '').replace(',', '.');
        if (!/^[+-]?\d+(\.\d+)?$/.test(normalized)) {
            return null;
        }
        const numb = Number(normalized);
        return Number.isFinite(numb) ? numb : null;
    }

    formatNumber(value: number): string {
        return value.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).replace(/,/g, "'");
    }
}
