import {Component, inject} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {CELL_TYPE} from '../../model/CellType';
import {SECTION} from '../../model/Section';
import {CONSTANT_MONTHS, ConstantDef, WorkbookService} from '../../service/workbook.service';

type ConstantKind = 'transfer' | 'column';
type RichConstant = ConstantDef & {kind?: ConstantKind; columnTitle?: string};

@Component({
    selector: 'bal-constants-tab',
    standalone: true,
    imports: [FormsModule],
    templateUrl: './constants-tab.component.html',
    styleUrl: './constants-tab.component.css'
})
export class ConstantsTabComponent {
    readonly workbook = inject(WorkbookService);
    readonly months = CONSTANT_MONTHS;

    transfers(): RichConstant[] {
        this.workbook.revision();
        return this.all().filter((item) => (item.kind || 'transfer') !== 'column');
    }

    columns(): RichConstant[] {
        this.workbook.revision();
        return this.all().filter((item) => item.kind === 'column' || item.person === '§COL');
    }

    addTransfer(): void {
        this.workbook.addConstant('');
        this.patchLast({kind: 'transfer', months: ['0', ...Array.from({length: 11}, () => '↑')]});
    }

    numberColumns(): Array<{title: string; kind: string}> {
        const month = this.workbook.months()[0];
        if (!month) {
            return [];
        }
        return month.columns
            .filter((column) => column.type === CELL_TYPE.number && column.section !== SECTION.SALDO)
            .map((column) => ({
                title: column.title,
                kind: column.section === SECTION.EINGANG ? 'Einnahme' : 'Ausgabe'
            }))
            .filter((item) => !!item.title);
    }

    addColumn(): void {
        this.workbook.addConstant('');
        this.patchLast({kind: 'column', person: '§COL', columnTitle: '', months: ['0', ...Array.from({length: 11}, () => '↑')]});
    }

    setColumn(item: RichConstant, title: string): void {
        this.patch(item.id, {columnTitle: title});
    }

    onName(item: ConstantDef, event: Event): void {
        this.workbook.setConstantName(item.id, (event.target as HTMLInputElement).value);
    }

    onMonth(item: ConstantDef, index: number, event: Event): void {
        this.workbook.setConstantMonth(item.id, index, (event.target as HTMLInputElement).value);
    }

    isPrevRef(raw: string | null | undefined): boolean {
        const text = (raw ?? '').trim();
        return text === '↑' || text === '=↑' || text.toLowerCase() === '=vorzeile';
    }

    nudge(id: string, delta: number, kind: ConstantKind): void {
        const list = kind === 'column' ? this.columns() : this.transfers();
        const from = list.findIndex((item) => item.id === id);
        if (from < 0) {
            return;
        }
        this.moveInKind(id, from + delta, kind);
    }

    onDragStart(event: DragEvent, id: string): void {
        event.dataTransfer?.setData('text/plain', id);
        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move';
        }
    }

    onDragOver(event: DragEvent): void {
        event.preventDefault();
    }

    onDrop(event: DragEvent, targetId: string, kind: ConstantKind): void {
        event.preventDefault();
        const id = event.dataTransfer?.getData('text/plain');
        if (!id) {
            return;
        }
        const list = kind === 'column' ? this.columns() : this.transfers();
        const toIndex = list.findIndex((item) => item.id === targetId);
        this.moveInKind(id, toIndex, kind);
    }

    preview(item: ConstantDef, monthTitle: string): string {
        const index = CONSTANT_MONTHS.indexOf(monthTitle as typeof CONSTANT_MONTHS[number]);
        const raw = item.months[index] ?? '';
        if (this.isPrevRef(raw) || this.workbook.isFormula(raw)) {
            return this.format(this.workbook.constantAmount(item, monthTitle));
        }
        return raw;
    }

    format(value: number): string {
        if (!value) {
            return '';
        }
        return value.toLocaleString('de-CH', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    }

    private all(): RichConstant[] {
        return this.workbook.constants() as RichConstant[];
    }

    private patchLast(patch: Partial<RichConstant>): void {
        const list = this.all();
        const last = list[list.length - 1];
        if (!last) {
            return;
        }
        this.patch(last.id, patch);
    }

    private patch(id: string, patch: Partial<RichConstant>): void {
        const list = this.all().map((item) => item.id === id ? {...item, ...patch} : item);
        this.workbook.constants.set(list);
        const item = list.find((entry) => entry.id === id);
        if (item) {
            this.workbook.setConstantName(item.id, item.name);
        }
    }

    private moveInKind(id: string, toIndex: number, kind: ConstantKind): void {
        const all = this.all();
        const group = kind === 'column' ? this.columns() : this.transfers();
        const from = group.findIndex((item) => item.id === id);
        if (from < 0 || toIndex < 0 || toIndex >= group.length || from === toIndex) {
            return;
        }
        const nextGroup = [...group];
        const [item] = nextGroup.splice(from, 1);
        nextGroup.splice(toIndex, 0, item);
        const other = all.filter((entry) => !group.some((member) => member.id === entry.id));
        this.workbook.constants.set(kind === 'column' ? [...other, ...nextGroup] : [...nextGroup, ...other]);
        this.workbook.setConstantName(item.id, item.name);
    }
}
