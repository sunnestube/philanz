export interface YearPackPart {
    id: string;
    csv: string;
}

export function isYearPack(text: string): boolean {
    const lines = String(text ?? '').replace(/^\uFEFF/, '').split(/\r?\n/);
    const years = lines.filter((line) => line.startsWith('#year:')).length;
    return years > 1 || lines.some((line) => line.startsWith('#pack'));
}

export function splitYearPack(text: string): YearPackPart[] {
    const raw = String(text ?? '').replace(/^\uFEFF/, '');
    const lines = raw.split(/\r?\n/);
    const yearMarks = lines.filter((line) => line.startsWith('#year:'));
    if (!yearMarks.length) {
        return [{id: '', csv: raw}];
    }
    const parts: YearPackPart[] = [];
    let currentId = '';
    let buf: string[] = [];
    const flush = () => {
        const csv = buf.join('\n').replace(/^\n+/, '').replace(/\n+$/, '');
        if (currentId && csv.trim()) {
            parts.push({id: currentId, csv: csv.endsWith('\n') ? csv : `${csv}\n`});
        }
        buf = [];
    };
    for (const line of lines) {
        if (line.startsWith('#pack')) {
            continue;
        }
        if (line.startsWith('#year:')) {
            flush();
            currentId = normalizeYearId(line.slice(6));
            continue;
        }
        buf.push(line);
    }
    flush();
    return parts.length ? parts : [{id: '', csv: raw}];
}

export function joinYearPack(parts: YearPackPart[]): string {
    const blocks = parts
        .filter((part) => part.id && part.csv.trim())
        .sort((a, b) => b.id.localeCompare(a.id, 'de'));
    if (!blocks.length) {
        return '';
    }
    const body = blocks.map((part) => {
        const csv = stripPackHeaders(part.csv).replace(/^\uFEFF/, '').replace(/\n+$/, '');
        return `#year:${part.id}\n${csv}`;
    }).join('\n');
    return `\uFEFF#pack\n${body}\n`;
}

export function normalizeYearId(name: string): string {
    const clean = (name || '').trim().replace(/[^\dA-Za-z._-]+/g, '-').replace(/^-+|-+$/g, '');
    return clean || String(new Date().getFullYear());
}

function stripPackHeaders(csv: string): string {
    return String(csv ?? '')
        .split(/\r?\n/)
        .filter((line) => !line.startsWith('#pack') && !line.startsWith('#year:'))
        .join('\n');
}
