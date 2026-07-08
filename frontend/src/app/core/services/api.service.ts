import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

/** Standard envelope every AutoApply AI backend endpoint responds with. */
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  meta?: { total: number; page: number; limit: number; pages: number };
  errors?: string[];
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  // ── Generic HTTP wrapper ──────────────────────────────────────────────────
  get<T>(path: string, params?: Record<string, any>): Observable<T> {
    let p = new HttpParams();
    if (params) Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') p = p.set(k, String(v));
    });
    return this.http.get<T>(`${this.base}${path}`, { params: p });
  }
  post<T>(path: string, body: any): Observable<T>  { return this.http.post<T>(`${this.base}${path}`, body); }
  put<T>(path: string, body: any): Observable<T>   { return this.http.put<T>(`${this.base}${path}`, body);  }
  patch<T>(path: string, body: any): Observable<T> { return this.http.patch<T>(`${this.base}${path}`, body);}
  delete<T>(path: string): Observable<T>            { return this.http.delete<T>(`${this.base}${path}`);     }

  // ── Resume (/api/resume) ─────────────────────────────────────────────────
  getMyResume(): Observable<ApiResponse> { return this.get(`/resume/my`); }
  uploadResume(form: FormData): Observable<ApiResponse> { return this.http.post<ApiResponse>(`${this.base}/resume/upload`, form); }

  // ── Jobs (/api/jobs) ──────────────────────────────────────────────────────
  discoverJobs(euMode = false): Observable<ApiResponse> { return this.get(`/jobs/discover`, { euMode }); }
  getApplications(params: { page?: number; limit?: number; status?: string } = {}): Observable<ApiResponse> {
    return this.get(`/jobs/applications`, params);
  }
  updateJobStatus(id: string, status: string): Observable<ApiResponse> {
    return this.patch(`/jobs/applications/${id}/status`, { status });
  }

  // ── Automation (/api/automation) ─────────────────────────────────────────
  startAutomation(): Observable<ApiResponse>   { return this.post(`/automation/start`, {}); }
  stopAutomation(): Observable<ApiResponse>    { return this.post(`/automation/stop`, {}); }
  runAutomationNow(): Observable<ApiResponse>  { return this.post(`/automation/run-now`, {}); }
  getAutoStatus(): Observable<ApiResponse>     { return this.get(`/automation/status`); }
  getAutoHistory(): Observable<ApiResponse>    { return this.get(`/automation/history`); }

  // ── Real-time watcher (/api/watch — Pro/Elite only) ──────────────────────
  startWatch(): Observable<ApiResponse> { return this.post(`/watch/start`, {}); }
  stopWatch(): Observable<ApiResponse>  { return this.post(`/watch/stop`, {}); }

  // ── Job Alerts (/api/alerts) ─────────────────────────────────────────────
  getAlerts(params: { page?: number; limit?: number; status?: string } = {}): Observable<ApiResponse> {
    return this.get(`/alerts`, params);
  }
  getAlertStats(): Observable<ApiResponse> { return this.get(`/alerts/stats`); }
  getAlert(id: string): Observable<ApiResponse> { return this.get(`/alerts/${id}`); }
  updateAlertStatus(id: string, status: string, notes?: string): Observable<ApiResponse> {
    return this.patch(`/alerts/${id}/status`, { status, notes });
  }
  deleteAlert(id: string): Observable<ApiResponse> { return this.delete(`/alerts/${id}`); }
  runAlertPipeline(): Observable<ApiResponse> { return this.post(`/alerts/run`, {}); }
  getAlertPDF(id: string): Observable<ApiResponse> { return this.get(`/alerts/${id}/resume-pdf`); }
  getAlertPrefill(id: string): Observable<ApiResponse> { return this.get(`/alerts/${id}/prefill`); }

  // ── Settings (/api/settings) ─────────────────────────────────────────────
  getSettings(): Observable<ApiResponse> { return this.get(`/settings`); }
  updatePreferences(payload: any): Observable<ApiResponse> { return this.put(`/settings/preferences`, payload); }
  exportData(): Observable<Blob> { return this.http.get(`${this.base}/settings/data-export`, { responseType: 'blob' }); }

  // ── Intelligence — EU pathways (/api/intelligence) ───────────────────────
  getEuPathways(): Observable<ApiResponse> { return this.get(`/intelligence/eu/pathways`); }
  convertCtc(ctcLPA: number, targetCountry = 'DE'): Observable<ApiResponse> {
    return this.post(`/intelligence/eu/ctc-convert`, { ctcLPA, targetCountry });
  }
  getVisaEligibility(country: string): Observable<ApiResponse> { return this.get(`/intelligence/eu/visa/${country}`); }
  getEuResumeGuide(country: string): Observable<ApiResponse> { return this.get(`/intelligence/eu/resume-guide/${country}`); }

  // ── Subscription (/api/subscription) ─────────────────────────────────────
  createCheckout(plan: string): Observable<ApiResponse> { return this.post(`/subscription/create-checkout`, { plan }); }
  getBillingPortal(): Observable<ApiResponse> { return this.get(`/subscription/portal`); }

  // ── Public config (/api/config) — pricing, features, AI model info ──────
  getPlansConfig(): Observable<ApiResponse> { return this.get(`/config/plans`); }
  getAiConfig(): Observable<ApiResponse> { return this.get(`/config/ai`); }
}
