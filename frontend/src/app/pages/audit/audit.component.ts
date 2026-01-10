/**
 * Page de sélection des services à auditer
 */

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { AwsApiService } from '../../services/aws.service';
import { I18nService } from '../../services/i18n.service';
import {
  AWSService as AWSServiceModel,
  ServiceCategory,
  CATEGORY_LABELS,
  CATEGORY_ICONS
} from '../../models/aws.models';

interface AuditStep {
  id: string;
  label: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  details?: string;
}

@Component({
  selector: 'app-audit',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="audit-page">
      <div class="page-header">
        <h1>{{ t('audit.title') }}</h1>
        <p>{{ t('audit.subtitle') }}</p>
      </div>

      <div class="alert alert-info" *ngIf="!loading">
        {{ t('audit.infoNote') }}
      </div>

      <div class="audit-controls">
        <label class="checkbox-item large" [class.checked]="selectAll">
          <input
            type="checkbox"
            [(ngModel)]="selectAll"
            (change)="toggleSelectAll()"
          />
          <strong>{{ t('audit.selectAll') }}</strong>
        </label>

        <button
          class="btn btn-primary"
          [disabled]="loading || selectedServices.size === 0"
          (click)="startAudit()"
        >
          <span *ngIf="!loading">
            🔍 {{ t('audit.startAudit') }} ({{ selectedServices.size }} {{ t('audit.services') }})
          </span>
          <span *ngIf="loading">
            <span class="spinner"></span>
            {{ t('audit.inProgress') }}...
          </span>
        </button>
      </div>

      <div class="services-grid">
        <div
          class="category-card"
          *ngFor="let category of categories"
        >
          <div class="category-header">
            <span class="category-icon">{{ getCategoryIcon(category) }}</span>
            <span class="category-name">{{ t('categories.' + category) }}</span>
            <label class="category-select-all">
              <input
                type="checkbox"
                [checked]="isCategorySelected(category)"
                (change)="toggleCategory(category)"
              />
              {{ t('common.all') }}
            </label>
          </div>

          <div class="services-list">
            <label
              *ngFor="let service of getServicesForCategory(category)"
              class="service-item"
              [class.selected]="selectedServices.has(service.id)"
            >
              <input
                type="checkbox"
                [checked]="selectedServices.has(service.id)"
                (change)="toggleService(service.id)"
              />
              <div class="service-info">
                <span class="service-name">{{ getServiceName(service) }}</span>
                <span class="service-description">{{ getServiceDescription(service) }}</span>
              </div>
            </label>
          </div>
        </div>
      </div>

      <!-- Progress modal -->
      <div class="modal-overlay" *ngIf="loading">
        <div class="modal-content progress-modal">
          <div class="modal-header">
            <h2>{{ t('audit.inProgress') }}</h2>
            <button class="btn-close" (click)="cancelAudit()" title="{{ t('audit.cancel') }}">✕</button>
          </div>
          <div class="modal-body">
            <div class="progress-section">
              <div class="progress-header">
                <span class="progress-percent">{{ getProgressPercent() }}%</span>
                <span class="progress-label">{{ t('audit.analyzing') }}</span>
              </div>
              <div class="progress-bar-container">
                <div class="progress-bar-fill" [style.width.%]="getProgressPercent()"></div>
              </div>
            </div>

            <div class="current-step" *ngIf="auditSteps[currentStep]">
              <span class="spinner"></span>
              <span>{{ auditSteps[currentStep].label }}...</span>
            </div>

            <button class="details-toggle" (click)="toggleDetails()">
              <span class="toggle-icon">{{ showDetails ? '▼' : '▶' }}</span>
              {{ t('audit.showDetails') }}
            </button>

            <div class="steps-list" *ngIf="showDetails">
              <div
                *ngFor="let step of auditSteps; let i = index"
                class="step-item"
                [class.completed]="step.status === 'completed'"
                [class.in-progress]="step.status === 'in_progress'"
                [class.error]="step.status === 'error'"
              >
                <span class="step-icon">
                  <span *ngIf="step.status === 'pending'">○</span>
                  <span *ngIf="step.status === 'in_progress'" class="spinner small"></span>
                  <span *ngIf="step.status === 'completed'">✓</span>
                  <span *ngIf="step.status === 'error'">✕</span>
                </span>
                <span class="step-label">{{ step.label }}</span>
                <span class="step-details" *ngIf="step.details">{{ step.details }}</span>
              </div>
            </div>

            <div class="modal-actions">
              <button class="btn btn-secondary" (click)="cancelAudit()">
                {{ t('audit.cancel') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .audit-page {
      max-width: 1400px;
      margin: 0 auto;
    }

    .page-header {
      margin-bottom: 24px;

      h1 {
        font-size: 28px;
        font-weight: 700;
        color: #fff;
        margin-bottom: 8px;
      }

      p {
        color: #8d99a8;
      }
    }

    .audit-controls {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      padding: 16px 20px;
      background-color: #1a242f;
      border: 1px solid #414d5c;
      border-radius: 8px;
    }

    .checkbox-item.large {
      font-size: 16px;
      padding: 12px 16px;
    }

    .services-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
      gap: 20px;
    }

    .category-card {
      background-color: #1a242f;
      border: 1px solid #414d5c;
      border-radius: 8px;
      overflow: hidden;
    }

    .category-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 20px;
      background-color: #232f3e;
      border-bottom: 1px solid #414d5c;
    }

    .category-icon {
      font-size: 20px;
    }

    .category-name {
      font-weight: 600;
      color: #fff;
      flex: 1;
    }

    .category-select-all {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: #8d99a8;
      cursor: pointer;
    }

    .services-list {
      padding: 8px;
    }

    .service-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px;
      border-radius: 6px;
      cursor: pointer;
      transition: background-color 0.15s;

      &:hover {
        background-color: #232f3e;
      }

      &.selected {
        background-color: rgba(9, 114, 211, 0.15);
      }

      input[type="checkbox"] {
        margin-top: 4px;
      }
    }

    .service-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .service-name {
      font-weight: 600;
      color: #fff;
      font-size: 14px;
    }

    .service-description {
      font-size: 12px;
      color: #8d99a8;
    }

    /* Modal */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.7);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
    }

    .modal-content {
      background-color: #1a242f;
      border: 1px solid #414d5c;
      border-radius: 12px;
      max-width: 400px;
      width: 90%;
    }

    .modal-header {
      padding: 20px;
      border-bottom: 1px solid #414d5c;

      h2 {
        font-size: 18px;
        font-weight: 600;
        color: #fff;
        margin: 0;
      }
    }

    .modal-body {
      padding: 32px 20px;
    }

    .progress-modal {
      max-width: 500px;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .btn-close {
      background: none;
      border: none;
      color: #8d99a8;
      font-size: 20px;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
      transition: all 0.15s;

      &:hover {
        background-color: rgba(255, 255, 255, 0.1);
        color: #fff;
      }
    }

    .progress-section {
      margin-bottom: 24px;
    }

    .progress-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .progress-percent {
      font-size: 24px;
      font-weight: 700;
      color: #fff;
    }

    .progress-label {
      color: #8d99a8;
      font-size: 14px;
    }

    .progress-bar-container {
      height: 8px;
      background-color: #414d5c;
      border-radius: 4px;
      overflow: hidden;
    }

    .progress-bar-fill {
      height: 100%;
      background-color: #0972d3;
      border-radius: 4px;
      transition: width 0.3s ease;
    }

    .current-step {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      background-color: rgba(9, 114, 211, 0.15);
      border-radius: 8px;
      margin-bottom: 16px;
      color: #fff;
      font-size: 14px;
    }

    .details-toggle {
      display: flex;
      align-items: center;
      gap: 8px;
      background: none;
      border: none;
      color: #8d99a8;
      font-size: 13px;
      cursor: pointer;
      padding: 8px 0;
      width: 100%;
      text-align: left;

      &:hover {
        color: #fff;
      }
    }

    .toggle-icon {
      font-size: 10px;
    }

    .steps-list {
      margin-top: 12px;
      padding: 12px;
      background-color: #232f3e;
      border-radius: 8px;
      max-height: 200px;
      overflow-y: auto;

      &::-webkit-scrollbar {
        width: 6px;
      }

      &::-webkit-scrollbar-track {
        background: #1a242f;
      }

      &::-webkit-scrollbar-thumb {
        background: #414d5c;
        border-radius: 3px;

        &:hover {
          background: #5f6b7a;
        }
      }

      scrollbar-width: thin;
      scrollbar-color: #414d5c #1a242f;
    }

    .step-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 0;
      font-size: 13px;
      color: #8d99a8;
      border-bottom: 1px solid #414d5c;

      &:last-child {
        border-bottom: none;
      }

      &.completed {
        color: #1d8102;

        .step-icon {
          color: #1d8102;
        }
      }

      &.in-progress {
        color: #0972d3;
      }

      &.error {
        color: #d13212;

        .step-icon {
          color: #d13212;
        }
      }
    }

    .step-icon {
      width: 20px;
      text-align: center;
    }

    .spinner.small {
      width: 14px;
      height: 14px;
      border-width: 2px;
    }

    .step-label {
      flex: 1;
    }

    .step-details {
      font-size: 11px;
      color: #d13212;
    }

    .modal-actions {
      margin-top: 20px;
      display: flex;
      justify-content: center;
    }
  `]
})
export class AuditComponent implements OnInit, OnDestroy {
  services: AWSServiceModel[] = [];
  selectedServices = new Set<string>();
  selectAll = false;
  loading = false;
  showDetails = false;
  currentStep = 0;
  private auditSubscription?: Subscription;

  auditSteps: AuditStep[] = [];

  categories: ServiceCategory[] = [
    'cost', 'compute', 'storage', 'database', 'network',
    'security', 'analytics', 'integration', 'management',
    'containers', 'ai-ml', 'developer-tools', 'iot', 'media',
    'game', 'business', 'migration', 'blockchain', 'frontend-web',
    'end-user-computing', 'customer-engagement'
  ];

  constructor(
    private awsService: AwsApiService,
    private router: Router,
    private i18nService: I18nService
  ) {}

  ngOnInit(): void {
    this.awsService.services$.subscribe(services => {
      this.services = services;
      // Pré-sélectionner les services de coûts
      this.toggleCategory('cost');
    });
  }

  getCategoryLabel(category: ServiceCategory): string {
    return this.t('categories.' + category);
  }

  getCategoryIcon(category: ServiceCategory): string {
    return CATEGORY_ICONS[category] || '📁';
  }

  getServiceName(service: AWSServiceModel): string {
    const translated = this.i18nService.t('services.' + service.id);
    // If translation returns the key, use the service name from backend
    return translated !== 'services.' + service.id ? translated : service.name;
  }

  getServiceDescription(service: AWSServiceModel): string {
    const translated = this.i18nService.t('serviceDescriptions.' + service.id);
    // If translation returns the key, use the description from backend
    return translated !== 'serviceDescriptions.' + service.id ? translated : service.description;
  }

  getServicesForCategory(category: ServiceCategory): AWSServiceModel[] {
    return this.services.filter(s => s.category === category);
  }

  isCategorySelected(category: ServiceCategory): boolean {
    const categoryServices = this.getServicesForCategory(category);
    return categoryServices.length > 0 &&
      categoryServices.every(s => this.selectedServices.has(s.id));
  }

  toggleCategory(category: ServiceCategory): void {
    const categoryServices = this.getServicesForCategory(category);
    const allSelected = this.isCategorySelected(category);

    categoryServices.forEach(service => {
      if (allSelected) {
        this.selectedServices.delete(service.id);
      } else {
        this.selectedServices.add(service.id);
      }
    });

    this.updateSelectAll();
  }

  toggleService(serviceId: string): void {
    if (this.selectedServices.has(serviceId)) {
      this.selectedServices.delete(serviceId);
    } else {
      this.selectedServices.add(serviceId);
    }
    this.updateSelectAll();
  }

  toggleSelectAll(): void {
    if (this.selectAll) {
      this.services.forEach(s => this.selectedServices.add(s.id));
    } else {
      this.selectedServices.clear();
    }
  }

  updateSelectAll(): void {
    this.selectAll = this.services.length > 0 &&
      this.services.every(s => this.selectedServices.has(s.id));
  }

  ngOnDestroy(): void {
    this.cancelAudit();
  }

  t(key: string): string {
    return this.i18nService.t(key);
  }

  initAuditSteps(): void {
    const selectedCats = this.categories.filter(cat =>
      this.getServicesForCategory(cat).some(s => this.selectedServices.has(s.id))
    );

    this.auditSteps = [
      { id: 'init', label: this.t('audit.steps.init'), status: 'pending' },
      ...selectedCats.map(cat => ({
        id: cat,
        label: this.getCategoryLabel(cat),
        status: 'pending' as const
      })),
      { id: 'finalize', label: this.t('audit.steps.finalize'), status: 'pending' }
    ];
    this.currentStep = 0;
  }

  /**
   * Met à jour la progression basée sur les événements réels du backend
   */
  updateProgress(step: string, status: 'start' | 'complete' | 'error'): void {
    const stepIndex = this.auditSteps.findIndex(s => s.id === step);
    if (stepIndex === -1) return;

    if (status === 'start') {
      // Marquer toutes les étapes précédentes comme complétées
      for (let i = 0; i < stepIndex; i++) {
        if (this.auditSteps[i].status !== 'completed') {
          this.auditSteps[i].status = 'completed';
        }
      }
      this.auditSteps[stepIndex].status = 'in_progress';
      this.currentStep = stepIndex;
    } else if (status === 'complete') {
      this.auditSteps[stepIndex].status = 'completed';
      this.currentStep = stepIndex + 1;
    } else if (status === 'error') {
      this.auditSteps[stepIndex].status = 'error';
    }
  }

  toggleDetails(): void {
    this.showDetails = !this.showDetails;
  }

  cancelAudit(): void {
    if (this.auditSubscription) {
      this.auditSubscription.unsubscribe();
      this.auditSubscription = undefined;
    }
    this.loading = false;
    this.auditSteps.forEach(step => {
      if (step.status === 'in_progress') {
        step.status = 'error';
      }
    });
  }

  getProgressPercent(): number {
    if (this.auditSteps.length === 0) return 0;
    const completed = this.auditSteps.filter(s => s.status === 'completed').length;
    return Math.round((completed / this.auditSteps.length) * 100);
  }

  startAudit(): void {
    const services = Array.from(this.selectedServices);
    this.loading = true;
    this.initAuditSteps();

    // Utiliser le streaming SSE pour la progression en temps réel
    this.auditSubscription = this.awsService.runAuditWithProgress(
      { services },
      (step, status) => {
        this.updateProgress(step, status);
      }
    ).pipe(
      finalize(() => {
        this.loading = false;
      })
    ).subscribe({
      next: (results) => {
        this.auditSteps.forEach(step => step.status = 'completed');
        setTimeout(() => {
          this.router.navigate(['/dashboard']);
        }, 500);
      },
      error: (err) => {
        console.error('Audit error:', err);
        const currentInProgress = this.auditSteps.find(s => s.status === 'in_progress');
        if (currentInProgress) {
          currentInProgress.status = 'error';
          currentInProgress.details = err.message;
        }
        alert(this.t('audit.error') + ': ' + err.message);
      }
    });
  }
}
