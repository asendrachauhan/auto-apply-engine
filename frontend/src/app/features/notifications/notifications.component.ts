/**
 * Notifications Center — full history of everything the app has emailed,
 * WhatsApp'd, or otherwise notified the user about, with read/unread state.
 * Quick recent items also surface via the bell dropdown in app-header.
 */
import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { PushNotificationService } from '../../core/services/push-notification.service';
import { NeoButtonComponent } from '../../shared/components/neo-button/neo-button.component';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'aa-notifications',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule, NeoButtonComponent, IconComponent],
  template: `
    <div class="page-container">
      <div class="page-header d-flex justify-between align-center">
        <div>
          <h1 class="page-title">{{ 'NOTIFICATIONS.TITLE' | translate }}</h1>
          <p class="page-subtitle">{{ 'NOTIFICATIONS.SUBTITLE' | translate }}</p>
        </div>
        @if (notifications().length > 0) {
          <aa-button variant="secondary" size="sm" (clicked)="markAllRead()">{{ 'COMMON.MARK_ALL_READ' | translate }}</aa-button>
        }
      </div>

      <!-- Web Push Notifications Banner -->
      @if (pushService.isSupported()) {
        <div class="push-banner neo mb-20">
          <div class="push-banner-content">
            <div class="push-banner-icon" [class.active]="pushService.isSubscribed()">
              <aa-icon [name]="pushService.isSubscribed() ? 'checkCircle' : 'bell'" [size]="20"/>
            </div>
            <div>
              <div class="push-banner-title">
                {{ pushService.isSubscribed() ? 'Background Push Notifications Active' : 'Enable Background Push Notifications' }}
              </div>
              <div class="push-banner-desc text-muted text-xs">
                {{ pushService.isSubscribed() 
                  ? 'You will receive instant alerts on this device whenever new matching jobs are found, even when AutoApply AI is closed.' 
                  : 'Receive real-time match alerts and tailored application packets directly to your operating system while the browser is minimized or closed.' }}
              </div>
            </div>
          </div>
          <div class="push-banner-actions">
            @if (!pushService.isSubscribed()) {
              <aa-button size="sm" [loading]="pushService.isLoading()" (clicked)="pushService.subscribe()" icon="bell">
                Enable Web Push
              </aa-button>
            } @else {
              <aa-button variant="secondary" size="sm" (clicked)="pushService.sendTest()" icon="sparkles">
                Send Test
              </aa-button>
              <aa-button variant="ghost" size="sm" [loading]="pushService.isLoading()" (clicked)="pushService.unsubscribe()">
                Disable
              </aa-button>
            }
          </div>
        </div>
      }

      <div class="filters-bar neo-sm">
        @for (f of typeFilters; track f.val) {
          <button class="filter-btn" [class.active]="activeType() === f.val" (click)="setType(f.val)">
            {{ f.label | translate }}
          </button>
        }
      </div>

      @if (loading()) {
        <div class="skeleton-list">
          @for (i of [1,2,3,4]; track i) { <div class="notif-skeleton neo"></div> }
        </div>
      } @else if (notifications().length === 0) {
        <div class="empty-state neo">
          <aa-icon name="bell" [size]="32" class="empty-icon"/>
          <div class="empty-title">{{ 'NOTIFICATIONS.EMPTY' | translate }}</div>
        </div>
      } @else {
        <div class="notif-list">
          @for (n of notifications(); track n._id) {
            <div class="notif-row neo" [class.unread]="!n.read">
              <div class="notif-icon" [class]="n.type">
                <aa-icon [name]="typeIcon(n.type)" [size]="16"/>
              </div>
              <button type="button" class="notif-content" (click)="openNotif(n)" [attr.aria-label]="n.title + ': ' + n.message">
                <div class="notif-row-title">{{ n.title }}</div>
                <div class="notif-row-msg">{{ n.message }}</div>
                <div class="notif-row-meta">{{ timeAgo(n.createdAt) }}</div>
              </button>
              <div class="notif-actions">
                @if (!n.read) {
                  <button class="icon-action" (click)="markRead(n)" [title]="'COMMON.MARK_READ' | translate">
                    <aa-icon name="check" [size]="14"/>
                  </button>
                }
                <button class="icon-action" (click)="remove(n)" [title]="'COMMON.DELETE' | translate">
                  <aa-icon name="trash" [size]="14"/>
                </button>
              </div>
            </div>
          }
        </div>

        @if (total() > notifications().length) {
          <div class="load-more">
            <aa-button variant="secondary" [loading]="loadingMore()" (clicked)="loadMore()">{{ 'COMMON.LOAD_MORE' | translate }}</aa-button>
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .filters-bar { display:flex; align-items:center; gap:8px; padding:12px 16px; margin-bottom:20px; flex-wrap:wrap; }
    .filter-btn { padding:6px 14px; border-radius:var(--radius-pill); border:none; background:var(--bg); backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur)); border: 1px solid var(--glass-border); box-shadow:var(--neo-sm); font-size:12px; font-weight:600; cursor:pointer; color:var(--text-muted); transition:all .2s; }
    .filter-btn:hover { color:var(--text); background:var(--surface-hover); }
    .filter-btn:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
    .filter-btn.active { box-shadow:var(--neo-inset); color:var(--accent); }

    .skeleton-list { display:flex; flex-direction:column; gap:10px; }
    .notif-skeleton { height: 72px; border-radius: var(--radius); }

    .empty-state { padding: 48px 24px; display:flex; flex-direction:column; align-items:center; gap:10px; }
    .empty-icon { color: var(--text-muted); }
    .empty-title { font-size: 13px; font-weight: 600; color: var(--text-muted); }

    .notif-list { display:flex; flex-direction:column; gap:10px; }
    .notif-row { display:flex; align-items:flex-start; gap:12px; padding:14px 16px; position:relative; }
    .notif-row.unread { box-shadow: var(--neo-raised), 0 0 0 1px var(--accent-ring-strong) inset; }
    .notif-icon { width:34px; height:34px; border-radius:10px; flex-shrink:0; display:flex; align-items:center; justify-content:center; background:var(--accent-dim); color:var(--accent); }
    .notif-icon.billing { color:var(--warning); background:var(--warning-soft); }
    .notif-icon.referral { color:var(--accent-secondary); background:var(--accent-soft); }
    .notif-icon.system { color:var(--text-muted); background:var(--divider); }
    .notif-content { flex:1; min-width:0; cursor:pointer; text-align:left; background:none; border:none; font-family:inherit; padding:0; display:block; }
    .notif-content:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 4px; }
    .notif-row-title { font-size:13px; font-weight:700; color:var(--text); }
    .notif-row-msg { font-size:12px; color:var(--text-muted); margin-top:2px; }
    .notif-row-meta { font-size:10px; color:var(--text-light); margin-top:6px; }
    .notif-actions { display:flex; gap:4px; flex-shrink:0; }
    .icon-action { background:none; border:none; cursor:pointer; color:var(--text-muted); padding:6px; border-radius:8px; display:flex; }
    .icon-action:hover { color:var(--accent); background:var(--accent-hover); }
    .icon-action:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }

    .page-header { margin-bottom: 24px; }
    .push-banner { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:16px 20px; border-left:4px solid var(--accent); flex-wrap:wrap; border-radius:var(--radius); margin-top: 4px; margin-bottom: 24px; }
    .push-banner-content { display:flex; align-items:center; gap:14px; flex:1; min-width:240px; }
    .push-banner-icon { width:42px; height:42px; border-radius:12px; background:var(--accent-dim); color:var(--accent); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .push-banner-icon.active { background:rgba(74,222,128,0.15); color:var(--success); }
    .push-banner-title { font-size:14px; font-weight:700; color:var(--text); margin-bottom:2px; }
    .push-banner-desc { font-size:12px; color:var(--text-muted); line-height:1.4; }
    .push-banner-actions { display:flex; align-items:center; gap:10px; flex-shrink:0; }

    .load-more { display:flex; justify-content:center; margin-top:20px; }

    @media (max-width: 640px) {
      .push-banner { flex-direction:column; align-items:flex-start; }
      .push-banner-actions { width:100%; justify-content:flex-end; }
      .filters-bar { padding: 10px 12px; overflow-x: auto; flex-wrap: nowrap; }
      .filter-btn { flex-shrink: 0; }
      .notif-row { padding: 12px; gap: 10px; }
      .notif-actions { flex-direction: column; }
      .page-header.d-flex { flex-wrap: wrap; gap: 12px; }
    }
  `]
})
export class NotificationsComponent implements OnInit, OnDestroy {
  notifications = signal<any[]>([]);
  total = signal(0);
  loading = signal(true);
  loadingMore = signal(false);
  activeType = signal('all');
  now = signal(Date.now());
  private timerHandle?: any;
  page = 1;

