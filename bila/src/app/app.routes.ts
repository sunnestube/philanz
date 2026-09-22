import {Routes} from '@angular/router';
import {AboutComponent} from './component/about/about.component';
import {YearComponent} from './component/year/year.component';
import {YearSetComponent} from './component/yearSet/year-set.component';
import {PackTotalComponent} from './component/packTotal/pack-total.component';
import {PackGrafComponent} from './component/packGraf/pack-graf.component';
import {GptComponent} from './component/gpt/gpt.component';
import {HomeComponent} from './component/home/home.component';

export const routes: Routes = [
    {path: '', component: HomeComponent},
    {path: 'gpt', component: GptComponent},
    {path: 'year', component: YearComponent},
    {path: 'year/:id', component: YearComponent},
    {path: 'set', component: YearSetComponent},
    {path: 'pack/total', component: PackTotalComponent},
    {path: 'pack/graf', component: PackGrafComponent},
    {
        path: 'biltanz',
        loadComponent: () =>
            import('./features/biltanz/pages/biltanz-page/biltanz-page.component')
                .then((m) => m.BiltanzPageComponent)
    },
    {path: 'about', component: AboutComponent}
];
