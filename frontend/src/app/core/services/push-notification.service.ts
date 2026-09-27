import { Injectable, signal, inject } from '@angular/core';
import { ApiService } from './api.service';
import { ToastService } from './toast.service';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

@Injectable({
  providedIn: 'root'
})
export class PushNotificationService {
  private api = inject(ApiService);
  private toast = inject(ToastService);

  readonly isSupported = signal<boolean>(false);
  readonly isSubscribed = signal<boolean>(false);
  readonly isLoading = signal<boolean>(false);
  readonly permission = signal<NotificationPermission>('default');

  private registration: ServiceWorkerRegistration | null = null;

  constructor() {
    this.checkSupportAndInit();
  }

  async checkSupportAndInit(): Promise<void> {
    if (typeof window === 'undefined') return;

    if ('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window) {
      this.isSupported.set(true);
      this.permission.set(Notification.permission);

      try {
        this.registration = await navigator.serviceWorker.register('/sw-push.js', { scope: '/' });
        const existingSub = await this.registration.pushManager.getSubscription();
        this.isSubscribed.set(!!existingSub);
      } catch (err) {
        console.warn('[PushNotificationService] Service worker registration error:', err);
      }
    }
  }

  async subscribe(): Promise<boolean> {
    if (!this.isSupported()) {
      this.toast.error('Web Push notifications are not supported in this browser.');
      return false;
    }

    this.isLoading.set(true);

    try {
      // 1. Request browser permission
      const perm = await Notification.requestPermission();
      this.permission.set(perm);

      if (perm !== 'granted') {
        this.isLoading.set(false);
        this.toast.error('Notification permission denied. Please allow notifications in your browser settings.');
        return false;
      }

      // 2. Fetch VAPID key
      const keyRes: any = await this.api.getPushKey().toPromise();
      const vapidPublicKey = keyRes?.data?.publicKey;

      if (!vapidPublicKey) {
        this.isLoading.set(false);
        this.toast.error('Push server key not available.');
        return false;
      }

      // 3. Register SW if needed
      if (!this.registration) {
        this.registration = await navigator.serviceWorker.register('/sw-push.js', { scope: '/' });
      }
      const activeReg = await navigator.serviceWorker.ready;
      this.registration = activeReg;

      // 4. Subscribe with PushManager
      const convertedKey = urlBase64ToUint8Array(vapidPublicKey);
      let subscription = await activeReg.pushManager.getSubscription();

      if (subscription) {
        // If an existing subscription exists, test if backend accepts it or recreate
        try {
          await this.api.subscribePush(subscription.toJSON()).toPromise();
          this.isSubscribed.set(true);
          this.isLoading.set(false);
          this.toast.success('Push notifications enabled! You will be alerted when new jobs are ready, even if the app is closed.');
          return true;
        } catch (_) {
          // If expired or key mismatch, unsubscribe and re-subscribe cleanly below
          await subscription.unsubscribe().catch(() => {});
        }
      }

      subscription = await activeReg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey as any,
      });

      // 5. Send to backend
      await this.api.subscribePush(subscription.toJSON()).toPromise();

      this.isSubscribed.set(true);
      this.isLoading.set(false);
      this.toast.success('Push notifications enabled! You will be alerted when new jobs are ready, even if the app is closed.');
      return true;
    } catch (err: any) {
      this.isLoading.set(false);
      console.error('[PushNotificationService] Subscribe failed:', err);

      let friendlyMsg = 'Unable to connect to push notification service. Please try again.';
      const msg = err?.message || '';
      const errName = err?.name || '';

      if (err?.error?.message) {
        friendlyMsg = err.error.message;
      } else if (errName === 'NotAllowedError' || msg.includes('permission denied')) {
        friendlyMsg = 'Notification permission was denied. Please allow notifications in your browser site settings.';
      } else if (msg.includes('push service') || msg.includes('Push service') || msg.includes('Registration failed')) {
        const isBrave = typeof (navigator as any)?.brave !== 'undefined';
        if (isBrave) {
          friendlyMsg = 'Push messaging is blocked in Brave. Please enable "Use Google services for push messaging" in brave://settings/privacy, restart Brave, and click Enable again.';
        } else {
          friendlyMsg = 'Push notification service is temporarily unavailable in your browser. Please check your browser connection or settings.';
        }
      } else if (msg) {
        friendlyMsg = `Push setup error: ${msg}`;
      }

      this.toast.error(friendlyMsg);
      return false;
    }
  }

  async unsubscribe(): Promise<boolean> {
    if (!this.registration) return false;
    this.isLoading.set(true);

    try {
      const subscription = await this.registration.pushManager.getSubscription();
      if (subscription) {
        await this.api.unsubscribePush(subscription.endpoint).toPromise();
        await subscription.unsubscribe();
      }

      this.isSubscribed.set(false);
      this.isLoading.set(false);
      this.toast.success('Push notifications disabled.');
      return true;
    } catch (err: any) {
      this.isLoading.set(false);
      console.error('[PushNotificationService] Unsubscribe failed:', err);
      this.toast.error('Failed to disable push notifications');
      return false;
    }
  }

  sendTest(): void {
    if (!this.isSubscribed()) {
      this.toast.error('Please enable push notifications first.');
      return;
    }

    this.api.testPushNotification().subscribe({
      next: () => {
        this.toast.success('Test notification sent! Check your system notification banner.');
      },
      error: (err: any) => {
        this.toast.error(err?.error?.message || 'Failed to send test notification');
      }
    });
  }
}
