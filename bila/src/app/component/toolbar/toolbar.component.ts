import {Component, Input} from '@angular/core';
import {RouterLink, RouterLinkActive} from '@angular/router';
import {Toolbar} from 'primeng/toolbar';
import {Button} from 'primeng/button';

@Component({
    selector: 'bal-toolbar',
    imports: [RouterLink, Toolbar, Button, RouterLinkActive],
    templateUrl: './toolbar.component.html',
    styleUrl: './toolbar.component.css'
})
export class ToolbarComponent {
    @Input() title: string = ""
}
