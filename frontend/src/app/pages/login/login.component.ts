/**
 * Page de connexion - Saisie des credentials AWS
 */

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AwsApiService } from '../../services/aws.service';
import { ThemeService } from '../../services/theme.service';
import { I18nService, Language } from '../../services/i18n.service';
import { AWSCredentials, AWS_REGIONS } from '../../models/aws.models';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="login-container">
      <!-- Theme and Language controls -->
      <div class="login-controls">
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

      <div class="login-card">
        <div class="login-header">
          <h1>☁️ {{ t('login.title') }}</h1>
          <p>{{ t('login.subtitle') }}</p>
        </div>

        <div class="alert alert-info" *ngIf="!error">
          <strong>{{ t('login.importantNote') }}</strong> {{ t('login.securityNote') }}
        </div>

        <div class="alert alert-danger" *ngIf="error">
          {{ error }}
        </div>

        <form (ngSubmit)="onSubmit()" #loginForm="ngForm">
          <div class="form-group">
            <label class="form-label" for="accessKeyId">{{ t('login.accessKeyId') }} *</label>
            <input
              type="text"
              id="accessKeyId"
              class="form-input"
              [(ngModel)]="credentials.accessKeyId"
              name="accessKeyId"
              placeholder="AKIAIOSFODNN7EXAMPLE"
              required
              autocomplete="off"
            />
          </div>

          <div class="form-group">
            <label class="form-label" for="secretAccessKey">{{ t('login.secretAccessKey') }} *</label>
            <input
              type="password"
              id="secretAccessKey"
              class="form-input"
              [(ngModel)]="credentials.secretAccessKey"
              name="secretAccessKey"
              placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
              required
              autocomplete="off"
            />
          </div>

          <div class="form-group">
            <label class="form-label" for="region">{{ t('login.region') }}</label>
            <select
              id="region"
              class="form-input"
              [(ngModel)]="credentials.region"
              name="region"
            >
              <option *ngFor="let region of regions" [value]="region.value">
                {{ region.label }}
              </option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label" for="sessionToken">{{ t('login.sessionToken') }}</label>
            <input
              type="password"
              id="sessionToken"
              class="form-input"
              [(ngModel)]="credentials.sessionToken"
              name="sessionToken"
              [placeholder]="t('login.sessionTokenPlaceholder')"
              autocomplete="off"
            />
          </div>

          <button
            type="submit"
            class="btn btn-primary btn-full"
            [disabled]="loading || !loginForm.valid"
          >
            <span *ngIf="!loading">{{ t('login.submit') }}</span>
            <span *ngIf="loading">
              <span class="spinner"></span>
              {{ t('login.validating') }}
            </span>
          </button>
        </form>

        <div class="login-footer">
          <h3>{{ t('login.iamPermissions') }}</h3>
          <p>{{ t('login.iamDescription') }}</p>
          <ul>
            <li>ce:Get*, ce:Describe*, ce:List* (Cost Explorer)</li>
            <li>ec2:Describe*, s3:List*, rds:Describe*</li>
            <li>iam:List*, iam:Get* (IAM)</li>
            <li>{{ t('login.otherPermissions') }}</li>
          </ul>
        </div>

        <div class="help-link">
          <a routerLink="/help">📖 {{ t('nav.help') }}</a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .login-container {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 24px;
      background-color: var(--color-bg-primary);
      transition: background-color 0.2s ease;
    }

    .login-controls {
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

    .login-card {
      background-color: var(--color-bg-secondary);
      border: 1px solid var(--color-border);
      border-radius: 12px;
      padding: 40px;
      max-width: 480px;
      width: 100%;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
      transition: background-color 0.2s ease, border-color 0.2s ease;
    }

    .login-header {
      text-align: center;
      margin-bottom: 32px;

      h1 {
        font-size: 28px;
        font-weight: 700;
        color: var(--color-text-primary);
        margin-bottom: 8px;
      }

      p {
        color: var(--color-text-muted);
        font-size: 14px;
      }
    }

    .btn-full {
      width: 100%;
      padding: 14px;
      font-size: 16px;
      margin-top: 8px;
    }

    .login-footer {
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid var(--color-border);

      h3 {
        font-size: 14px;
        font-weight: 600;
        color: var(--color-text-primary);
        margin-bottom: 8px;
      }

      p {
        font-size: 13px;
        color: var(--color-text-muted);
        margin-bottom: 8px;
      }

      ul {
        list-style: none;
        padding: 0;
        margin: 0;

        li {
          font-size: 12px;
          color: var(--color-text-disabled);
          padding: 4px 0;
          font-family: monospace;

          &:before {
            content: "•";
            color: var(--color-accent);
            margin-right: 8px;
          }
        }
      }
    }

    .help-link {
      text-align: center;
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid var(--color-border);

      a {
        color: var(--color-accent);
        text-decoration: none;
        font-size: 14px;
        font-weight: 500;
        transition: color 0.15s;

        &:hover {
          color: var(--color-accent-hover);
          text-decoration: underline;
        }
      }
    }
  `]
})
export class LoginComponent implements OnInit {
  credentials: AWSCredentials = {
    accessKeyId: '',
    secretAccessKey: '',
    region: 'us-east-1'
  };

  regions = AWS_REGIONS;
  loading = false;
  error = '';
  isDark = true;
  currentLang: Language = 'en';

  constructor(
    private awsService: AwsApiService,
    private router: Router,
    private themeService: ThemeService,
    private i18nService: I18nService
  ) {
    // Rediriger si déjà connecté
    if (this.awsService.isAuthenticated()) {
      this.router.navigate(['/dashboard']);
    }
  }

  ngOnInit(): void {
    this.themeService.theme$.subscribe(theme => {
      this.isDark = theme === 'dark';
    });

    this.i18nService.lang$.subscribe(lang => {
      this.currentLang = lang;
    });
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

  onSubmit(): void {
    this.error = '';
    this.loading = true;

    this.awsService.validateCredentials(this.credentials).subscribe({
      next: (result: any) => {
        this.loading = false;
        this.router.navigate(['/audit']);
      },
      error: (err: any) => {
        this.loading = false;
        this.error = err.message || this.t('login.invalidCredentials');
      }
    });
  }
}
