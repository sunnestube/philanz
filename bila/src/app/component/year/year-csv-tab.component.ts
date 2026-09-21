import {Component, input, output} from '@angular/core';
import {DatePipe} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {Month} from '../../model/Month';
import {YearMeta} from '../../service/year-archive.service';
import {ImportComponent} from '../import/import.component';

@Component({
    selector: 'bal-year-csv-tab',
    standalone: true,
    imports: [FormsModule, DatePipe, ImportComponent],
    styleUrls: ['./year.component.css'],
    templateUrl: './year-csv-tab.component.html'
})
export class YearCsvTabComponent {
    readonly yearName = input('');
    readonly saveMessage = input('');
    readonly years = input<YearMeta[]>([]);
    readonly yearNameChange = output<string>();
    readonly save = output();
    readonly exportCsv = output();
    readonly exportPack = output();
    readonly savePack = output();
    readonly openYear = output<string>();
    readonly deleteYear = output<string>();
    readonly imported = output<Month[]>();
}
