import {Component, inject, input, output} from '@angular/core';
import {Month} from '../../model/Month';
import {WorkbookService, YearView} from '../../service/workbook.service';
import {NewRowButtonsComponent} from '../newRowButtons/newRowButtons.component';
import {APP_VERSION} from '../../version';

@Component({
    selector: 'bal-year-tabs',
    standalone: true,
    imports: [NewRowButtonsComponent],
    styleUrls: ['./year.component.css'],
    templateUrl: './year-tabs.component.html'
})
export class YearTabsComponent {
    readonly view = input<YearView>('start');
    readonly months = input<Month[]>([]);
    readonly selected = input<Month | null>(null);
    readonly openView = output<YearView>();
    readonly selectMonth = output<Month>();
    readonly version = APP_VERSION;
    readonly workbook = inject(WorkbookService);

    isMonthClosed(month: Month): boolean {
        return this.workbook.isMonthClosed(month.label.title);
    }

    isYearClosed(): boolean {
        return this.workbook.isYearClosed();
    }

    toggleSelectedMonth(): void {
        const month = this.selected();
        if (!month) {
            return;
        }
        this.workbook.toggleMonthClosed(month.label.title);
    }

    toggleYear(): void {
        this.workbook.toggleYearClosed();
    }

    monthCloseLabel(): string {
        const month = this.selected();
        if (!month) {
            return 'Monat abschließen';
        }
        return this.isMonthClosed(month) ? 'Monat öffnen' : 'Monat abschließen';
    }

    yearCloseLabel(): string {
        return this.isYearClosed() ? 'Jahr öffnen' : 'Jahr abschließen';
    }
}
