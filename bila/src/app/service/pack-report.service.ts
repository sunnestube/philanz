import {Injectable, inject} from '@angular/core';
import {WorkbookService, YearView} from './workbook.service';
import {YearArchiveService} from './year-archive.service';
import {buildYearTotalReport} from '../component/yearTotal/year-total.report';

export interface PackYearSlice {
    id: string;
    title: string;
    report: ReturnType<typeof buildYearTotalReport>;
    charts: ReturnType<WorkbookService['yearCharts']>;
    trend: ReturnType<WorkbookService['currencyTrendCharts']>;
}

@Injectable({providedIn: 'root'})
export class PackReportService {
    private readonly workbook = inject(WorkbookService);
    private readonly archive = inject(YearArchiveService);

    collect(): PackYearSlice[] {
        const active = this.archive.activeId();
        const live = this.workbook.toCsv();
        if (active && live) {
            this.archive.save(active, live);
        }
        const view = this.workbook.view();
        const monthTitle = this.workbook.selectedMonth()?.label.title;
        const slices: PackYearSlice[] = [];
        this.archive.years().forEach((item) => {
            const csv = this.archive.csvOf(item.id);
            if (!csv?.trim()) {
                return;
            }
            this.workbook.applyCsv(csv);
            slices.push({
                id: item.id,
                title: item.name,
                report: buildYearTotalReport(this.workbook),
                charts: this.workbook.yearCharts(),
                trend: this.workbook.currencyTrendCharts()
            });
        });
        slices.sort((a, b) => a.id.localeCompare(b.id, 'de'));
        const restore = (active && this.archive.csvOf(active)) || live;
        if (restore) {
            this.workbook.applyCsv(restore);
            this.restoreView(view, monthTitle);
        }
        return slices;
    }

    private restoreView(view: YearView, monthTitle?: string): void {
        if (monthTitle) {
            const month = this.workbook.months().find((item) => item.label.title === monthTitle);
            if (month) {
                this.workbook.selectMonth(month);
            }
        }
        if (view && view !== 'csv') {
            this.workbook.setView(view);
        }
    }
}
