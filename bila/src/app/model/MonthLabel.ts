export enum MonthKey {
    JAN = "Jan",
    FEB = "Feb",
    MÄR = "Mär",
    APR = "Apr",
    MAI = "Mai",
    JUN = "Jun",
    JUL = "Jul",
    AUG = "Aug",
    SEP = "Sep",
    OKT = "Okt",
    NOV = "Nov",
    DEZ = "Dez"
}

export class MonthLabel{
    title: string;
    background: string = "";

    constructor(title: MonthKey, background:string = "") {
        this.title = title;
        this.background = background;
    }

}
