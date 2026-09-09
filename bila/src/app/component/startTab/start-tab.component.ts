import {Component, inject} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {WorkbookService} from '../../service/workbook.service';

@Component({
    selector: 'bal-start-tab',
    standalone: true,
    imports: [FormsModule],
    templateUrl: './start-tab.component.html',
    styleUrl: './start-tab.component.css'
})
export class StartTabComponent {
    readonly workbook = inject(WorkbookService);

    display(person: string, account: string): string {
        const value = this.workbook.openingOf(person, account);
        return value === 0 ? '' : value.toString();
    }

    onChange(person: string, account: string, event: Event): void {
        const raw = (event.target as HTMLInputElement).value.trim().replace("'", '').replace(',', '.');
        const value = raw === '' ? 0 : Number(raw);
        this.workbook.setOpening(person, account, Number.isFinite(value) ? value : 0);
    }

    format(value: number): string {
        return value.toLocaleString('de-CH', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    }
}
