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
    template: `
        <div class="tab-content extra active csv-tab">
            <h2>CSV</h2>
            <p>Import und Export. Das Jahr wählst du oben im Menü. Formeln bleiben roh (=A1).</p>
            <div class="csv-cards">
                <article class="csv-card">
                    <h3>Als Jahr speichern</h3>
                    <p>Name wie 2026. Liegt danach in der Jahresübersicht und im Browser.</p>
                    <label class="year-label">Jahr
                        <input class="year-input" type="text" [ngModel]="yearName()" (ngModelChange)="yearNameChange.emit($event)" placeholder="2026"/>
                    </label>
                    <button type="button" class="csv-btn" (click)="save.emit()">Speichern</button>
                    @if (saveMessage()) {
                        <span class="csv-status">{{ saveMessage() }}</span>
                    }
                </article>
                <article class="csv-card">
                    <h3>CSV-Datei exportieren</h3>
                    <p>Download als <code>{{ yearName() || '2026' }}.csv</code>.</p>
                    <button type="button" class="csv-btn secondary" (click)="exportCsv.emit()">CSV exportieren</button>
                </article>
            </div>
            @if (years().length) {
                <article class="csv-card import-card">
                    <h3>Gespeicherte Jahre</h3>
                    <ul class="year-list">
                        @for (item of years(); track item.id) {
                            <li>
                                <button type="button" class="linkish" (click)="openYear.emit(item.id)">{{ item.name }}</button>
                                <span class="year-date">{{ item.updated | date:'dd.MM.yyyy HH:mm' }}</span>
                                <button type="button" class="const-remove" (click)="deleteYear.emit(item.id)">löschen</button>
                            </li>
                        }
                    </ul>
                </article>
            }
            <article class="csv-card import-card">
                <h3>CSV importieren</h3>
                <p>Datei ziehen oder Beispiel laden. Danach unter einem Jahresnamen speichern.</p>
                <bal-import (dataLoaded)="imported.emit($event)"></bal-import>
            </article>
        </div>
    `
})
export class YearCsvTabComponent {
    readonly yearName = input('');
    readonly saveMessage = input('');
    readonly years = input<YearMeta[]>([]);
    readonly yearNameChange = output<string>();
    readonly save = output();
    readonly exportCsv = output();
    readonly openYear = output<string>();
    readonly deleteYear = output<string>();
    readonly imported = output<Month[]>();
}
