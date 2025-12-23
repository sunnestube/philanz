import {Injectable} from "@angular/core";
import {Month} from '../model/Month';
import {MonthColumn} from '../model/MonthColumn';
import {MonthKey, MonthLabel} from '../model/MonthLabel';
import {MonthCell} from '../model/MonthCell';
import {MonthRow} from '../model/MonthRow';
import {CELL_TYPE, CellType} from '../model/CellType';
import {SECTION} from '../model/Section';

@Injectable({
    providedIn: "root",
})
export class TableNavigationService {

    static navigate(key: string, rowIndex: number, colIndex: number, lastCol: number = colIndex): void {
        //console.log("key", key, rowIndex, colIndex, lastCol);
        switch (key) {
            case 'ArrowRight':
                TableNavigationService.setFocus(rowIndex, colIndex + 1);
                break;
            case 'ArrowLeft':
                TableNavigationService.setFocus(rowIndex, colIndex - 1);
                break;
            case 'ArrowDown':
            case 'Enter':
                TableNavigationService.setFocus(rowIndex + 1, colIndex);
                break;
            case 'ArrowUp':
                TableNavigationService.setFocus(rowIndex - 1, colIndex);
                break;
            case 'Home':
                TableNavigationService.setFocus(rowIndex, 2);
                break;
            case 'End':
                TableNavigationService.setFocus(rowIndex, lastCol - 1);
                break;
            case 'Del':
                console.log("inhalt löschen nicht implementiert");
                break;
        }
    }

    private static setFocus(row: number, col: number) {
        const cell = document.getElementById(`cell_${row}_${col}`)
        console.log("cell", `cell_${row}_${col}`, cell)
        if (cell) {
            cell.focus();
        }
    }
}
