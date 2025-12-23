export enum CELL_TYPE {
    number = "number",
    text = "text",
    date = "date",
    select = "select",
    index = "index",
    none = "none",
    select_person = "select_person",
    select_account = "select_account",
}

export enum FRACTION_DIGITS {
    CHF = 2,
}

export class CellType {
    id: CELL_TYPE;
    desc: string = "";


    constructor(id: CELL_TYPE, desc: string = "") {
        this.id = id;
        this.desc = desc;
    }

}
