import {Routes} from '@angular/router';
import {AboutComponent} from './component/about/about.component';
import {YearComponent} from './component/year/year.component';
import {GptComponent} from './component/gpt/gpt.component';
import {HomeComponent} from './component/home/home.component';

export const routes: Routes = [
    {path: '', component: HomeComponent},
    {path: 'gpt', component: GptComponent},
    {path: 'year', component: YearComponent},
    {
        path: 'biltanz',
        loadComponent: () =>
            import('./features/biltanz/pages/biltanz-page/biltanz-page.component')
                .then((m) => m.BiltanzPageComponent)
    },
    {path: 'about', component: AboutComponent}
];
