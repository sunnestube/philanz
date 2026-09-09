import {Component, inject, OnInit} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {HttpClient} from '@angular/common/http';
import {MonthComponent} from '../month/month.component';
import {Month} from '../../model/Month';
import {ImportComponent} from '../import/import.component';
import {Button} from 'primeng/button';
import {WorkbookService, YearView} from '../../service/workbook.service';
import {SaldoPanelComponent} from '../saldoPanel/saldo-panel.component';
import {StartTabComponent} from '../startTab/start-tab.component';
import {YearTotalComponent} from '../yearTotal/year-total.component';
import {YearGrafComponent} from '../yearGraf/year-graf.component';

@Component({
    templateUrl: './year.component.html',
    imports: [
        FormsModule,
        MonthComponent,
        ImportComponent,
        Button,
        SaldoPanelComponent,
        StartTabComponent,
        YearTotalComponent,
        YearGrafComponent
    ],
    styleUrls: ['./year.component.css']
})
export class YearComponent implements OnInit {
    readonly workbook = inject(WorkbookService);
    private readonly http = inject(HttpClient);

    ngOnInit(): void {
        if (this.workbook.months().length) {
            return;
        }
        const stored = localStorage.getItem('year');
        if (stored) {
            this.workbook.applyCsv(stored);
        }
    }

    protected import(months: Month[]): void {
        this.workbook.setMonths(months);
    }

    protected selectTab(month: Month): void {
        this.workbook.selectMonth(month);
        this.workbook.setView('month');
    }

    protected openView(view: 'start' | 'total' | 'graf'): void {
        this.workbook.setView(view);
    }

    protected openCsv(): void {
        this.workbook.setView('csv' as YearView);
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
