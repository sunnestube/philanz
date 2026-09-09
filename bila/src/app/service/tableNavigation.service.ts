import {Injectable} from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class TableNavigationService {

    static cellId(monthTitle: string, rowIndex: number, colIndex: number): string {
        return `cell_${TableNavigationService.monthKey(monthTitle)}_${rowIndex}_${colIndex}`;
    }

    static monthKey(monthTitle: string): string {
        return (monthTitle || 'mon').replace(/[^A-Za-z0-9ÄÖÜäöü]/g, '');
    }

    static navigate(
        key: string,
        rowIndex: number,
        colIndex: number,
        lastCol: number = colIndex,
        monthTitle: string = ''
    ): void {
        switch (key) {
            case 'ArrowRight':
                TableNavigationService.setFocus(monthTitle, rowIndex, colIndex + 1);
                break;
            case 'ArrowLeft':
                TableNavigationService.setFocus(monthTitle, rowIndex, colIndex - 1);
                break;
            case 'ArrowDown':
            case 'Enter':
                TableNavigationService.setFocus(monthTitle, rowIndex + 1, colIndex);
                break;
            case 'ArrowUp':
                TableNavigationService.setFocus(monthTitle, rowIndex - 1, colIndex);
                break;
            case 'Home':
                TableNavigationService.setFocus(monthTitle, rowIndex, 2);
                break;
            case 'End':
                TableNavigationService.setFocus(monthTitle, rowIndex, lastCol - 1);
                break;
        }
    }

    private static setFocus(monthTitle: string, row: number, col: number): void {
        const cell = document.getElementById(TableNavigationService.cellId(monthTitle, row, col));
        if (cell) {
            cell.focus();
        }
    }
}
