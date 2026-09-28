import {CELL_TYPE} from '../../model/CellType';
import {SECTION} from '../../model/Section';
import {ExpenseColumn, WorkbookService} from '../../service/workbook.service';
import {columnFillAmount} from '../../service/column-fill';
import {parseLocaleNumber} from '../../service/formula.service';

export function buildYearTotalReport(workbook: WorkbookService) {
    const base = workbook.yearExpenseReport();
    // Guarantee every column has a stable key for template trackBy / byColumn lookups.
    const baseColumns = (base.columns || []).map((col) => normalizeColumn(col, 'Ausgabe'));
    const extra = incomeColumns(workbook);
    if (!extra.length) {
        if (baseColumns.every((col, i) => col.key === base.columns[i]?.key)) {
            return base;
        }
        return remapReportKeys(base, baseColumns);
    }
    const months = workbook.months();
    const columns = [...baseColumns, ...extra];
    const monthBlocks = base.months.map((block, index) => {
        const month = months[index];
        const byColumn: Record<string, number> = {};
        const byPerson: Record<string, Record<string, number>> = {};
        const personTotal = {...block.personTotal};
        baseColumns.forEach((col) => {
            // Prefer key; fall back to legacy title-keyed blocks from older snapshots.
            byColumn[col.key] = block.byColumn[col.key] ?? block.byColumn[col.title] ?? 0;
        });
        base.persons.forEach((person) => {
            byPerson[person] = {};
            baseColumns.forEach((col) => {
                byPerson[person][col.key] = block.byPerson[person]?.[col.key]
                    ?? block.byPerson[person]?.[col.title]
                    ?? 0;
            });
        });
        extra.forEach((col) => {
            byColumn[col.key] = 0;
            base.persons.forEach((person) => {
                byPerson[person] = {...byPerson[person], [col.key]: 0};
            });
        });
        if (!month) {
            const total = Object.values(byColumn).reduce((sum, value) => sum + value, 0);
            return {...block, byColumn, byPerson, personTotal, total};
        }
        const personIdx = month.columns.findIndex((column) => column.type === CELL_TYPE.select_person);
        month.rows.forEach((row) => {
            const person = (row.cells[personIdx]?.raw ?? '').trim().toUpperCase();
            const day = workbook.fx.dayIndexForRow(month, row);
            extra.forEach((col) => {
                const filled = columnFillAmount(workbook, month, row, col.index);
                const raw = row.cells[col.index]?.display || row.cells[col.index]?.raw || '0';
                const parsed = parseLocaleNumber(String(raw));
                const valueChf = filled ?? (parsed ?? 0);
                const value = workbook.fx.toDisplay(valueChf, day);
                byColumn[col.key] += value;
                if (byPerson[person]) {
                    byPerson[person][col.key] += value;
                    personTotal[person] += value;
                }
            });
        });
        const total = Object.values(byColumn).reduce((sum, value) => sum + value, 0);
        return {...block, byColumn, byPerson, personTotal, total};
    });
    const yearByColumn: Record<string, number> = {};
    columns.forEach((col) => {
        yearByColumn[col.key] = monthBlocks.reduce((sum, block) => sum + (block.byColumn[col.key] ?? 0), 0);
    });
    const yearExpense = base.yearExpense;
    const yearIncome = base.yearIncome;
    const divisor = Math.max(monthBlocks.length, 1);
    const monthAvgMap: Record<string, number> = {};
    const dayAvgMap: Record<string, number> = {};
    columns.forEach((col) => {
        monthAvgMap[col.key] = (yearByColumn[col.key] ?? 0) / divisor;
        dayAvgMap[col.key] = (yearByColumn[col.key] ?? 0) / 365;
    });
    const combined = yearExpense + yearIncome;
    return {
        ...base,
        columns,
        months: monthBlocks,
        yearExpense,
        yearIncome,
        monthAvg: combined / divisor,
        dayAvg: combined / 365,
        summaryRows: [
            {label: 'Jahr', byColumn: yearByColumn, total: combined},
            {label: 'Ø Monat', byColumn: monthAvgMap, total: combined / divisor},
            {label: 'Ø Tag', byColumn: dayAvgMap, total: combined / 365}
        ]
    };
}

function normalizeColumn(col: ExpenseColumn, fallbackKind: 'Einnahme' | 'Ausgabe'): ExpenseColumn {
    if (col.key) {
        return col.kind ? col : {...col, kind: fallbackKind};
    }
    const section = col.section || (fallbackKind === 'Einnahme' ? String(SECTION.EINGANG) : String(SECTION.AUSGANG));
    return {
        ...col,
        key: `${section}::${col.index}::${col.title}`,
        section,
        kind: col.kind || fallbackKind
    };
}

function remapReportKeys(base: ReturnType<WorkbookService['yearExpenseReport']>, columns: ExpenseColumn[]) {
    const months = base.months.map((block) => {
        const byColumn: Record<string, number> = {};
        const byPerson: Record<string, Record<string, number>> = {};
        columns.forEach((col) => {
            byColumn[col.key] = block.byColumn[col.key] ?? block.byColumn[col.title] ?? 0;
        });
        Object.keys(block.byPerson || {}).forEach((person) => {
            byPerson[person] = {};
            columns.forEach((col) => {
                byPerson[person][col.key] = block.byPerson[person]?.[col.key]
                    ?? block.byPerson[person]?.[col.title]
                    ?? 0;
            });
        });
        return {...block, byColumn, byPerson};
    });
    const yearByColumn: Record<string, number> = {};
    const monthAvgMap: Record<string, number> = {};
    const dayAvgMap: Record<string, number> = {};
    const divisor = Math.max(months.length, 1);
    columns.forEach((col) => {
        yearByColumn[col.key] = months.reduce((sum, block) => sum + (block.byColumn[col.key] ?? 0), 0);
        monthAvgMap[col.key] = (yearByColumn[col.key] ?? 0) / divisor;
        dayAvgMap[col.key] = (yearByColumn[col.key] ?? 0) / 365;
    });
    return {
        ...base,
        columns,
        months,
        summaryRows: [
            {label: 'Jahr', byColumn: yearByColumn, total: base.yearExpense},
            {label: 'Ø Monat', byColumn: monthAvgMap, total: base.yearExpense / divisor},
            {label: 'Ø Tag', byColumn: dayAvgMap, total: base.yearExpense / 365}
        ]
    };
}

function incomeColumns(workbook: WorkbookService): ExpenseColumn[] {
    const month = workbook.months()[0];
    if (!month) {
        return [];
    }
    return month.columns
        .map((column, index) => ({column, index}))
        .filter(({column}) => column.type === CELL_TYPE.number && column.section === SECTION.EINGANG)
        .map(({column, index}) => ({
            title: column.title,
            index,
            key: `${column.section}::${index}::${column.title}`,
            section: String(column.section),
            kind: 'Einnahme' as const
        }));
}
