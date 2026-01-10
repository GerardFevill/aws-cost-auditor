/**
 * Page de résultats détaillés par catégorie
 */

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { AwsApiService } from '../../services/aws.service';
import { I18nService } from '../../services/i18n.service';
import {
  CATEGORY_ICONS,
  ServiceCategory,
  AuditIssue
} from '../../models/aws.models';

@Component({
  selector: 'app-results',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="results-page">
      <div class="page-header">
        <h1>
          <span class="category-icon">{{ getCategoryIcon(category) }}</span>
          {{ t('categories.' + category) }}
        </h1>
        <p>{{ t('results.detailedResults') }}</p>
      </div>

      <div class="alert alert-warning" *ngIf="!categoryData">
        {{ t('results.noData') }}
        <a routerLink="/audit">{{ t('dashboard.runAudit') }}</a>
      </div>

      <ng-container *ngIf="categoryData">
        <!-- Issues for this category -->
        <div class="dashboard-card" *ngIf="issues.length > 0">
          <div class="card-header">
            <h2 class="card-title">{{ t('results.issuesDetected') }}</h2>
            <span class="badge badge-warning">{{ issues.length }}</span>
          </div>
          <div class="issues-list">
            <div
              class="issue-item"
              *ngFor="let issue of issues"
              [class]="'issue-' + issue.severity.toLowerCase()"
            >
              <div class="issue-header">
                <span class="badge" [ngClass]="getSeverityClass(issue.severity)">
                  {{ issue.severity }}
                </span>
                <span class="issue-type">{{ issue.type }}</span>
                <span class="issue-savings" *ngIf="issue.potentialSavings">
                  💰 {{ formatCurrency(issue.potentialSavings) }} USD{{ t('common.perMonth') }}
                </span>
              </div>
              <p class="issue-message">{{ issue.message }}</p>
              <p class="issue-recommendation" *ngIf="issue.recommendation">
                <strong>{{ t('results.recommendation') }}:</strong> {{ issue.recommendation }}
              </p>
              <div class="issue-resources" *ngIf="issue.resources.length > 0">
                <span class="resources-label">{{ t('results.affectedResources') }}:</span>
                <div class="resources-list">
                  <code *ngFor="let resource of issue.resources.slice(0, 5)">{{ resource }}</code>
                  <span *ngIf="issue.resources.length > 5">
                    {{ t('results.andMore', { count: issue.resources.length - 5 }) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Data tables based on category -->
        <ng-container [ngSwitch]="category">
          <!-- Compute -->
          <ng-container *ngSwitchCase="'compute'">
            <div class="dashboard-card" *ngIf="categoryData.ec2?.instances?.length">
              <div class="card-header">
                <h2 class="card-title">{{ t('dashboard.ec2Instances') }}</h2>
                <span class="badge badge-info">{{ categoryData.ec2.instances.length }}</span>
              </div>
              <table class="data-table">
                <thead>
                  <tr>
                    <th>{{ t('results.instanceId') }}</th>
                    <th>{{ t('results.name') }}</th>
                    <th>{{ t('results.instanceType') }}</th>
                    <th>{{ t('results.state') }}</th>
                    <th>{{ t('results.region') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let instance of categoryData.ec2.instances">
                    <td><code>{{ instance.instanceId }}</code></td>
                    <td>{{ instance.name || '-' }}</td>
                    <td>{{ instance.type }}</td>
                    <td>
                      <span class="badge" [ngClass]="instance.state === 'running' ? 'badge-success' : 'badge-warning'">
                        {{ instance.state }}
                      </span>
                    </td>
                    <td>{{ instance.region }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="dashboard-card" *ngIf="categoryData.ec2?.volumes?.length">
              <div class="card-header">
                <h2 class="card-title">{{ t('dashboard.ebsVolumes') }}</h2>
                <span class="badge badge-info">{{ categoryData.ec2.volumes.length }}</span>
              </div>
              <table class="data-table">
                <thead>
                  <tr>
                    <th>{{ t('results.volumeId') }}</th>
                    <th>{{ t('results.size') }}</th>
                    <th>{{ t('results.volumeType') }}</th>
                    <th>{{ t('results.attached') }}</th>
                    <th>{{ t('results.region') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let volume of categoryData.ec2.volumes">
                    <td><code>{{ volume.volumeId }}</code></td>
                    <td>{{ volume.size }} GB</td>
                    <td>{{ volume.type }}</td>
                    <td>
                      <span class="badge" [ngClass]="volume.attached ? 'badge-success' : 'badge-danger'">
                        {{ volume.attached ? t('common.yes') : t('common.no') }}
                      </span>
                    </td>
                    <td>{{ volume.region }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="dashboard-card" *ngIf="categoryData.lambda?.functions?.length">
              <div class="card-header">
                <h2 class="card-title">{{ t('dashboard.lambdaFunctions') }}</h2>
                <span class="badge badge-info">{{ categoryData.lambda.functions.length }}</span>
              </div>
              <table class="data-table">
                <thead>
                  <tr>
                    <th>{{ t('results.functionName') }}</th>
                    <th>{{ t('results.runtime') }}</th>
                    <th>{{ t('results.memory') }}</th>
                    <th>{{ t('results.timeout') }}</th>
                    <th>{{ t('results.region') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let fn of categoryData.lambda.functions">
                    <td>{{ fn.functionName }}</td>
                    <td>{{ fn.runtime }}</td>
                    <td>{{ fn.memorySize }} MB</td>
                    <td>{{ fn.timeout }}s</td>
                    <td>{{ fn.region }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </ng-container>

          <!-- Storage -->
          <ng-container *ngSwitchCase="'storage'">
            <div class="dashboard-card" *ngIf="categoryData.s3?.buckets?.length">
              <div class="card-header">
                <h2 class="card-title">{{ t('dashboard.s3Buckets') }}</h2>
                <span class="badge badge-info">{{ categoryData.s3.buckets.length }}</span>
              </div>
              <table class="data-table">
                <thead>
                  <tr>
                    <th>{{ t('results.bucketName') }}</th>
                    <th>{{ t('results.region') }}</th>
                    <th>{{ t('results.size') }}</th>
                    <th>{{ t('results.objectCount') }}</th>
                    <th>{{ t('results.encrypted') }}</th>
                    <th>{{ t('results.public') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let bucket of categoryData.s3.buckets">
                    <td>{{ bucket.name }}</td>
                    <td>{{ bucket.region }}</td>
                    <td>{{ formatSize(bucket.sizeBytes) }}</td>
                    <td>{{ bucket.objectCount | number }}</td>
                    <td>
                      <span class="badge" [ngClass]="bucket.encryptionEnabled ? 'badge-success' : 'badge-warning'">
                        {{ bucket.encryptionEnabled ? t('common.yes') : t('common.no') }}
                      </span>
                    </td>
                    <td>
                      <span class="badge" [ngClass]="bucket.publicAccessPossible ? 'badge-danger' : 'badge-success'">
                        {{ bucket.publicAccessPossible ? t('results.possible') : t('common.no') }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </ng-container>

          <!-- Database -->
          <ng-container *ngSwitchCase="'database'">
            <div class="dashboard-card" *ngIf="categoryData.rds?.instances?.length">
              <div class="card-header">
                <h2 class="card-title">{{ t('dashboard.rdsInstances') }}</h2>
                <span class="badge badge-info">{{ categoryData.rds.instances.length }}</span>
              </div>
              <table class="data-table">
                <thead>
                  <tr>
                    <th>{{ t('results.identifier') }}</th>
                    <th>{{ t('results.engine') }}</th>
                    <th>{{ t('results.dbClass') }}</th>
                    <th>{{ t('results.multiAZ') }}</th>
                    <th>{{ t('results.storage') }}</th>
                    <th>{{ t('results.region') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let db of categoryData.rds.instances">
                    <td>{{ db.dbInstanceId }}</td>
                    <td>{{ db.engine }} {{ db.engineVersion }}</td>
                    <td>{{ db.dbInstanceClass }}</td>
                    <td>
                      <span class="badge" [ngClass]="db.multiAZ ? 'badge-success' : 'badge-warning'">
                        {{ db.multiAZ ? t('common.yes') : t('common.no') }}
                      </span>
                    </td>
                    <td>{{ db.allocatedStorage }} GB</td>
                    <td>{{ db.region }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="dashboard-card" *ngIf="categoryData.dynamodb?.tables?.length">
              <div class="card-header">
                <h2 class="card-title">{{ t('dashboard.dynamodbTables') }}</h2>
                <span class="badge badge-info">{{ categoryData.dynamodb.tables.length }}</span>
              </div>
              <table class="data-table">
                <thead>
                  <tr>
                    <th>{{ t('results.tableName') }}</th>
                    <th>{{ t('results.billingMode') }}</th>
                    <th>{{ t('results.items') }}</th>
                    <th>{{ t('results.size') }}</th>
                    <th>{{ t('results.region') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let table of categoryData.dynamodb.tables">
                    <td>{{ table.tableName }}</td>
                    <td>{{ table.billingMode }}</td>
                    <td>{{ table.itemCount | number }}</td>
                    <td>{{ formatSize(table.sizeBytes) }}</td>
                    <td>{{ table.region }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </ng-container>

          <!-- Security -->
          <ng-container *ngSwitchCase="'security'">
            <div class="dashboard-card" *ngIf="categoryData.iam?.users?.length">
              <div class="card-header">
                <h2 class="card-title">{{ t('dashboard.iamUsers') }}</h2>
                <span class="badge badge-info">{{ categoryData.iam.users.length }}</span>
              </div>
              <table class="data-table">
                <thead>
                  <tr>
                    <th>{{ t('results.userName') }}</th>
                    <th>{{ t('results.createdAt') }}</th>
                    <th>{{ t('results.lastLogin') }}</th>
                    <th>{{ t('results.accessKeys') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let user of categoryData.iam.users">
                    <td>{{ user.userName }}</td>
                    <td>{{ formatDate(user.createDate) }}</td>
                    <td>{{ formatDate(user.passwordLastUsed) || t('common.never') }}</td>
                    <td>{{ user.accessKeys?.length || 0 }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </ng-container>

          <!-- Default: Dynamic tables for any data -->
          <ng-container *ngSwitchDefault>
            <ng-container *ngFor="let section of getDataSections()">
              <div class="dashboard-card">
                <div class="card-header">
                  <h2 class="card-title">{{ formatSectionTitle(section.key) }}</h2>
                  <span class="badge badge-info" *ngIf="isArray(section.value)">
                    {{ section.value.length }}
                  </span>
                </div>

                <!-- Array of objects: Table -->
                <ng-container *ngIf="isArray(section.value) && section.value.length > 0">
                  <div class="table-container">
                    <table class="data-table">
                      <thead>
                        <tr>
                          <th *ngFor="let col of getObjectKeys(section.value[0])">
                            {{ formatColumnHeader(col) }}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr *ngFor="let item of section.value">
                          <td *ngFor="let col of getObjectKeys(section.value[0])">
                            <ng-container [ngSwitch]="getValueType(item[col])">
                              <span *ngSwitchCase="'boolean'" class="badge" [ngClass]="item[col] ? 'badge-success' : 'badge-warning'">
                                {{ item[col] ? t('common.yes') : t('common.no') }}
                              </span>
                              <code *ngSwitchCase="'id'">{{ item[col] }}</code>
                              <span *ngSwitchCase="'number'">{{ formatNumber(item[col]) }}</span>
                              <span *ngSwitchCase="'date'">{{ formatDate(item[col]) }}</span>
                              <span *ngSwitchCase="'array'" class="badge badge-info">{{ item[col]?.length || 0 }} {{ t('common.items') }}</span>
                              <span *ngSwitchCase="'object'" class="text-muted">[{{ t('common.object') }}]</span>
                              <span *ngSwitchDefault>{{ item[col] ?? '-' }}</span>
                            </ng-container>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </ng-container>

                <!-- Single object: Key-value table -->
                <ng-container *ngIf="isObject(section.value) && !isArray(section.value)">
                  <table class="data-table key-value-table">
                    <tbody>
                      <tr *ngFor="let prop of getObjectEntries(section.value)">
                        <th>{{ formatColumnHeader(prop.key) }}</th>
                        <td>
                          <ng-container [ngSwitch]="getValueType(prop.value)">
                            <span *ngSwitchCase="'boolean'" class="badge" [ngClass]="prop.value ? 'badge-success' : 'badge-warning'">
                              {{ prop.value ? t('common.yes') : t('common.no') }}
                            </span>
                            <code *ngSwitchCase="'id'">{{ prop.value }}</code>
                            <span *ngSwitchCase="'number'">{{ formatNumber(prop.value) }}</span>
                            <span *ngSwitchCase="'date'">{{ formatDate(prop.value) }}</span>
                            <span *ngSwitchCase="'array'" class="badge badge-info">{{ prop.value?.length || 0 }} {{ t('common.items') }}</span>
                            <pre *ngSwitchCase="'object'" class="nested-json">{{ prop.value | json }}</pre>
                            <span *ngSwitchDefault>{{ prop.value ?? '-' }}</span>
                          </ng-container>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </ng-container>

                <!-- Primitive value -->
                <ng-container *ngIf="!isObject(section.value) && !isArray(section.value)">
                  <div class="primitive-value">{{ section.value }}</div>
                </ng-container>

                <!-- Empty array -->
                <div class="empty-message" *ngIf="isArray(section.value) && section.value.length === 0">
                  {{ t('common.noData') }}
                </div>
              </div>
            </ng-container>
          </ng-container>
        </ng-container>

        <!-- Collapsible raw JSON for debugging -->
        <div class="dashboard-card raw-data-section">
          <div class="card-header clickable" (click)="showRawJson = !showRawJson">
            <h2 class="card-title">
              <span class="toggle-icon">{{ showRawJson ? '▼' : '▶' }}</span>
              📋 {{ t('results.rawData') }}
            </h2>
          </div>
          <pre class="json-view" *ngIf="showRawJson">{{ categoryData | json }}</pre>
        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    .results-page {
      max-width: 1400px;
      margin: 0 auto;
    }

    .page-header {
      margin-bottom: 24px;

      h1 {
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 28px;
        font-weight: 700;
        color: #fff;
        margin-bottom: 8px;

        .category-icon {
          font-size: 32px;
        }
      }

      p {
        color: #8d99a8;
      }
    }

    .issues-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .issue-item {
      padding: 16px;
      background-color: #232f3e;
      border-radius: 8px;
      border-left: 4px solid #414d5c;

      &.issue-critical, &.issue-high {
        border-left-color: #d13212;
      }

      &.issue-medium {
        border-left-color: #ff9900;
      }

      &.issue-low, &.issue-info {
        border-left-color: #0972d3;
      }
    }

    .issue-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
    }

    .issue-type {
      font-weight: 600;
      color: #fff;
      font-size: 14px;
    }

    .issue-savings {
      margin-left: auto;
      font-weight: 600;
      color: #1d8102;
    }

    .issue-message {
      color: #d1d5db;
      margin-bottom: 8px;
    }

    .issue-recommendation {
      font-size: 13px;
      color: #8d99a8;
      margin-bottom: 8px;
    }

    .issue-resources {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid #414d5c;

      .resources-label {
        font-size: 12px;
        color: #8d99a8;
        display: block;
        margin-bottom: 8px;
      }

      .resources-list {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;

        code {
          padding: 4px 8px;
          background-color: #0f1b2a;
          border-radius: 4px;
          font-size: 12px;
          color: #44b9d6;
        }
      }
    }

    .json-view {
      background-color: #0f1b2a;
      padding: 16px;
      border-radius: 8px;
      overflow-x: auto;
      font-size: 12px;
      color: #d1d5db;
      max-height: 500px;
      overflow-y: auto;
    }

    .table-container {
      overflow-x: auto;
    }

    .key-value-table {
      th {
        width: 200px;
        text-align: left;
        background-color: #1a242f;
        font-weight: 600;
      }
    }

    .nested-json {
      background-color: #0f1b2a;
      padding: 8px;
      border-radius: 4px;
      font-size: 11px;
      margin: 0;
      max-height: 150px;
      overflow: auto;
    }

    .primitive-value {
      padding: 16px;
      font-size: 18px;
      font-weight: 600;
      color: #fff;
    }

    .empty-message {
      padding: 24px;
      text-align: center;
      color: #8d99a8;
      font-style: italic;
    }

    .raw-data-section {
      margin-top: 24px;
      border: 1px dashed #414d5c;
    }

    .clickable {
      cursor: pointer;
      user-select: none;

      &:hover {
        background-color: #1a242f;
      }
    }

    .toggle-icon {
      font-size: 12px;
      margin-right: 8px;
      color: #8d99a8;
    }

    .text-muted {
      color: #8d99a8;
      font-style: italic;
    }

    code {
      padding: 2px 6px;
      background-color: #0f1b2a;
      border-radius: 4px;
      font-size: 12px;
      color: #44b9d6;
    }
  `]
})
export class ResultsComponent implements OnInit {
  category: ServiceCategory = 'cost';
  categoryData: any = null;
  issues: AuditIssue[] = [];
  showRawJson = false;

  constructor(
    private route: ActivatedRoute,
    private awsService: AwsApiService,
    private i18nService: I18nService
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.category = params['category'] || 'cost';
      this.loadCategoryData();
    });
  }

  t(key: string, params?: Record<string, string | number>): string {
    return this.i18nService.t(key, params);
  }

  loadCategoryData(): void {
    this.awsService.auditResults$.subscribe(results => {
      console.log('Results page - category:', this.category);
      console.log('Results page - all results:', results);
      if (results?.results) {
        console.log('Results page - category data:', results.results[this.category]);
        this.categoryData = results.results[this.category]?.data || null;
        this.issues = results.results[this.category]?.issues || [];
        console.log('Results page - categoryData:', this.categoryData);
        console.log('Results page - issues:', this.issues);
      }
    });
  }

  getCategoryIcon(category: ServiceCategory): string {
    return CATEGORY_ICONS[category] || '📁';
  }

  getSeverityClass(severity: string): string {
    switch (severity) {
      case 'CRITICAL':
      case 'HIGH':
        return 'badge-danger';
      case 'MEDIUM':
        return 'badge-warning';
      default:
        return 'badge-info';
    }
  }

  formatCurrency(value: number): string {
    return value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  formatSize(bytes: number): string {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + units[i];
  }

  formatDate(dateStr: string | undefined): string {
    if (!dateStr) return '';
    const lang = this.i18nService.getLanguage();
    return new Date(dateStr).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US');
  }

  // Dynamic table helper methods
  getDataSections(): { key: string; value: any }[] {
    if (!this.categoryData) return [];
    return Object.entries(this.categoryData).map(([key, value]) => ({ key, value }));
  }

  isArray(value: any): boolean {
    return Array.isArray(value);
  }

  isObject(value: any): boolean {
    return value !== null && typeof value === 'object';
  }

  getObjectKeys(obj: any): string[] {
    if (!obj || typeof obj !== 'object') return [];
    // Filter out complex nested objects for cleaner display
    return Object.keys(obj).filter(key => {
      const val = obj[key];
      // Keep arrays but only if they're simple
      if (Array.isArray(val)) return val.length === 0 || typeof val[0] !== 'object';
      // Keep non-object values and simple objects
      return typeof val !== 'object' || val === null;
    }).slice(0, 10); // Limit to 10 columns
  }

  getObjectEntries(obj: any): { key: string; value: any }[] {
    if (!obj || typeof obj !== 'object') return [];
    return Object.entries(obj).map(([key, value]) => ({ key, value }));
  }

  getValueType(value: any): string {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'boolean') return 'boolean';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') return 'object';
    if (typeof value === 'number') return 'number';

    // Check if it's a date string
    if (typeof value === 'string') {
      if (/^\d{4}-\d{2}-\d{2}/.test(value)) return 'date';
      // Check if it looks like an ID
      if (/^(i-|vol-|arn:|ami-|sg-|subnet-|vpc-|rtb-)/.test(value)) return 'id';
    }

    return 'string';
  }

  formatSectionTitle(key: string): string {
    // Convert camelCase or snake_case to Title Case
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .replace(/^\w/, c => c.toUpperCase())
      .trim();
  }

  formatColumnHeader(key: string): string {
    // Convert camelCase to readable format
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .replace(/Id$/i, 'ID')
      .replace(/^\w/, c => c.toUpperCase())
      .trim();
  }

  formatNumber(value: number): string {
    if (value === null || value === undefined) return '-';
    const lang = this.i18nService.getLanguage();
    // Format large numbers with separators
    if (value >= 1000000) {
      return (value / 1000000).toFixed(2) + ' M';
    }
    if (value >= 1000) {
      return value.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US');
    }
    // Format decimals
    if (!Number.isInteger(value)) {
      return value.toFixed(2);
    }
    return value.toString();
  }
}
