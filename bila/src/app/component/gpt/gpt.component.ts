import { Component } from '@angular/core';
import {FormsModule} from '@angular/forms';

const COLS = 10;
const ROWS = 10;

function colToLetter(col: number): string {
    return String.fromCharCode(65 + col);
}

@Component({
    templateUrl: './gpt.component.html',
    imports: [
        FormsModule
    ],
    styleUrls: ['./gpt.component.css']
})
export class GptComponent {
    data: { [key: string]: string } = {};
    editing: string | null = null;

    cols = Array.from({ length: COLS }, (_, i) => i);
    rows = Array.from({ length: ROWS }, (_, i) => i);

    colToLetter = colToLetter;

    getKey(col: number, row: number): string {
        return `${colToLetter(col)}${row + 1}`;
    }

    getValue(ref: string): number {
        const content = this.data[ref] || '';
        if (content.startsWith('=')) {
            try {
                const expr = content.slice(1).replace(/([A-Z][0-9]+)/g, (match) => {
                    return this.getValue(match).toString();
                });
                // Allow only digits, operators, parentheses, decimal points, and spaces
                if (!/^[0-9+\-*/().\s]+$/.test(expr)) {
                    return NaN;
                }
                return this.evaluateExpression(expr);
            } catch {
                return NaN;
            }
        }
        const num = parseFloat(content);
        return isNaN(num) ? 0 : num;
    }

    private evaluateExpression(expr: string) {
        return new Function(`return ${expr}`)();
    }

    getDisplayValue(col: number, row: number): string {
        const key = this.getKey(col, row);
        if (this.editing === key) {
            return this.data[key] || '';
        }
        const val = this.data[key] || '';
        return val.startsWith('=') ? this.getValue(key).toString() : val;
    }

    updateComputed() {
        this.editing = null;
    }
}
