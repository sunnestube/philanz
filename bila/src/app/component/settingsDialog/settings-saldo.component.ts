import {Component, inject} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {WorkbookService} from '../../service/workbook.service';
import {installSaldoOrder, orderedSaldoCombos} from '../../service/saldo-order';

@Component({
    selector: 'bal-settings-saldo',
    standalone: true,
    imports: [FormsModule],
    styleUrl: './settings-dialog.component.css',
    templateUrl: './settings-saldo.component.html'
})
export class SettingsSaldoComponent {
    readonly workbook = inject(WorkbookService);

    constructor() {
        installSaldoOrder(this.workbook);
    }

    combos() {
        return orderedSaldoCombos(this.workbook);
    }

    visible(key: string): boolean {
        return this.workbook.saldoColumnPrefs()[key]?.visible !== false;
    }

    title(key: string, fallback: string): string {
        return this.workbook.saldoColumnPrefs()[key]?.title || fallback;
    }

    onDragStart(event: DragEvent, key: string): void {
        event.dataTransfer?.setData('text/plain', key);
        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move';
        }
    }

    onDragOver(event: DragEvent): void {
        event.preventDefault();
    }

    onDrop(event: DragEvent, targetKey: string): void {
        event.preventDefault();
        const key = event.dataTransfer?.getData('text/plain');
        if (key) {
            this.workbook.moveSaldoComboTo(key, targetKey);
        }
    }
}
