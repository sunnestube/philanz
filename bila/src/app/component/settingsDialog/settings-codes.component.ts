import {Component, inject, input} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {Button} from 'primeng/button';
import {WorkbookService} from '../../service/workbook.service';

@Component({
    selector: 'bal-settings-codes',
    standalone: true,
    imports: [FormsModule, Button],
    styleUrl: './settings-dialog.component.css',
    template: `
        <p class="hint">{{ hint() }}</p>
        <table class="col-table name-table">
            <thead>
            <tr><th>Code</th><th>Anzeigename</th><th></th></tr>
            </thead>
            <tbody>
                @for (code of codes(); track code) {
                    <tr [class]="'person-' + code.toLowerCase()">
                        <td>
                            <input class="code-input" [ngModel]="code"
                                   (change)="renameCode(code, $any($event.target).value)"
                                   maxlength="2" [attr.aria-label]="kind() + '-Code'"/>
                        </td>
                        <td>
                            <input [ngModel]="workbook.optionLabel(kind(), code)"
                                   (change)="renameName(code, $any($event.target).value)"
                                   [placeholder]="namePlaceholder()"/>
                        </td>
                        <td><button type="button" class="danger" (click)="remove(code)">Entfernen</button></td>
                    </tr>
                }
            </tbody>
        </table>
        <div class="add-row">
            <input class="code-input" [(ngModel)]="newCode" maxlength="2" placeholder="Code" (keydown.enter)="add()"/>
            <input [(ngModel)]="newName" placeholder="Anzeigename" (keydown.enter)="add()"/>
            <p-button label="Hinzufügen" size="small" (onClick)="add()"/>
        </div>
    `
})
export class SettingsCodesComponent {
    readonly workbook = inject(WorkbookService);
    readonly kind = input<'person' | 'account'>('person');
    readonly hint = input('');
    readonly namePlaceholder = input('Name');
    newCode = '';
    newName = '';

    codes(): string[] {
        return this.kind() === 'person' ? this.workbook.personCodes() : this.workbook.accountCodes();
    }

    add(): void {
        const code = this.newCode.trim().toUpperCase();
        if (!code) {
            return;
        }
        if (this.kind() === 'person') {
            this.workbook.setOptions({person: [...this.workbook.persons(), code], account: this.workbook.accounts()});
        } else {
            this.workbook.setOptions({person: this.workbook.persons(), account: [...this.workbook.accounts(), code]});
        }
        if (this.newName.trim()) {
            this.workbook.setCodeName(this.kind(), code, this.newName);
        }
        this.newCode = '';
        this.newName = '';
    }

    remove(code: string): void {
        if (this.kind() === 'person') {
            this.workbook.setOptions({
                person: this.workbook.persons().filter((item) => item !== code),
                account: this.workbook.accounts()
            });
            return;
        }
        this.workbook.setOptions({
            person: this.workbook.persons(),
            account: this.workbook.accounts().filter((item) => item !== code)
        });
    }

    renameCode(from: string, to: string): void {
        this.workbook.renameCode(this.kind(), from, to);
    }

    renameName(code: string, name: string): void {
        this.workbook.setCodeName(this.kind(), code, name);
    }
}
