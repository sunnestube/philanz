import {Routes} from '@angular/router';

export const routes: Routes = [
    {path: '', loadComponent: () => import('./component/home/home.component').then((m) => m.HomeComponent)},
    {path: 'gpt', loadComponent: () => import('./component/gpt/gpt.component').then((m) => m.GptComponent)},
    {path: 'year', loadComponent: () => import('./component/year/year.component').then((m) => m.YearComponent)},
    {path: 'year/:id', loadComponent: () => import('./component/year/year.component').then((m) => m.YearComponent)},
    {path: 'set', loadComponent: () => import('./component/yearSet/year-set.component').then((m) => m.YearSetComponent)},
    {path: 'pack/total', loadComponent: () => import('./component/packTotal/pack-total.component').then((m) => m.PackTotalComponent)},
    {
        path: 'pack/graf',
        loadComponent: () =>
            import('./component/packGraf/pack-graf.component').then((m) => m.PackGrafComponent)
    },
    {
        path: 'biltanz',
        loadComponent: () =>
            import('./features/biltanz/pages/biltanz-page/biltanz-page.component')
                .then((m) => m.BiltanzPageComponent)
    },
    {path: 'about', loadComponent: () => import('./component/about/about.component').then((m) => m.AboutComponent)}
];
