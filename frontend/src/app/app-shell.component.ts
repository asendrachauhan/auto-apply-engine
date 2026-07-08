import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from './shared/components/sidebar/sidebar.component';

@Component({
  selector: 'aa-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent],
  template: `
    <div class="app-shell">
      <aa-sidebar/>
      <main class="main-content">
        <router-outlet/>
      </main>
    </div>
  `,
  styles: [`
    .app-shell    { display: flex; min-height: 100vh; }
    .main-content {
      margin-left: 240px; flex: 1; padding: 32px;
      min-height: 100vh; transition: margin-left .3s ease;
    }
    @media(max-width: 768px) {
      .app-shell    { flex-direction: column; }
      .main-content { margin-left: 0; padding: 16px; }
    }
  `]
})
export class AppShellComponent {}
