/**
 * Service pour les appels API AWS Cost Auditor
 */

import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { map, catchError, tap, timeout } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import {
  AWSCredentials,
  AWSService as AWSServiceModel,
  APIResponse,
  AuthState,
  AuditConfig
} from '../models/aws.models';

@Injectable({
  providedIn: 'root'
})
export class AwsApiService {
  private apiUrl = environment.apiUrl;

  // État d'authentification
  private authState = new BehaviorSubject<AuthState>({
    isAuthenticated: false
  });
  public authState$ = this.authState.asObservable();

  // Services AWS disponibles
  private services = new BehaviorSubject<AWSServiceModel[]>([]);
  public services$ = this.services.asObservable();

  // État de chargement
  private loading = new BehaviorSubject<boolean>(false);
  public loading$ = this.loading.asObservable();

  // Résultats d'audit
  private auditResults = new BehaviorSubject<any>(null);
  public auditResults$ = this.auditResults.asObservable();

  constructor(private http: HttpClient) {
    // Charger les services au démarrage
    this.loadServices();

    // Restaurer les credentials depuis le sessionStorage
    this.restoreCredentials();
  }

  /**
   * Crée les headers avec les credentials AWS
   */
  private getHeaders(credentials?: AWSCredentials): HttpHeaders {
    const creds = credentials || this.authState.value.credentials;

    if (!creds) {
      return new HttpHeaders({ 'Content-Type': 'application/json' });
    }

    let headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'X-AWS-Access-Key-Id': creds.accessKeyId,
      'X-AWS-Secret-Access-Key': creds.secretAccessKey,
      'X-AWS-Region': creds.region
    });

    if (creds.sessionToken) {
      headers = headers.set('X-AWS-Session-Token', creds.sessionToken);
    }

    return headers;
  }

  /**
   * Charge la liste des services AWS disponibles
   */
  loadServices(): void {
    this.http.get<APIResponse<{ services: AWSServiceModel[] }>>(
      `${this.apiUrl}/services`
    ).pipe(
      map(response => response.data?.services || []),
      catchError(error => {
        console.error('Erreur chargement services:', error);
        return [];
      })
    ).subscribe(services => {
      this.services.next(services as AWSServiceModel[]);
    });
  }

  /**
   * Valide les credentials AWS
   */
  validateCredentials(credentials: AWSCredentials): Observable<{ accountId: string }> {
    this.loading.next(true);

    return this.http.post<APIResponse<{ accountId: string }>>(
      `${this.apiUrl}/validate`,
      {},
      { headers: this.getHeaders(credentials) }
    ).pipe(
      tap(response => {
        this.loading.next(false);

        if (response.success && response.data) {
          // Sauvegarder les credentials
          this.authState.next({
            isAuthenticated: true,
            accountId: response.data.accountId,
            credentials
          });

          // Sauvegarder dans sessionStorage (attention: sensible!)
          sessionStorage.setItem('aws_credentials', JSON.stringify(credentials));
          sessionStorage.setItem('aws_account_id', response.data.accountId);
        }
      }),
      map(response => {
        if (!response.success) {
          throw new Error(response.error || 'Validation failed');
        }
        return response.data!;
      }),
      catchError(error => {
        this.loading.next(false);
        return throwError(() => new Error(error.error?.error || error.message));
      })
    );
  }

  /**
   * Restaure les credentials depuis sessionStorage
   */
  private restoreCredentials(): void {
    const credentialsJson = sessionStorage.getItem('aws_credentials');
    const accountId = sessionStorage.getItem('aws_account_id');

    if (credentialsJson && accountId) {
      try {
        const credentials = JSON.parse(credentialsJson) as AWSCredentials;
        this.authState.next({
          isAuthenticated: true,
          accountId,
          credentials
        });
      } catch {
        this.logout();
      }
    }
  }

  /**
   * Déconnexion
   */
  logout(): void {
    sessionStorage.removeItem('aws_credentials');
    sessionStorage.removeItem('aws_account_id');
    this.authState.next({ isAuthenticated: false });
    this.auditResults.next(null);
  }

  /**
   * Lance un audit avec streaming SSE pour la progression en temps réel
   */
  runAuditWithProgress(
    config: AuditConfig | undefined,
    onProgress: (step: string, status: 'start' | 'complete' | 'error') => void
  ): Observable<any> {
    return new Observable(observer => {
      const creds = this.authState.value.credentials;
      if (!creds) {
        observer.error(new Error('Not authenticated'));
        return;
      }

      const body = JSON.stringify(config || {});

      // Use fetch for SSE with POST
      fetch(`${this.apiUrl}/audit/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-AWS-Access-Key-Id': creds.accessKeyId,
          'X-AWS-Secret-Access-Key': creds.secretAccessKey,
          'X-AWS-Region': creds.region,
          ...(creds.sessionToken ? { 'X-AWS-Session-Token': creds.sessionToken } : {})
        },
        body
      }).then(async response => {
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          observer.error(new Error('No response body'));
          return;
        }

        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Parse SSE events
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          let eventType = '';
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventType = line.slice(7);
            } else if (line.startsWith('data: ')) {
              const data = JSON.parse(line.slice(6));

              if (eventType === 'progress') {
                onProgress(data.step, data.status);
              } else if (eventType === 'complete') {
                this.auditResults.next(data);
                observer.next(data);
                observer.complete();
              } else if (eventType === 'error') {
                observer.error(new Error(data.error));
              }
            }
          }
        }
      }).catch(error => {
        observer.error(error);
      });
    });
  }

  /**
   * Lance un audit complet ou partiel (sans streaming)
   */
  runAudit(config?: AuditConfig): Observable<any> {
    this.loading.next(true);

    const body = config || {};

    return this.http.post<APIResponse>(
      `${this.apiUrl}/audit`,
      body,
      { headers: this.getHeaders() }
    ).pipe(
      timeout(600000), // 10 minutes timeout pour les gros audits
      tap(response => {
        console.log('=== AUDIT RESPONSE ===');
        console.log('Success:', response.success);
        console.log('Data keys:', response.data ? Object.keys(response.data) : 'no data');
        console.log('Results keys:', response.data?.results ? Object.keys(response.data.results) : 'no results');
        console.log('Full response:', response);

        this.loading.next(false);

        if (response.success && response.data) {
          console.log('Storing audit results...');
          this.auditResults.next(response.data);
        }
      }),
      map(response => {
        if (!response.success) {
          throw new Error(response.error || 'Audit failed');
        }
        return response.data;
      }),
      catchError(error => {
        this.loading.next(false);
        return throwError(() => new Error(error.error?.error || error.message));
      })
    );
  }

  /**
   * Lance un audit pour une catégorie spécifique
   */
  runCategoryAudit(category: string, regions?: string[]): Observable<any> {
    this.loading.next(true);

    return this.http.post<APIResponse>(
      `${this.apiUrl}/audit/${category}`,
      { regions },
      { headers: this.getHeaders() }
    ).pipe(
      tap(() => this.loading.next(false)),
      map(response => {
        if (!response.success) {
          throw new Error(response.error || 'Audit failed');
        }
        return response.data;
      }),
      catchError(error => {
        this.loading.next(false);
        return throwError(() => new Error(error.error?.error || error.message));
      })
    );
  }

  /**
   * Obtient les services par catégorie
   */
  getServicesByCategory(): Observable<Map<string, AWSServiceModel[]>> {
    return this.services$.pipe(
      map(services => {
        const grouped = new Map<string, AWSServiceModel[]>();

        services.forEach(service => {
          const category = service.category;
          if (!grouped.has(category)) {
            grouped.set(category, []);
          }
          grouped.get(category)!.push(service);
        });

        return grouped;
      })
    );
  }

  /**
   * Vérifie si l'utilisateur est authentifié
   */
  isAuthenticated(): boolean {
    return this.authState.value.isAuthenticated;
  }

  /**
   * Obtient l'ID du compte AWS
   */
  getAccountId(): string | undefined {
    return this.authState.value.accountId;
  }
}
