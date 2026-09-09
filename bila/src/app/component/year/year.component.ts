import {Component, inject, OnInit} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {HttpClient} from '@angular/common/http';
import {MonthComponent} from '../month/month.component';
import {Month} from '../../model/Month';
import {MonthRow} from '../../model/MonthRow';
import {CELL_TYPE} from '../../model/CellType';
import {ImportComponent} from '../import/import.component';
import {Button} from 'primeng/button';
import {WorkbookService, YearView} from '../../service/workbook.service';
import {SaldoPanelComponent} from '../saldoPanel/saldo-panel.component';
import {StartTabComponent} from '../startTab/start-tab.component';
import {YearTotalComponent} from '../yearTotal/year-total.component';
import {YearGrafComponent} from '../yearGraf/year-graf.component';
import {NewRowButtonsComponent} from '../newRowButtons/newRowButtons.component';

const MIN_ROWS = 36;

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
        YearGrafComponent,
        NewRowButtonsComponent
    ],
    styleUrls: ['./year.component.css']
})
export class YearComponent implements OnInit {
    readonly workbook = inject(WorkbookService);
    private readonly http = inject(HttpClient);

    ngOnInit(): void {
        this.ensureSaldoColumns();
        if (this.workbook.months().length) {
            this.fillRows();
            return;
        }
        const stored = localStorage.getItem('year');
        if (stored) {
            this.workbook.applyCsv(stored);
            this.fillRows();
            return;
        }
        this.http.get('assets/empty.csv', {responseType: 'text'}).subscribe((csvData) => {
            this.workbook.applyCsv(csvData);
            this.fillRows();
        });
    }

    protected import(months: Month[]): void {
        this.workbook.setMonths(months);
        this.fillRows();
    }

    protected selectTab(month: Month): void {
        this.workbook.selectMonth(month);
        this.workbook.setView('month');
    }

    protected openView(view: YearView): void {
        this.workbook.setView(view);
    }

    protected openCsv(): void {
        this.workbook.setView('csv' as YearView);
    }

    protected isCsv(): boolean {
        return (this.workbook.view() as string) === 'csv';
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

    private ensureSaldoColumns(): void {
        if (!this.workbook.saldoColumnsOpen()) {
            this.workbook.toggleSaldoColumns();
        }
    }

    private fillRows(min = MIN_ROWS): void {
        this.workbook.months().forEach((month) => {
            while (month.rows.length < min) {
                const rowIndex = month.rows.length;
                const row = new MonthRow(rowIndex, month.columns);
                row.cells.forEach((cell) => {
                    if (cell.type.id === CELL_TYPE.none) {
                        cell.raw = month.label.title;
                    }
                    if (cell.type.id === CELL_TYPE.index) {
                        cell.raw = String(rowIndex);
                    }
                });
                month.rows.push(row);
            }
        });
        this.workbook.touch();
    }
}
