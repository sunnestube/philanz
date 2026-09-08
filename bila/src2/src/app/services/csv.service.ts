import {inject, Injectable} from '@angular/core';
import {BudgetDataService} from './budget-data.service';

@Injectable({
    providedIn: 'root'
})
export class CsvService {
    private budgetService = inject(BudgetDataService);



}