  typeFilters = [
    { val: 'all',         label: 'COMMON.ALL' },
    { val: 'job_alert',   label: 'NOTIFICATIONS.TYPE_JOB_ALERT' },
    { val: 'application', label: 'NOTIFICATIONS.TYPE_APPLICATION' },
    { val: 'automation',  label: 'NOTIFICATIONS.TYPE_AUTOMATION' },
    { val: 'billing',     label: 'NOTIFICATIONS.TYPE_BILLING' },
    { val: 'referral',    label: 'NOTIFICATIONS.TYPE_REFERRAL' },
    { val: 'system',      label: 'NOTIFICATIONS.TYPE_SYSTEM' },
  ];

  constructor(
    private api: ApiService,
    private toast: ToastService,
    private router: Router,
    public pushService: PushNotificationService
  ) {}

  ngOnInit(): void {
    this.load();
    this.timerHandle = setInterval(() => this.now.set(Date.now()), 30000);
  }

  ngOnDestroy(): void {
    if (this.timerHandle) clearInterval(this.timerHandle);
  }

  load(): void {
    this.loading.set(true);
    this.page = 1;
    const type = this.activeType() === 'all' ? undefined : this.activeType();
    this.api.getNotifications({ page: 1, limit: 20, type }).subscribe({
      next: (r: any) => {
        this.notifications.set(r.data || []);
        this.total.set(r.meta?.total || 0);
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); this.toast.error('Failed to load notifications'); },
    });
  }

  loadMore(): void {
    this.loadingMore.set(true);
    this.page++;
    const type = this.activeType() === 'all' ? undefined : this.activeType();
    this.api.getNotifications({ page: this.page, limit: 20, type }).subscribe({
      next: (r: any) => {
        this.notifications.set([...this.notifications(), ...(r.data || [])]);
        this.loadingMore.set(false);
      },
      error: () => { this.loadingMore.set(false); },
    });
  }

  setType(val: string): void { this.activeType.set(val); this.load(); }

  openNotif(n: any): void {
    if (!n.read) this.markRead(n);
    const targetLink = n.link || '/alerts';
    this.router.navigateByUrl(targetLink).catch(() => {
      this.router.navigateByUrl('/alerts');
    });
  }

  markRead(n: any): void {
    this.api.markNotificationRead(n._id).subscribe({
      next: () => this.notifications.set(this.notifications().map(x => x._id === n._id ? { ...x, read: true } : x)),
    });
  }

  markAllRead(): void {
    this.api.markAllNotificationsRead().subscribe({
      next: () => {
        this.notifications.set(this.notifications().map(n => ({ ...n, read: true })));
        this.toast.success('All notifications marked as read');
      },
    });
  }

  remove(n: any): void {
    this.api.deleteNotification(n._id).subscribe({
      next: () => {
        this.notifications.set(this.notifications().filter(x => x._id !== n._id));
        this.total.set(Math.max(0, this.total() - 1));
      },
      error: () => this.toast.error('Failed to delete notification'),
    });
  }

  typeIcon(type: string): string {
    return { job_alert: 'target', application: 'briefcase', automation: 'zap', billing: 'currency', referral: 'gift', system: 'info' }[type] || 'bell';
  }

  timeAgo(d: string): string {
    if (!d) return '';
    // Reading now() registers signal dependency for reactive auto-refresh
    const current = this.now();
    const diff = current - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }
}
