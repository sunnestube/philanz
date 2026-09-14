import {Component, input, output} from '@angular/core';
import {Month} from '../../model/Month';
import {YearView} from '../../service/workbook.service';
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
}
