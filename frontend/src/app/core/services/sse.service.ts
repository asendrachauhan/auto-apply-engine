/**
 * SSE Service — Server-Sent Events for real-time job watcher updates.
 */
import { Injectable, OnDestroy } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export interface SseEvent {
  type: string;
  data: Record<string, unknown>;
}

@Injectable({ providedIn: 'root' })
export class SseService implements OnDestroy {
  private eventSource: EventSource | null = null;
  private events$ = new Subject<SseEvent>();

  constructor(private authService: AuthService) {}

  connect(): Observable<SseEvent> {
    const token = this.authService.getToken();
    const url   = `${environment.apiUrl}/watch/stream?token=${token}`;

    this.disconnect();

    this.eventSource = new EventSource(url);

    const eventNames = [
      'connected','watch:scanning','watch:new-jobs','watch:applying',
      'watch:applied','watch:progress','apply-progress','start','score',
      'progress','coverletter','done',
    ];

    eventNames.forEach((name) => {
      this.eventSource!.addEventListener(name, (e: MessageEvent) => {
        try {
          this.events$.next({ type: name, data: JSON.parse(e.data) });
        } catch { /* ignore */ }
      });
    });

    this.eventSource.onerror = () => {
      // Auto-reconnect after 5s on error
      setTimeout(() => this.connect(), 5000);
    };

    return this.events$.asObservable();
  }

  disconnect(): void {
    this.eventSource?.close();
    this.eventSource = null;
  }

  ngOnDestroy(): void { this.disconnect(); }
}
