import {SECTION} from './Section';
import {CELL_TYPE} from './CellType';

export class MonthColumn {
    title: string;
    type: CELL_TYPE;
    section: SECTION;

    constructor(title: string, type: CELL_TYPE = CELL_TYPE.number, section: SECTION = SECTION.DEFAULT) {
        this.title = title;
        this.type = type;
        this.section = section;
    }

}
