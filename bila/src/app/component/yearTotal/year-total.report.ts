import {CELL_TYPE} from '../../model/CellType';
import {SECTION} from '../../model/Section';
import {ExpenseColumn, WorkbookService} from '../../service/workbook.service';
import {columnFillAmount} from '../../service/column-fill';

export function buildYearTotalReport(workbook: WorkbookService) {
    const base = workbook.yearExpenseReport();
    const extra = incomeColumns(workbook);
    if (!extra.length) {
        return base;
    }
    const months = workbook.months();
    const columns = [...base.columns, ...extra];
    const monthBlocks = base.months.map((block, index) => {
        const month = months[index];
        const byColumn = {...block.byColumn};
        const byPerson = {...block.byPerson};
        const personTotal = {...block.personTotal};
        extra.forEach((col) => {
            byColumn[col.title] = 0;
            base.persons.forEach((person) => {
                byPerson[person] = {...byPerson[person], [col.title]: 0};
            });
        });
        if (!month) {
            return {...block, byColumn, byPerson, personTotal};
        }
        const personIdx = month.columns.findIndex((column) => column.type === CELL_TYPE.select_person);
        month.rows.forEach((row) => {
            const person = (row.cells[personIdx]?.raw ?? '').trim().toUpperCase();
            extra.forEach((col) => {
                const filled = columnFillAmount(workbook, month, row, col.index);
                const raw = row.cells[col.index]?.display || row.cells[col.index]?.raw || '0';
                const parsed = Number(String(raw).replace(/['\s]/g, '').replace(',', '.'));
                const value = filled ?? (Number.isFinite(parsed) ? parsed : 0);
                byColumn[col.title] += value;
                if (byPerson[person]) {
                    byPerson[person][col.title] += value;
                    personTotal[person] += value;
                }
            });
        });
        const total = Object.values(byColumn).reduce((sum, value) => sum + value, 0);
        return {...block, byColumn, byPerson, personTotal, total};
    });
    const yearByColumn: Record<string, number> = {};
    columns.forEach((col) => {
        yearByColumn[col.title] = monthBlocks.reduce((sum, block) => sum + (block.byColumn[col.title] ?? 0), 0);
    });
    const yearExpense = base.yearExpense;
    const yearIncome = base.yearIncome;
    const divisor = Math.max(monthBlocks.length, 1);
    const monthAvgMap: Record<string, number> = {};
    const dayAvgMap: Record<string, number> = {};
    columns.forEach((col) => {
        monthAvgMap[col.title] = (yearByColumn[col.title] ?? 0) / divisor;
        dayAvgMap[col.title] = (yearByColumn[col.title] ?? 0) / 365;
    });
    return {
        ...base,
        columns,
        months: monthBlocks,
        yearExpense,
        yearIncome,
        summaryRows: [
            {label: 'Jahr', byColumn: yearByColumn, total: yearExpense + yearIncome},
            {label: 'Ø Monat', byColumn: monthAvgMap, total: (yearExpense + yearIncome) / divisor},
            {label: 'Ø Tag', byColumn: dayAvgMap, total: (yearExpense + yearIncome) / 365}
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
        .map(({column, index}) => ({title: column.title, index}));
}
