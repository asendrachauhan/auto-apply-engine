import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ThemeToggleComponent } from '../theme-toggle/theme-toggle.component';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'aa-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterLinkActive, ThemeToggleComponent, IconComponent],
  template: `
    <aside class="sidebar" [class.collapsed]="collapsed()">
      <div class="sidebar-logo">
        <div class="logo-icon"><aa-icon name="zap" [size]="22"/></div>
        <div class="logo-text" *ngIf="!collapsed()">
          <div class="logo-name">AutoApply AI</div>
          <div class="logo-sub">Job Automation</div>
        </div>
        <button class="collapse-btn" (click)="collapsed.set(!collapsed())">
          <aa-icon [name]="collapsed() ? 'chevronRight' : 'chevronLeft'" [size]="14"/>
        </button>
      </div>

      <nav class="sidebar-nav">
        @for (item of navItems; track item.route) {
          <a class="nav-item" [routerLink]="item.route" routerLinkActive="active"
            [title]="item.label">
            <aa-icon class="nav-icon" [name]="item.icon" [size]="17"/>
            <span class="nav-label" *ngIf="!collapsed()">{{ item.label }}</span>
            @if (item.isNew) {
              <span class="new-badge" *ngIf="!collapsed()">NEW</span>
            }
          </a>
        }
      </nav>

      <!-- Automation status dot -->
      <div class="auto-status" *ngIf="!collapsed()">
        <div class="auto-label">AUTOMATION</div>
        <div class="auto-row">
          <span class="status-dot" [class.active]="user()?.automationActive"></span>
          <span class="auto-text">{{ user()?.automationActive ? 'Active — finding jobs' : 'Inactive' }}</span>
        </div>
      </div>

      <div class="sidebar-footer">
        <aa-theme-toggle />
        <div class="user-info" *ngIf="!collapsed()">
          <div class="user-avatar">{{ initials() }}</div>
          <div class="user-details">
            <div class="user-name">{{ user()?.name }}</div>
            <div class="user-plan">{{ planLabel() }}</div>
          </div>
        </div>
        <button class="logout-btn" (click)="auth.logout()">
          <aa-icon name="logout" [size]="14"/>
          <span *ngIf="!collapsed()">Logout</span>
        </button>
      </div>
    </aside>
  `,
  styles: [`
    .sidebar {
      width: 240px; height: 100vh; background: var(--bg); backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur)); border: 1px solid var(--glass-border);
      box-shadow: 4px 0 32px rgba(0,0,0,.18); position: fixed;
      top: 0; left: 0; z-index: 100; display: flex; flex-direction: column;
      padding: 20px 14px; gap: 4px; transition: width .3s ease; overflow: hidden;
    }
    .sidebar.collapsed { width: 68px; }

    .sidebar-logo { display:flex; align-items:center; gap:10px; padding:10px 12px; margin-bottom:16px; }
    .logo-icon    { font-size:28px; flex-shrink:0; }
    .logo-name    { font-family:var(--font-display); font-weight:700; font-size:15px; color:var(--text); }
    .logo-sub     { font-size:10px; color:var(--text-muted); }
    .collapse-btn { margin-left:auto; background:none; border:none; cursor:pointer; color:var(--text-muted); font-size:14px; flex-shrink:0; }

    .sidebar-nav { display:flex; flex-direction:column; gap:3px; flex:1; overflow-y:auto; }

    .nav-item {
      display:flex; align-items:center; gap:10px; padding:10px 12px;
      border-radius:10px; cursor:pointer; color:var(--text-muted);
      font-size:13px; font-weight:500; text-decoration:none;
      transition:all .2s ease; white-space:nowrap; position:relative;
    }
    .nav-item:hover  { color:var(--accent); box-shadow:var(--neo-sm); }
    .nav-item.active { color:var(--accent); box-shadow:var(--neo-inset); }
    .nav-icon { width:22px; flex-shrink:0; display:flex; justify-content:center; }
    .nav-label{ flex:1; }
    .new-badge {
      font-size:9px; font-weight:800; padding:2px 5px; border-radius:4px;
      background:linear-gradient(135deg,var(--accent),#a855f7); color:#fff;
      letter-spacing:.3px;
    }

    .auto-status { background:var(--bg); backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur)); border: 1px solid var(--glass-border); box-shadow:var(--neo-inset); border-radius:10px; padding:12px; margin-bottom:8px; }
    .auto-label  { font-size:10px; font-weight:700; color:var(--text-muted); letter-spacing:.8px; text-transform:uppercase; margin-bottom:6px; }
    .auto-row    { display:flex; align-items:center; gap:7px; }
    .auto-text   { font-size:11px; font-weight:600; color:var(--text); }
    .status-dot  { width:8px; height:8px; border-radius:50%; background:var(--text-light); flex-shrink:0; transition:.3s; }
    .status-dot.active { background:var(--success); box-shadow:0 0 8px rgba(67,233,123,.6); animation:pulse 2s infinite; }
    @keyframes pulse { 0%,100%{box-shadow:0 0 8px rgba(67,233,123,.5);}50%{box-shadow:0 0 18px rgba(67,233,123,.9);} }

    .sidebar-footer { border-top:1px solid rgba(163,177,198,.2); padding-top:12px; display:flex; flex-direction:column; gap:10px; }
    .user-info      { display:flex; align-items:center; gap:10px; }
    .user-avatar    { width:34px; height:34px; border-radius:50%; background:linear-gradient(135deg,var(--accent),#a855f7); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:13px; flex-shrink:0; }
    .user-name      { font-size:12px; font-weight:700; color:var(--text); }
    .user-plan      { font-size:10px; color:var(--accent); font-weight:600; }
    .logout-btn     { background:none; border:none; cursor:pointer; font-size:12px; color:var(--text-muted); text-align:left; padding:4px 0; display:flex; align-items:center; gap:8px; }
    .logout-btn:hover { color:var(--danger); }

    @media(max-width:768px) {
      .sidebar { width:100%; height:auto; position:relative; flex-direction:row; flex-wrap:wrap; border-bottom:1px solid rgba(163,177,198,.2); }
      .sidebar.collapsed { width:100%; }
      .sidebar-nav { flex-direction:row; overflow-x:auto; flex:none; }
      .auto-status, .sidebar-footer { display:none; }
    }
  `]
})
export class SidebarComponent {
  collapsed = signal(false);
  constructor(public auth: AuthService) {}

  user     = computed(() => this.auth.currentUser());
  initials = computed(() => {
    const n = this.auth.currentUser()?.name || '';
    return n.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
  });
  planLabel = computed(() => {
    const plan = this.user()?.plan || 'free';
    return plan === 'free' ? 'Free Plan' : plan.charAt(0).toUpperCase() + plan.slice(1) + ' Plan';
  });

  navItems = [
    { icon:'dashboard',   label:'Dashboard',    route:'/dashboard' },
    { icon:'resume',      label:'My Resume',    route:'/resume' },
    { icon:'target',      label:'Job Alerts',   route:'/alerts', isNew: true },
    { icon:'briefcase',   label:'Applications', route:'/jobs' },
    { icon:'zap',         label:'Automation',   route:'/automation' },
    { icon:'mapPin',      label:'EU Careers',   route:'/eu' },
    { icon:'plans',       label:'Plans',        route:'/plans' },
    { icon:'settings',    label:'Settings',     route:'/settings' },
  ];
}
