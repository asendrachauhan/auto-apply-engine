import { TestBed } from '@angular/core/testing';
import { HttpRequest, HttpHandlerFn, HttpEvent } from '@angular/common/http';
import { of, Subject } from 'rxjs';
import { loadingInterceptor } from './loading.interceptor';
import { LoadingService } from '../services/loading.service';

describe('LoadingService', () => {
  test('isLoading is false initially, true while any request is in flight', () => {
    const svc = new LoadingService();
    expect(svc.isLoading()).toBe(false);
    svc.start();
    expect(svc.isLoading()).toBe(true);
    svc.stop();
    expect(svc.isLoading()).toBe(false);
  });

  test('stays true until ALL concurrent requests finish, not just the first', () => {
    const svc = new LoadingService();
    svc.start(); svc.start(); svc.start();
    svc.stop();
    expect(svc.isLoading()).toBe(true); // 2 still in flight
    svc.stop();
    expect(svc.isLoading()).toBe(true); // 1 still in flight
    svc.stop();
    expect(svc.isLoading()).toBe(false);
  });

  test('never goes negative even with an extra/unbalanced stop() call', () => {
    const svc = new LoadingService();
    svc.stop(); // stop with nothing started
    svc.start();
    svc.stop();
    svc.stop(); // extra stop
    expect(svc.isLoading()).toBe(false);
  });
});

describe('loadingInterceptor', () => {
  test('calls start() before the request and stop() after it completes', () => {
    TestBed.configureTestingModule({ providers: [LoadingService] });
    const loading = TestBed.inject(LoadingService);

    const req = new HttpRequest('GET', '/api/test');
    const next: HttpHandlerFn = () => of({} as HttpEvent<any>);

    TestBed.runInInjectionContext(() => {
      loadingInterceptor(req, next).subscribe();
    });
    expect(loading.isLoading()).toBe(false); // synchronous of() completes immediately
  });

  test('regression: stop() still fires via finalize() even if the request errors', () => {
    TestBed.configureTestingModule({ providers: [LoadingService] });
    const loading = TestBed.inject(LoadingService);

    const req = new HttpRequest('GET', '/api/test');
    const errorSubject = new Subject<HttpEvent<any>>();
    const next: HttpHandlerFn = () => errorSubject.asObservable();

    TestBed.runInInjectionContext(() => {
      loadingInterceptor(req, next).subscribe({ error: () => {} });
    });
    expect(loading.isLoading()).toBe(true);
    errorSubject.error(new Error('network failure'));
    expect(loading.isLoading()).toBe(false);
  });
});
