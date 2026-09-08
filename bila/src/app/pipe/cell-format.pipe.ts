import {Pipe, PipeTransform} from '@angular/core';
import {CELL_TYPE, CellType, FRACTION_DIGITS} from '../model/CellType';
import {MonthLabel} from '../model/MonthLabel';

@Pipe({
    name: 'cellFormat'
})
export class CellFormatPipe implements PipeTransform {
    transform(value: string, cellType: CellType, monthLabel: MonthLabel): string {
        if (value === null || value === undefined || value === '') {
            return '';
        }
        if (String(value).trim().startsWith('=')) {
            return value;
        }
        switch (cellType.id) {
            case CELL_TYPE.number:
                return this.transformNumber(value);
            case CELL_TYPE.date:
                return this.transformDate(value, monthLabel);
            default:
                return value;
        }
    }

    private transformNumber(value: string): string {
        const normalized = String(value).replace(/['’\s]/g, '').replace(',', '.');
        const numb = Number(normalized);
        if (!isNaN(numb) && Number.isFinite(numb)) {
            return this.formatNumber(numb, FRACTION_DIGITS.CHF);
        }
        return value;
    }

    private formatNumber(numb: number, format: FRACTION_DIGITS): string {
        return numb.toLocaleString('en-US', {
            minimumFractionDigits: format,
            maximumFractionDigits: format
        }).replace(/,/g, "'");
    }

    private transformDate(value: string, monthLabel: MonthLabel): string {
        const split: string[] = value.split('.');
        return `${this.enterDate(split[0])}. ${monthLabel.title}`;
    }

    private enterDate(date: string): string {
        return date.length < 2 ? '0' + date : date;
    }
}
