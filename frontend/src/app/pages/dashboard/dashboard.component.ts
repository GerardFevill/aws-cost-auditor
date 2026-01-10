/**
 * Dashboard - Vue d'ensemble des coûts et résultats d'audit
 */

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AwsApiService } from '../../services/aws.service';
import { I18nService } from '../../services/i18n.service';
import {
  CATEGORY_ICONS,
  ServiceCategory,
  AuditIssue
} from '../../models/aws.models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="dashboard">
      <div class="page-header">
        <h1>{{ t('dashboard.title') }}</h1>
        <p>{{ t('dashboard.subtitle') }}</p>
      </div>

      <div class="alert alert-warning" *ngIf="!auditResults">
        {{ t('dashboard.noAudit') }}
        <a routerLink="/audit">{{ t('dashboard.runAudit') }}</a>
      </div>

      <ng-container *ngIf="auditResults">
        <!-- Cost Summary Cards -->
        <div class="grid grid-4" *ngIf="costData">
          <div class="dashboard-card cost-card">
            <div class="cost-label">{{ t('dashboard.currentMonthCost') }}</div>
            <div class="cost-value">
              {{ formatCurrency(costData.summary?.currentMonthCost) }}
              <span class="cost-currency">USD</span>
            </div>
          </div>

          <div class="dashboard-card cost-card">
            <div class="cost-label">{{ t('dashboard.forecastCost') }}</div>
            <div class="cost-value">
              {{ formatCurrency(costData.summary?.forecastedCost) }}
              <span class="cost-currency">USD</span>
            </div>
          </div>

          <div class="dashboard-card cost-card">
            <div class="cost-label">{{ t('dashboard.last12MonthsTotal') }}</div>
            <div class="cost-value">
              {{ formatCurrency(costData.summary?.totalLast12Months) }}
              <span class="cost-currency">USD</span>
            </div>
          </div>

          <div class="dashboard-card cost-card issues-card">
            <div class="cost-label">{{ t('dashboard.issuesDetected') }}</div>
            <div class="cost-value">{{ totalIssues }}</div>
            <div class="issues-breakdown">
              <span class="severity-high">{{ issuesBySeverity['HIGH'] || 0 }} {{ t('dashboard.criticalIssues') }}</span>
              <span class="severity-medium">{{ issuesBySeverity['MEDIUM'] || 0 }} {{ t('dashboard.mediumIssues') }}</span>
            </div>
          </div>
        </div>

        <!-- Cost by Service Chart -->
        <div class="grid grid-2">
          <div class="dashboard-card">
            <div class="card-header">
              <h2 class="card-title">{{ t('dashboard.costByService') }}</h2>
            </div>
            <div class="services-cost-list">
              <div
                class="service-cost-item"
                *ngFor="let service of topServicesCost"
              >
                <div class="service-cost-info">
                  <span class="service-name">{{ service.service }}</span>
                  <span class="service-cost">{{ formatCurrency(service.cost) }} USD</span>
                </div>
                <div class="service-cost-bar">
                  <div
                    class="service-cost-fill"
                    [style.width.%]="getServiceCostPercentage(service.cost)"
                  ></div>
                </div>
              </div>
            </div>
          </div>

          <div class="dashboard-card">
            <div class="card-header">
              <h2 class="card-title">{{ t('dashboard.monthlyTrend') }}</h2>
            </div>
            <div class="monthly-costs-chart">
              <div
                class="month-bar"
                *ngFor="let month of monthlyCosts"
                [style.height.%]="getMonthCostPercentage(month.cost)"
              >
                <span class="month-value">{{ formatCurrency(month.cost) }}</span>
                <span class="month-label">{{ getMonthLabel(month.periodStart) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Issues List -->
        <div class="dashboard-card" *ngIf="allIssues.length > 0">
          <div class="card-header">
            <h2 class="card-title">{{ t('dashboard.issuesAndRecommendations') }}</h2>
            <span class="badge badge-warning">{{ allIssues.length }} {{ t('dashboard.issues') }}</span>
          </div>
          <table class="data-table">
            <thead>
              <tr>
                <th>{{ t('dashboard.severity') }}</th>
                <th>{{ t('dashboard.type') }}</th>
                <th>{{ t('dashboard.message') }}</th>
                <th>{{ t('dashboard.potentialSavings') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let issue of allIssues.slice(0, 10)">
                <td>
                  <span class="badge" [ngClass]="getSeverityClass(issue.severity)">
                    {{ issue.severity }}
                  </span>
                </td>
                <td>{{ issue.type }}</td>
                <td>{{ issue.message }}</td>
                <td>
                  <span *ngIf="issue.potentialSavings">
                    {{ formatCurrency(issue.potentialSavings) }} USD{{ t('common.perMonth') }}
                  </span>
                  <span *ngIf="!issue.potentialSavings">-</span>
                </td>
              </tr>
            </tbody>
          </table>
          <div class="card-footer" *ngIf="allIssues.length > 10">
            <a routerLink="/results">{{ t('dashboard.viewAllIssues') }} ({{ allIssues.length }})</a>
          </div>
        </div>

        <!-- Resource Summary -->
        <div class="dashboard-card" *ngIf="resourceStats.length > 0">
          <div class="card-header">
            <h2 class="card-title">{{ t('dashboard.resourceSummary') }}</h2>
          </div>
          <div class="resources-grid">
            <div class="resource-stat" *ngFor="let stat of resourceStats">
              <span class="resource-icon">{{ stat.icon }}</span>
              <div class="resource-info">
                <span class="resource-value">{{ stat.value }}</span>
                <span class="resource-label">{{ stat.label }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Categories Audited -->
        <div class="dashboard-card">
          <div class="card-header">
            <h2 class="card-title">{{ t('dashboard.categoriesAudited') }}</h2>
            <span class="badge badge-info">{{ auditedCategories.length }} {{ t('common.categories') }}</span>
          </div>
          <div class="categories-grid">
            <a
              *ngFor="let cat of auditedCategories"
              class="category-item"
              [routerLink]="['/results', cat.id]"
            >
              <span class="category-icon">{{ cat.icon }}</span>
              <span class="category-name">{{ t('categories.' + cat.id) }}</span>
              <span class="category-status" [class.has-issues]="cat.issueCount > 0">
                {{ cat.issueCount > 0 ? cat.issueCount + ' ' + t('dashboard.issues') : '✓' }}
              </span>
            </a>
          </div>
        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    .dashboard {
      max-width: 1400px;
      margin: 0 auto;
    }

    .page-header {
      margin-bottom: 24px;

      h1 {
        font-size: 28px;
        font-weight: 700;
        color: var(--color-text-primary);
        margin-bottom: 8px;
      }

      p {
        color: var(--color-text-muted);
      }
    }

    .cost-card {
      text-align: center;
      padding: 24px;

      .cost-label {
        font-size: 13px;
        color: var(--color-text-muted);
        margin-bottom: 8px;
      }

      .cost-value {
        font-size: 28px;
        font-weight: 700;
        color: var(--color-text-primary);
      }

      .cost-currency {
        font-size: 14px;
        color: var(--color-text-muted);
      }
    }

    .issues-card {
      .issues-breakdown {
        display: flex;
        justify-content: center;
        gap: 12px;
        margin-top: 8px;
        font-size: 12px;
      }
    }

    .services-cost-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .service-cost-item {
      .service-cost-info {
        display: flex;
        justify-content: space-between;
        margin-bottom: 4px;
      }

      .service-name {
        font-size: 13px;
        color: var(--color-text-secondary);
      }

      .service-cost {
        font-size: 13px;
        font-weight: 600;
        color: var(--color-text-primary);
      }

      .service-cost-bar {
        height: 8px;
        background-color: var(--color-border);
        border-radius: 4px;
        overflow: hidden;

        .service-cost-fill {
          height: 100%;
          background: linear-gradient(90deg, #0972d3, #44b9d6);
          border-radius: 4px;
        }
      }
    }

    .monthly-costs-chart {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      height: 200px;
      padding-top: 20px;
    }

    .month-bar {
      flex: 1;
      max-width: 60px;
      background: linear-gradient(180deg, #0972d3, #44b9d6);
      border-radius: 4px 4px 0 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-end;
      position: relative;
      min-height: 20px;

      .month-value {
        position: absolute;
        top: -20px;
        font-size: 10px;
        color: var(--color-text-muted);
        white-space: nowrap;
      }

      .month-label {
        position: absolute;
        bottom: -20px;
        font-size: 10px;
        color: var(--color-text-muted);
      }
    }

    .resources-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 16px;
    }

    .resource-stat {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      background-color: var(--color-bg-tertiary);
      border-radius: 8px;

      .resource-icon {
        font-size: 24px;
      }

      .resource-info {
        display: flex;
        flex-direction: column;
      }

      .resource-value {
        font-size: 20px;
        font-weight: 700;
        color: var(--color-text-primary);
      }

      .resource-label {
        font-size: 12px;
        color: var(--color-text-muted);
      }
    }

    .card-footer {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid var(--color-border);
      text-align: center;

      a {
        color: var(--color-accent);
        text-decoration: none;

        &:hover {
          text-decoration: underline;
        }
      }
    }

    .categories-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 12px;
    }

    .category-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px;
      background-color: var(--color-bg-tertiary);
      border-radius: 8px;
      text-decoration: none;
      transition: all 0.15s;

      &:hover {
        background-color: var(--color-bg-hover);
        transform: translateY(-2px);
      }

      .category-icon {
        font-size: 20px;
      }

      .category-name {
        flex: 1;
        font-size: 13px;
        color: var(--color-text-primary);
        font-weight: 500;
      }

      .category-status {
        font-size: 11px;
        color: var(--color-success);
        font-weight: 600;

        &.has-issues {
          color: var(--color-warning);
        }
      }
    }
  `]
})
export class DashboardComponent implements OnInit {
  auditResults: any = null;
  costData: any = null;
  topServicesCost: any[] = [];
  monthlyCosts: any[] = [];
  allIssues: AuditIssue[] = [];
  totalIssues = 0;
  issuesBySeverity: Record<string, number> = {};
  resourceStats: any[] = [];
  auditedCategories: { id: string; label: string; icon: string; issueCount: number }[] = [];
  maxServiceCost = 0;
  maxMonthlyCost = 0;

  constructor(
    private awsService: AwsApiService,
    private i18nService: I18nService
  ) {}

  ngOnInit(): void {
    this.awsService.auditResults$.subscribe(results => {
      console.log('Dashboard received results:', results);
      if (results) {
        this.auditResults = results.results;
        console.log('Categories in results:', Object.keys(this.auditResults || {}));
        this.processResults();
      }
    });

    // Re-process when language changes
    this.i18nService.lang$.subscribe(() => {
      if (this.auditResults) {
        this.buildResourceStats();
        this.buildAuditedCategories();
      }
    });
  }

  t(key: string): string {
    return this.i18nService.t(key);
  }

  processResults(): void {
    if (!this.auditResults) return;

    // Données de coûts
    this.costData = this.auditResults.cost?.data || {};
    this.topServicesCost = (this.costData.costsByService || []).slice(0, 8);
    this.monthlyCosts = (this.costData.monthlyCosts || []).slice(-6);

    this.maxServiceCost = Math.max(...this.topServicesCost.map(s => s.cost), 1);
    this.maxMonthlyCost = Math.max(...this.monthlyCosts.map(m => m.cost), 1);

    // Collecter tous les problèmes
    this.allIssues = [];
    this.collectIssues(this.auditResults);

    // Compter par sévérité
    this.issuesBySeverity = {};
    this.allIssues.forEach(issue => {
      this.issuesBySeverity[issue.severity] =
        (this.issuesBySeverity[issue.severity] || 0) + 1;
    });
    this.totalIssues = this.allIssues.length;

    // Trier par sévérité
    const severityOrder = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
    this.allIssues.sort((a, b) =>
      severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity)
    );

    // Stats ressources
    this.buildResourceStats();

    // Catégories auditées
    this.buildAuditedCategories();
  }

  buildAuditedCategories(): void {
    this.auditedCategories = [];

    const categoryKeys = Object.keys(this.auditResults || {});
    for (const key of categoryKeys) {
      const catData = this.auditResults[key];
      if (catData && typeof catData === 'object') {
        // Compter les issues pour cette catégorie
        let issueCount = 0;
        this.countCategoryIssues(catData, (count: number) => issueCount += count);

        this.auditedCategories.push({
          id: key,
          label: this.t('categories.' + key),
          icon: CATEGORY_ICONS[key as ServiceCategory] || '📁',
          issueCount
        });
      }
    }
  }

  private countCategoryIssues(obj: any, callback: (count: number) => void): void {
    if (!obj) return;
    if (Array.isArray(obj.issues)) {
      callback(obj.issues.length);
    }
    if (typeof obj === 'object') {
      Object.values(obj).forEach(value => {
        if (typeof value === 'object') {
          this.countCategoryIssues(value, callback);
        }
      });
    }
  }

  collectIssues(obj: any): void {
    if (!obj) return;

    if (Array.isArray(obj.issues)) {
      this.allIssues.push(...obj.issues);
    }

    if (typeof obj === 'object') {
      Object.values(obj).forEach(value => {
        if (typeof value === 'object') {
          this.collectIssues(value);
        }
      });
    }
  }

  buildResourceStats(): void {
    this.resourceStats = [];

    // Configuration des stats par catégorie avec clés i18n
    const statConfigs = [
      // Compute
      { path: 'compute.data.ec2.summary.totalInstances', icon: '🖥️', labelKey: 'dashboard.ec2Instances' },
      { path: 'compute.data.ec2.summary.totalVolumes', icon: '💾', labelKey: 'dashboard.ebsVolumes' },
      { path: 'compute.data.lambda.summary.totalFunctions', icon: 'λ', labelKey: 'dashboard.lambdaFunctions' },
      { path: 'compute.data.ecs.summary.totalClusters', icon: '📦', labelKey: 'dashboard.ecsClusters' },
      { path: 'compute.data.eks.summary.totalClusters', icon: '☸️', labelKey: 'dashboard.eksClusters' },
      // Storage
      { path: 'storage.data.s3.summary.totalBuckets', icon: '🪣', labelKey: 'dashboard.s3Buckets' },
      { path: 'storage.data.efs.summary.totalFileSystems', icon: '📁', labelKey: 'dashboard.efsFileSystems' },
      // Database
      { path: 'database.data.rds.summary.totalInstances', icon: '🗄️', labelKey: 'dashboard.rdsInstances' },
      { path: 'database.data.dynamodb.summary.totalTables', icon: '📋', labelKey: 'dashboard.dynamodbTables' },
      { path: 'database.data.elasticache.summary.totalClusters', icon: '⚡', labelKey: 'dashboard.elasticacheNodes' },
      // Network
      { path: 'network.data.vpc.summary.totalVpcs', icon: '🌐', labelKey: 'common.vpcs' },
      { path: 'network.data.elb.summary.totalLoadBalancers', icon: '⚖️', labelKey: 'dashboard.loadBalancers' },
      { path: 'network.data.cloudfront.summary.totalDistributions', icon: '🌍', labelKey: 'dashboard.cloudFrontDistributions' },
      // Security
      { path: 'security.data.iam.summary.totalUsers', icon: '👤', labelKey: 'dashboard.iamUsers' },
      { path: 'security.data.iam.summary.totalRoles', icon: '🎭', labelKey: 'dashboard.iamRoles' },
      { path: 'security.data.kms.summary.totalKeys', icon: '🔑', labelKey: 'dashboard.kmsKeys' },
      // Analytics
      { path: 'analytics.data.glue.summary.totalJobs', icon: '🔧', labelKey: 'dashboard.glueJobs' },
      { path: 'analytics.data.kinesis.summary.totalStreams', icon: '🌊', labelKey: 'dashboard.kinesisStreams' },
      // Integration
      { path: 'integration.data.sqs.summary.totalQueues', icon: '📬', labelKey: 'dashboard.sqsQueues' },
      { path: 'integration.data.sns.summary.totalTopics', icon: '📢', labelKey: 'dashboard.snsTopics' },
      // Management
      { path: 'management.data.cloudwatch.summary.totalAlarms', icon: '🔔', labelKey: 'dashboard.cloudwatchAlarms' },
      // Containers
      { path: 'containers.data.ecr.summary.totalRepositories', icon: '🐳', labelKey: 'dashboard.ecrRepositories' },
      // AI/ML
      { path: 'ai-ml.data.sagemaker.summary.totalEndpoints', icon: '🤖', labelKey: 'dashboard.sagemakerEndpoints' },
      // Developer Tools
      { path: 'developer-tools.data.codecommit.summary.totalRepositories', icon: '📝', labelKey: 'common.repositories' },
      { path: 'developer-tools.data.codepipeline.summary.totalPipelines', icon: '🔄', labelKey: 'common.pipelines' },
      // IoT
      { path: 'iot.data.iotcore.summary.totalThings', icon: '📡', labelKey: 'common.devices' },
      // Business
      { path: 'business.data.workspaces.summary.totalWorkspaces', icon: '💼', labelKey: 'services.workspaces' },
      { path: 'business.data.ses.summary.totalIdentities', icon: '✉️', labelKey: 'common.identities' },
    ];

    // Parcourir toutes les configs et ajouter les stats qui existent
    for (const config of statConfigs) {
      const value = this.getNestedValue(this.auditResults, config.path);
      if (value !== undefined && value !== null && value > 0) {
        this.resourceStats.push({
          icon: config.icon,
          value: value,
          label: this.t(config.labelKey)
        });
      }
    }

    // Limiter à 12 stats max pour ne pas surcharger le dashboard
    this.resourceStats = this.resourceStats.slice(0, 12);
  }

  /**
   * Récupère une valeur nested dans un objet via un chemin (ex: 'compute.data.ec2.summary')
   */
  private getNestedValue(obj: any, path: string): any {
    const keys = path.split('.');
    let result = obj;
    for (const key of keys) {
      if (result && typeof result === 'object' && key in result) {
        result = result[key];
      } else {
        return undefined;
      }
    }
    return result;
  }

  formatCurrency(value: number | undefined): string {
    if (value === undefined || value === null) return '0.00';
    return value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  getServiceCostPercentage(cost: number): number {
    return (cost / this.maxServiceCost) * 100;
  }

  getMonthCostPercentage(cost: number): number {
    return Math.max((cost / this.maxMonthlyCost) * 100, 5);
  }

  getMonthLabel(dateStr: string): string {
    const date = new Date(dateStr);
    const lang = this.i18nService.getLanguage();
    return date.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { month: 'short' });
  }

  getSeverityClass(severity: string): string {
    switch (severity) {
      case 'CRITICAL':
      case 'HIGH':
        return 'badge-danger';
      case 'MEDIUM':
        return 'badge-warning';
      case 'LOW':
        return 'badge-info';
      default:
        return 'badge-info';
    }
  }
}
