import {Injectable} from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class TableNavigationService {

    /** Optional hook (e.g. virtualization) invoked before focusing a cell. */
    static beforeFocus: ((monthTitle: string, row: number, col: number) => void) | null = null;

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
        monthTitle: string = '',
        homeCol: number = 0,
        endCol: number = Math.max(0, lastCol - 1)
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
                TableNavigationService.setFocus(monthTitle, rowIndex, homeCol);
                break;
            case 'End':
                TableNavigationService.setFocus(monthTitle, rowIndex, endCol);
                break;
        }
    }

    static setFocus(monthTitle: string, row: number, col: number): void {
        TableNavigationService.beforeFocus?.(monthTitle, row, col);
        queueMicrotask(() => {
            document.getElementById(TableNavigationService.cellId(monthTitle, row, col))?.focus();
        });
    }
}
