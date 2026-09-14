import {SaldoColumnPref, SaldoCombo, WorkbookService} from './workbook.service';

declare module './workbook.service' {
    interface WorkbookService {
        moveSaldoCombo(key: string, delta: number): void;
        moveSaldoComboTo(key: string, targetKey: string): void;
    }
}

export function orderedSaldoCombos(book: WorkbookService): SaldoCombo[] {
    const prefs = book.saldoColumnPrefs();
    return book.saldoCombos()
        .map((combo, index) => ({combo, index, order: prefs[combo.key]?.order ?? index}))
        .sort((left, right) => left.order - right.order || left.index - right.index)
        .map((item) => item.combo);
}

export function installSaldoOrder(workbook: WorkbookService): void {
    const book = workbook as WorkbookService & {__saldoOrder?: boolean};
    if (book.__saldoOrder) {
        return;
    }
    book.__saldoOrder = true;
    const raw = workbook as unknown as {
        persistSettings(): void;
        touch(): void;
        saldoColumnPrefs: WorkbookService['saldoColumnPrefs'];
    };

    const setPref = book.setSaldoColumnPref.bind(book);
    book.setSaldoColumnPref = (key: string, patch: Partial<SaldoColumnPref>) => {
        setPref(key, patch);
        if (patch.order === undefined) {
            return;
        }
        const current = book.saldoColumnPrefs();
        const fallback = current[key] ?? {visible: true, title: key.replace('|', ' ')};
        book.saldoColumnPrefs.set({
            ...current,
            [key]: {
                visible: patch.visible ?? fallback.visible,
                title: patch.title ?? fallback.title,
                order: patch.order
            }
        });
        raw.persistSettings();
        raw.touch();
    };

    const visible = book.visibleSaldoCombos.bind(book);
    book.visibleSaldoCombos = () => {
        const allowed = new Set(visible().map((combo) => combo.key));
        return orderedSaldoCombos(book).filter((combo) => allowed.has(combo.key));
    };

    book.moveSaldoCombo = (key: string, delta: number) => {
        const list = orderedSaldoCombos(book);
        const from = list.findIndex((combo) => combo.key === key);
        reorder(raw, list, from, from + delta);
    };

    book.moveSaldoComboTo = (key: string, targetKey: string) => {
        const list = orderedSaldoCombos(book);
        reorder(
            raw,
            list,
            list.findIndex((combo) => combo.key === key),
            list.findIndex((combo) => combo.key === targetKey)
        );
    };
}

function reorder(book: {
    persistSettings(): void;
    touch(): void;
    saldoColumnPrefs: WorkbookService['saldoColumnPrefs'];
}, list: SaldoCombo[], from: number, to: number): void {
    if (from < 0 || to < 0 || to >= list.length || from === to) {
        return;
    }
    const next = [...list];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    const prefs = {...book.saldoColumnPrefs()};
    next.forEach((combo, index) => {
        const current = prefs[combo.key] ?? {visible: true, title: `${combo.person} ${combo.account}`};
        prefs[combo.key] = {...current, order: index};
    });
    book.saldoColumnPrefs.set(prefs);
    book.persistSettings();
    book.touch();
}
