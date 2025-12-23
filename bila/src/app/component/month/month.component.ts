import {Component, Input} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {Month} from '../../model/Month';
import {MonthTable} from '../monthTable/monthTable';

@Component({
    selector: 'bal-month',
    templateUrl: './month.component.html',
    imports: [
        FormsModule,
        MonthTable
    ],
    styleUrls: ['./month.component.css']
})
export class MonthComponent {

    private _month: Month | undefined;

    @Input()
    set month(value: Month) {
        this._month = value;
    }

    get month(): Month | undefined {
        return this._month;
    }

}
