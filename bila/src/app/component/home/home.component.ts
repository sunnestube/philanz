import {Component} from '@angular/core';
import {RouterLink} from '@angular/router';
import {Card} from 'primeng/card';
import {PrimeTemplate} from 'primeng/api';

@Component({
    templateUrl: './home.component.html',
    imports: [
        RouterLink,
        Card,
        PrimeTemplate
    ],
    styleUrl: './home.component.css'
})
export class HomeComponent {
}
