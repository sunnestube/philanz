import {Component, inject} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {MonthComponent} from '../month/month.component';
import {Month} from '../../model/Month';
import {ImportComponent} from '../import/import.component';
import {Button} from 'primeng/button';
import {WorkbookService} from '../../service/workbook.service';
import {SaldoPanelComponent} from '../saldoPanel/saldo-panel.component';

@Component({
    templateUrl: './year.component.html',
    imports: [
        FormsModule,
        MonthComponent,
        ImportComponent,
        Button,
        SaldoPanelComponent
    ],
    styleUrls: ['./year.component.css']
})
export class YearComponent {
    readonly workbook = inject(WorkbookService);

    protected import(months: Month[]): void {
        this.workbook.setMonths(months);
    }

    protected selectTab(month: Month): void {
        this.workbook.selectMonth(month);
    }

    protected save(): void {
        const csvData = this.workbook.toCsv();
        if (csvData) {
            localStorage.setItem('year', csvData);
        }
    }

    protected exportToCSV(): void {
        const csvData = this.workbook.toCsv();
        if (!csvData) {
            return;
        }
        const blob = new Blob([csvData], {type: 'text/csv;charset=utf-8;'});
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'jahr.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
}
