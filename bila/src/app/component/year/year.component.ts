import {Component, inject, OnInit} from '@angular/core';
import {DatePipe} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {HttpClient} from '@angular/common/http';
import {ActivatedRoute, Router} from '@angular/router';
import {MonthComponent} from '../month/month.component';
import {Month} from '../../model/Month';
import {MonthRow} from '../../model/MonthRow';
import {CELL_TYPE} from '../../model/CellType';
import {ImportComponent} from '../import/import.component';
import {WorkbookService, YearView} from '../../service/workbook.service';
import {YearArchiveService, YearMeta} from '../../service/year-archive.service';
import '../../service/workbook-years.patch';
import {SaldoPanelComponent} from '../saldoPanel/saldo-panel.component';
import {StartTabComponent} from '../startTab/start-tab.component';
import {ConstantsTabComponent} from '../constantsTab/constants-tab.component';
import {YearTotalComponent} from '../yearTotal/year-total.component';
import {YearGrafComponent} from '../yearGraf/year-graf.component';
import {NewRowButtonsComponent} from '../newRowButtons/newRowButtons.component';

const MIN_ROWS = 36;

@Component({
    templateUrl: './year.component.html',
    imports: [
        FormsModule,
        DatePipe,
        MonthComponent,
        ImportComponent,
        SaldoPanelComponent,
        StartTabComponent,
        ConstantsTabComponent,
        YearTotalComponent,
        YearGrafComponent,
        NewRowButtonsComponent
    ],
    styleUrls: ['./year.component.css']
})
export class YearComponent implements OnInit {
    readonly workbook = inject(WorkbookService);
    readonly archive = inject(YearArchiveService);
    private readonly http = inject(HttpClient);
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    saveMessage = '';
    yearName = '';

    ngOnInit(): void {
        this.ensureSaldoColumns();
        this.yearName = this.archive.suggestedName();
        this.route.paramMap.subscribe((params) => {
            const id = params.get('id');
            if (id) {
                this.yearName = this.archive.normalize(id);
                const csv = this.archive.open(this.yearName);
                if (csv) {
                    this.workbook.applyCsv(csv);
                    this.fillRows();
                    return;
                }
                this.loadTemplate();
                return;
            }
            if (this.workbook.months().length) {
                this.fillRows();
                return;
            }
            const active = this.archive.activeId();
            const stored = (active && this.archive.csvOf(active)) || localStorage.getItem('year');
            if (stored) {
                if (active) {
                    this.yearName = active;
                }
                this.workbook.applyCsv(stored);
                this.fillRows();
                return;
            }
            this.loadTemplate();
        });
    }

    years(): YearMeta[] {
        return this.archive.years();
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
        this.workbook.setView('csv');
    }

    protected isCsv(): boolean {
        return this.workbook.view() === 'csv';
    }

    protected save(): void {
        const csvData = this.workbook.toCsv();
        if (!csvData) {
            this.saveMessage = 'Nichts zu speichern.';
            return;
        }
        const meta = this.archive.save(this.yearName, csvData);
        this.yearName = meta.name;
        const now = new Date();
        this.saveMessage = `${meta.name} gespeichert um ${now.toLocaleTimeString('de-CH', {hour: '2-digit', minute: '2-digit'})}.`;
        void this.router.navigate(['/year', meta.name], {replaceUrl: true});
    }

    protected exportToCSV(): void {
        const csvData = this.workbook.toCsv();
        if (!csvData) {
            return;
        }
        const name = this.archive.normalize(this.yearName);
        const blob = new Blob([csvData], {type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${name}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    protected openYear(id: string): void {
        const csv = this.archive.open(id);
        this.yearName = id;
        if (csv) {
            this.workbook.applyCsv(csv);
            this.fillRows();
        }
        void this.router.navigate(['/year', id]);
    }

    protected deleteYear(id: string): void {
        if (!confirm(`Jahr ${id} löschen?`)) {
            return;
        }
        this.archive.remove(id);
        if (this.yearName === id) {
            const next = this.archive.activeId();
            if (next) {
                this.openYear(next);
            }
        }
    }

    private loadTemplate(): void {
        this.http.get('assets/empty.csv', {responseType: 'text'}).subscribe((csvData) => {
            this.workbook.applyCsv(csvData);
            this.fillRows();
        });
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
