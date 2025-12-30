import { Component, Input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ToolbarModule } from 'primeng/toolbar';
import { ButtonModule } from 'primeng/button';
import { Options } from '../optionsEditor/options-editor.component';  // nur Typ-Import

@Component({
    selector: 'bal-toolbar',
    standalone: true,
    imports: [
        RouterLink,
        RouterLinkActive,
        ToolbarModule,
        ButtonModule
    ],
    templateUrl: './toolbar.component.html',
    styleUrl: './toolbar.component.css'
})
export class ToolbarComponent {
    @Input() title: string = 'Bilanz';

    myOptions: Options = {
        person: ['', 'P', 'L', 'H', 'E', 'A'],
        account: ['', 'B', 'K', 'S', 'R', 'Y', 'T'],
        default: ['']
    };

    openSettings() {
        console.log('Einstellungen-Button geklickt');
        console.log('Aktuelle Optionen:', this.myOptions);

        // Hier kannst du später einfügen, was passieren soll, z. B.:
        // - Dialog öffnen
        // - Zur Einstellungs-Route navigieren
        // - Einen Service aufrufen
        // - Einen Event emitten

        // Beispiel-Idee für später:
        // this.router.navigate(['/einstellungen']);
        // oder
        // this.dialogService.open(OptionsEditorComponent, { ... });
    }
}
