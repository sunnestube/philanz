import {Component} from '@angular/core';
import {RouterOutlet} from '@angular/router';
import {ToolbarComponent} from './component/toolbar/toolbar.component';

@Component({
    selector: 'bal-root',
    imports: [RouterOutlet, ToolbarComponent],
    templateUrl: './app.component.html',
    styleUrl: './app.component.css'
})
export class AppComponent {
    title = '';
}
