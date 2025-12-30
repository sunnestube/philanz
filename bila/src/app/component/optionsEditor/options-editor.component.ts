import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, Validators, FormsModule } from '@angular/forms';

import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { Chip } from 'primeng/chip';
import { InputTextModule } from 'primeng/inputtext';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';

export interface Options {
    person: string[];
    account: string[];
    default: string[];
}

@Component({
    selector: 'bal-options-editor',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        FormsModule,
        ButtonModule,
        CardModule,
        Chip,
        InputTextModule,
        Tabs,
        TabList,
        Tab,
        TabPanels,
        TabPanel
    ],
    templateUrl: './options-editor.component.html',
    styleUrls: ['./options-editor.component.scss']
})
export class OptionsEditorComponent implements OnChanges {
    @Input() options: Options = { person: [], account: [], default: [] };
    @Output() optionsChange = new EventEmitter<Options>();
    @Output() optionsSaved = new EventEmitter<Options>();

    editedOptions: Options = { person: [], account: [], default: [] };
    originalOptions: Options = { person: [], account: [], default: [] };

    // Wir geben explizit string | null an – das ist korrekt für FormControl ohne initial value
    newCodeControl = new FormControl<string | null>('',
        [Validators.required, Validators.minLength(1), Validators.maxLength(1)]
    );

    readonly defaultOptions: Options = {
        person:  ['', 'P', 'L', 'H', 'E', 'A'],
        account: ['', 'B', 'K', 'S', 'R', 'Y', 'T'],
        default: ['d']
    };

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['options']?.currentValue) {
            this.editedOptions = structuredClone(this.options);
            this.originalOptions = structuredClone(this.options);
            this.newCodeControl.reset(); // sicherheitshalber
        }
    }

    addCode(category: keyof Options): void {
        const rawValue = this.newCodeControl.value;
        if (!rawValue) return;

        const code = rawValue.trim().toUpperCase();
        if (code.length !== 1) return;

        if (!this.editedOptions[category].includes(code)) {
            this.editedOptions[category] = [...this.editedOptions[category], code];
            this.emitChanges();
        }

        this.newCodeControl.reset();
    }

    removeCode(category: keyof Options, code: string): void {
        this.editedOptions[category] = this.editedOptions[category].filter(c => c !== code);
        this.emitChanges();
    }

    resetToDefault(): void {
        this.editedOptions = structuredClone(this.defaultOptions);
        this.emitChanges();
    }

    resetToOriginal(): void {
        this.editedOptions = structuredClone(this.originalOptions);
        this.emitChanges();
    }

    save(): void {
        this.optionsSaved.emit(structuredClone(this.editedOptions));
    }

    private emitChanges(): void {
        this.optionsChange.emit(structuredClone(this.editedOptions));
    }
}
