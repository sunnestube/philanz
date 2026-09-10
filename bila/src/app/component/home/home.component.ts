import {Component, inject} from '@angular/core';
import {Router, RouterLink} from '@angular/router';
import {Card} from 'primeng/card';
import {PrimeTemplate} from 'primeng/api';
import {YearArchiveService, YearMeta} from '../../service/year-archive.service';

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
    private readonly archive = inject(YearArchiveService);
    private readonly router = inject(Router);

    years(): YearMeta[] {
        return this.archive.years();
    }

    openYear(id: string): void {
        void this.router.navigate(['/year', id]);
    }

    newYear(): void {
        const name = String(new Date().getFullYear());
        const exists = this.archive.years().some((item) => item.id === name);
        const id = exists ? `${name}-${Date.now().toString(36).slice(-3)}` : name;
        void this.router.navigate(['/year', id]);
    }
}
