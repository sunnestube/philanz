import {Component} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {MonthComponent} from '../month/month.component';
import {Month} from '../../model/Month';
import {ImportComponent} from '../import/import.component';
import {Button} from 'primeng/button';
import {CsvExportService} from '../../service/csv-export.service';
import {FormulaService} from '../../service/formula.service';

@Component({
    templateUrl: './year.component.html',
    imports: [
        FormsModule,
        MonthComponent,
        ImportComponent,
        Button
    ],
    styleUrls: ['./year.component.css']
})
export class YearComponent {

    protected months: Month[] = [];
    protected selectedMonth: Month = this.months[0];

    constructor(private readonly formulaService: FormulaService) {
    }

    protected import(months: Month[]): void {
        this.months = months;
        this.selectedMonth = this.months[0];
        this.formulaService.setMonths(this.months);
    }

    protected selectTab(month: Month): void {
        this.selectedMonth = month;
    }

    protected save(): void {
        if (!this.months.length) {
            return;
        }
        const csvData = CsvExportService.convertToCSV(this.months, this.months[0].columns);
        localStorage.setItem('year', csvData);
    }

    protected exportToCSV(): void {
        if (!this.months.length) {
            return;
        }
        const csvData = CsvExportService.convertToCSV(this.months, this.months[0].columns);
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
