import {Component} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {MonthComponent} from '../month/month.component';
import {Month} from '../../model/Month';
import {ImportComponent} from '../import/import.component';
import {Button} from 'primeng/button';
import {CsvExportService} from '../../service/csv-export.service';

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

    protected import(months: Month[]): void {
        console.log("import", months);
        this.months = months;
        this.selectedMonth = this.months[0];
    }

    protected selectTab(month: Month): void {
        this.selectedMonth = month;
    }

    protected exportToCSV(): void {
        console.log("months", this.months);

        const csvData = CsvExportService.convertToCSV(this.months, this.months[0].columns);
        const blob = new Blob([csvData], {type: 'text/csv;charset=utf-8;'});
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'data.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // columns: MonthColumn[] = [
    //     new MonthColumn("Datum"),
    //     new MonthColumn("Text"),
    //     new MonthColumn("A 1", "number"),
    //     new MonthColumn("A 2", "number"),
    //     new MonthColumn("A 3", "number")
    // ];

    // months: Month[] = [
    //     this.createMonth(MonthKey.JAN),
    //     this.createMonth(MonthKey.FEB),
    //     this.createMonth(MonthKey.MÄR),
    //     this.createMonth(MonthKey.APR),
    //     this.createMonth(MonthKey.MAI),
    //     this.createMonth(MonthKey.JUN),
    //     this.createMonth(MonthKey.JUL),
    //     this.createMonth(MonthKey.AUG),
    //     this.createMonth(MonthKey.SEP),
    //     this.createMonth(MonthKey.OKT),
    //     this.createMonth(MonthKey.NOV),
    //     this.createMonth(MonthKey.DEZ)
    // ];

    // private createMonth(key: MonthKey): Month {
    //     return new Month(new MonthLabel(key), this.columns);
    // }

}
