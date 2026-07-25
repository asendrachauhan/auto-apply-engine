import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'aa-not-found',
  standalone: true,
  imports: [CommonModule, RouterModule, IconComponent],
  template: `
    <div class="nf-page">
      <div class="nf-card neo anim-fade-in">
        <aa-icon name="alertCircle" [size]="40" class="nf-icon"/>
        <h1 class="nf-code">404</h1>
        <p class="text-muted">This page doesn't exist, or you don't have access to it.</p>
        <a routerLink="/dashboard"><button class="nf-btn">Back to Dashboard</button></a>
      </div>
    </div>
  `,
  styles: [`
    .nf-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .nf-card { max-width: 380px; width: 100%; padding: 40px 32px; text-align: center; }
    .nf-icon { color: var(--warning); margin-bottom: 12px; }
    .nf-code { font-family: var(--font-display); font-size: 44px; font-weight: 800; color: var(--text); margin-bottom: 8px; }
    .nf-btn {
      margin-top: 20px; padding: 10px 22px; border: none; border-radius: var(--radius-pill);
      background: linear-gradient(135deg,var(--accent),#a855f7); color: #fff;
      font-weight: 600; font-size: 13px; cursor: pointer;
    }
  `]
})
export class NotFoundComponent {}
