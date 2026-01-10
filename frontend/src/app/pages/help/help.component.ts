/**
 * Page d'aide - Guide d'utilisation de l'outil
 */

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ThemeService } from '../../services/theme.service';
import { I18nService, Language } from '../../services/i18n.service';
import { AwsApiService } from '../../services/aws.service';

@Component({
  selector: 'app-help',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="help-container">
      <!-- Theme and Language controls -->
      <div class="help-controls">
        <div class="header-control">
          <button
            class="control-btn"
            [class.active]="currentLang === 'en'"
            (click)="setLanguage('en')"
          >EN</button>
          <button
            class="control-btn"
            [class.active]="currentLang === 'fr'"
            (click)="setLanguage('fr')"
          >FR</button>
        </div>
        <button class="theme-toggle" (click)="toggleTheme()">
          <span *ngIf="isDark">☀️</span>
          <span *ngIf="!isDark">🌙</span>
        </button>
      </div>

      <div class="help-content">
        <div class="help-header">
          <h1>📖 {{ t('help.title') }}</h1>
          <p>{{ t('help.subtitle') }}</p>
        </div>

        <!-- Getting Started -->
        <section class="help-section">
          <h2>🚀 {{ t('help.gettingStarted.title') }}</h2>
          <div class="help-card">
            <h3>{{ t('help.gettingStarted.step1Title') }}</h3>
            <p>{{ t('help.gettingStarted.step1Desc') }}</p>
          </div>
          <div class="help-card">
            <h3>{{ t('help.gettingStarted.step2Title') }}</h3>
            <p>{{ t('help.gettingStarted.step2Desc') }}</p>
          </div>
          <div class="help-card">
            <h3>{{ t('help.gettingStarted.step3Title') }}</h3>
            <p>{{ t('help.gettingStarted.step3Desc') }}</p>
          </div>
          <div class="help-card">
            <h3>{{ t('help.gettingStarted.step4Title') }}</h3>
            <p>{{ t('help.gettingStarted.step4Desc') }}</p>
          </div>
        </section>

        <!-- IAM Permissions -->
        <section class="help-section">
          <h2>🔐 {{ t('help.permissions.title') }}</h2>
          <p class="section-intro">{{ t('help.permissions.intro') }}</p>
          <div class="code-block">
            <pre>{{ iamPolicy }}</pre>
          </div>
          <div class="alert alert-warning">
            <strong>{{ t('help.permissions.warningTitle') }}</strong>
            {{ t('help.permissions.warningDesc') }}
          </div>
        </section>

        <!-- Features -->
        <section class="help-section">
          <h2>✨ {{ t('help.features.title') }}</h2>
          <div class="features-grid">
            <div class="feature-card">
              <span class="feature-icon">💰</span>
              <h3>{{ t('help.features.costAnalysis') }}</h3>
              <p>{{ t('help.features.costAnalysisDesc') }}</p>
            </div>
            <div class="feature-card">
              <span class="feature-icon">🔍</span>
              <h3>{{ t('help.features.resourceAudit') }}</h3>
              <p>{{ t('help.features.resourceAuditDesc') }}</p>
            </div>
            <div class="feature-card">
              <span class="feature-icon">💡</span>
              <h3>{{ t('help.features.recommendations') }}</h3>
              <p>{{ t('help.features.recommendationsDesc') }}</p>
            </div>
            <div class="feature-card">
              <span class="feature-icon">📊</span>
              <h3>{{ t('help.features.reports') }}</h3>
              <p>{{ t('help.features.reportsDesc') }}</p>
            </div>
          </div>
        </section>

        <!-- Security -->
        <section class="help-section">
          <h2>🛡️ {{ t('help.security.title') }}</h2>
          <div class="security-list">
            <div class="security-item">
              <span class="check-icon">✓</span>
              <span>{{ t('help.security.item1') }}</span>
            </div>
            <div class="security-item">
              <span class="check-icon">✓</span>
              <span>{{ t('help.security.item2') }}</span>
            </div>
            <div class="security-item">
              <span class="check-icon">✓</span>
              <span>{{ t('help.security.item3') }}</span>
            </div>
            <div class="security-item">
              <span class="check-icon">✓</span>
              <span>{{ t('help.security.item4') }}</span>
            </div>
          </div>
        </section>

        <!-- Back Button -->
        <div class="help-footer">
          <a *ngIf="isAuthenticated" routerLink="/dashboard" class="btn btn-primary">
            {{ t('help.backToDashboard') }}
          </a>
          <a *ngIf="!isAuthenticated" routerLink="/login" class="btn btn-primary">
            {{ t('help.backToLogin') }}
          </a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .help-container {
      min-height: 100vh;
      padding: 24px;
      background-color: var(--color-bg-primary);
      transition: background-color 0.2s ease;
    }

    .help-controls {
      position: fixed;
      top: 16px;
      right: 16px;
      display: flex;
      gap: 8px;
      z-index: 100;
    }

    .header-control {
      display: flex;
      background-color: var(--color-bg-hover);
      border-radius: 4px;
      overflow: hidden;
    }

    .control-btn {
      padding: 6px 12px;
      border: none;
      background: transparent;
      color: var(--color-text-muted);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;

      &:hover {
        color: var(--color-text-primary);
      }

      &.active {
        background-color: var(--color-accent);
        color: white;
      }
    }

    .theme-toggle {
      width: 36px;
      height: 36px;
      border: none;
      background-color: var(--color-bg-hover);
      border-radius: 4px;
      cursor: pointer;
      font-size: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background-color 0.15s;

      &:hover {
        background-color: var(--color-border);
      }
    }

    .help-content {
      max-width: 900px;
      margin: 0 auto;
      padding-top: 40px;
    }

    .help-header {
      text-align: center;
      margin-bottom: 48px;

      h1 {
        font-size: 32px;
        font-weight: 700;
        color: var(--color-text-primary);
        margin-bottom: 12px;
      }

      p {
        color: var(--color-text-muted);
        font-size: 16px;
      }
    }

    .help-section {
      margin-bottom: 48px;

      h2 {
        font-size: 24px;
        font-weight: 600;
        color: var(--color-text-primary);
        margin-bottom: 20px;
        padding-bottom: 12px;
        border-bottom: 2px solid var(--color-border);
      }

      .section-intro {
        color: var(--color-text-secondary);
        margin-bottom: 16px;
      }
    }

    .help-card {
      background-color: var(--color-bg-secondary);
      border: 1px solid var(--color-border);
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 16px;

      h3 {
        font-size: 16px;
        font-weight: 600;
        color: var(--color-text-primary);
        margin-bottom: 8px;
      }

      p {
        color: var(--color-text-secondary);
        font-size: 14px;
        line-height: 1.6;
      }
    }

    .code-block {
      background-color: var(--color-bg-tertiary);
      border: 1px solid var(--color-border);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 16px;
      overflow-x: auto;

      pre {
        margin: 0;
        font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
        font-size: 13px;
        color: var(--color-text-secondary);
        white-space: pre-wrap;
      }
    }

    .features-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
    }

    .feature-card {
      background-color: var(--color-bg-secondary);
      border: 1px solid var(--color-border);
      border-radius: 8px;
      padding: 24px;
      text-align: center;

      .feature-icon {
        font-size: 32px;
        display: block;
        margin-bottom: 12px;
      }

      h3 {
        font-size: 16px;
        font-weight: 600;
        color: var(--color-text-primary);
        margin-bottom: 8px;
      }

      p {
        color: var(--color-text-muted);
        font-size: 13px;
        line-height: 1.5;
      }
    }

    .security-list {
      background-color: var(--color-bg-secondary);
      border: 1px solid var(--color-border);
      border-radius: 8px;
      padding: 20px;
    }

    .security-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 0;
      border-bottom: 1px solid var(--color-border);
      color: var(--color-text-secondary);

      &:last-child {
        border-bottom: none;
      }

      .check-icon {
        color: var(--color-success);
        font-weight: bold;
      }
    }

    .help-footer {
      text-align: center;
      padding: 32px 0;
      margin-top: 32px;
      border-top: 1px solid var(--color-border);
    }

    .alert {
      padding: 16px;
      border-radius: 8px;
      margin-top: 16px;
    }

    .alert-warning {
      background-color: var(--color-warning-light);
      border: 1px solid var(--color-warning);
      color: var(--color-text-primary);

      strong {
        display: block;
        margin-bottom: 4px;
      }
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 12px 24px;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.15s;
    }

    .btn-primary {
      background-color: var(--color-accent);
      color: white;

      &:hover {
        background-color: var(--color-accent-hover);
      }
    }
  `]
})
export class HelpComponent implements OnInit {
  isDark = true;
  currentLang: Language = 'en';
  isAuthenticated = false;

  iamPolicy = `{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ce:Get*",
        "ce:Describe*",
        "ce:List*",
        "ec2:Describe*",
        "s3:List*",
        "s3:GetBucket*",
        "rds:Describe*",
        "lambda:List*",
        "lambda:Get*",
        "iam:List*",
        "iam:Get*",
        "cloudwatch:Get*",
        "cloudwatch:List*",
        "budgets:View*",
        "budgets:Describe*"
      ],
      "Resource": "*"
    }
  ]
}`;

  constructor(
    private themeService: ThemeService,
    private i18nService: I18nService,
    private awsService: AwsApiService
  ) {}

  ngOnInit(): void {
    this.themeService.theme$.subscribe(theme => {
      this.isDark = theme === 'dark';
    });

    this.i18nService.lang$.subscribe(lang => {
      this.currentLang = lang;
    });

    this.isAuthenticated = this.awsService.isAuthenticated();
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  setLanguage(lang: Language): void {
    this.i18nService.setLanguage(lang);
  }

  t(key: string): string {
    return this.i18nService.t(key);
  }
}
