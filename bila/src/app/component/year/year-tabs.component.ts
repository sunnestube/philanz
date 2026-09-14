import {Component, input, output} from '@angular/core';
import {Month} from '../../model/Month';
import {YearView} from '../../service/workbook.service';
import {NewRowButtonsComponent} from '../newRowButtons/newRowButtons.component';

@Component({
    selector: 'bal-year-tabs',
    standalone: true,
    imports: [NewRowButtonsComponent],
    styleUrls: ['./year.component.css'],
    template: `
        <div class="tabs">
            <div class="tab-label start-tab" [class.active]="view() === 'start'" (click)="openView.emit('start')">Start</div>
            <div class="tab-label constants-tab" [class.active]="view() === 'constants'" (click)="openView.emit('constants')">Konstanten</div>
            @for (month of months(); track month.label.title) {
                <div class="tab-label"
                     [class]="month.label.background"
                     [class.active]="view() === 'month' && selected() === month"
                     (click)="selectMonth.emit(month)">
                    {{ month.label.title }}
                </div>
            }
            <div class="tab-label total-tab" [class.active]="view() === 'total'" (click)="openView.emit('total')">Total</div>
            <div class="tab-label graf-tab" [class.active]="view() === 'graf'" (click)="openView.emit('graf')">Graf</div>
            <div class="tab-label csv-tab-label" [class.active]="view() === 'csv'" (click)="openView.emit('csv')">CSV</div>
            <div class="tab-row-actions">
                <bal-new-row-buttons [month]="selected() ?? undefined"/>
            </div>
        </div>
    `
})
export class YearTabsComponent {
    readonly view = input<YearView>('start');
    readonly months = input<Month[]>([]);
    readonly selected = input<Month | null>(null);
    readonly openView = output<YearView>();
    readonly selectMonth = output<Month>();
}
