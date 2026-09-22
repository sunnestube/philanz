import {Component, inject} from '@angular/core';
import {DatePipe} from '@angular/common';
import {Router} from '@angular/router';
import {WorkbookService} from '../../service/workbook.service';
import {YearArchiveService} from '../../service/year-archive.service';
import {ImportComponent} from '../import/import.component';
import {Month} from '../../model/Month';

@Component({
    selector: 'bal-year-set',
    standalone: true,
    imports: [DatePipe, ImportComponent],
    templateUrl: './year-set.component.html',
    styleUrls: ['../year/year.component.css'],
    styles: [':host { display: block; padding: 16px; overflow: auto; }']
})
export class YearSetComponent {
    private readonly workbook = inject(WorkbookService);
    readonly archive = inject(YearArchiveService);
    private readonly router = inject(Router);
    saveMessage = '';

    savePack(): void {
        const csv = this.workbook.toCsv();
        const active = this.archive.activeId();
        if (csv && active) {
            this.archive.save(active, csv);
        } else {
            this.archive.rewritePack();
        }
        this.saveMessage = `Set mit ${this.archive.years().length} Jahr(en) im Browser gespeichert.`;
    }

    exportPack(): void {
        this.savePack();
        const pack = this.archive.exportPack();
        if (!pack) {
            this.saveMessage = 'Kein Set zum Exportieren.';
            return;
        }
        const blob = new Blob([pack], {type: 'text/csv;charset=utf-8;'});
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.download = 'jahre.csv';
        link.click();
        URL.revokeObjectURL(url);
    }

    imported(months: Month[]): void {
        this.workbook.setMonths(months);
        const id = this.archive.activeId();
        if (id) {
            void this.router.navigate(['/year', id]);
        }
    }

    openYear(id: string): void {
        void this.router.navigate(['/year', id]);
    }

    deleteYear(id: string): void {
        if (!confirm(`Jahr ${id} aus dem Set löschen?`)) {
            return;
        }
        this.archive.remove(id);
        this.saveMessage = `${id} gelöscht.`;
    }
}
