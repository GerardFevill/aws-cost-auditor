/**
 * Composant principal de l'application
 */

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AwsApiService } from './services/aws.service';
import { ThemeService, Theme } from './services/theme.service';
import { I18nService, Language } from './services/i18n.service';
import { AuthState, CATEGORY_LABELS, CATEGORY_ICONS, ServiceCategory } from './models/aws.models';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="app-layout">
      <!-- Header -->
      <header class="app-header" *ngIf="isAuthenticated">
        <div class="app-header-logo">
          <span>☁️</span>
          <span>AWS Cost Auditor</span>
        </div>
        <div class="app-header-right">
          <!-- Language Selector -->
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

          <!-- Theme Toggle -->
          <button class="theme-toggle" (click)="toggleTheme()" [title]="isDark ? 'Light mode' : 'Dark mode'">
            <span *ngIf="isDark">☀️</span>
            <span *ngIf="!isDark">🌙</span>
          </button>

          <!-- Help Link -->
          <a routerLink="/help" class="header-link" [title]="t('nav.help')">
            📖 {{ t('nav.help') }}
          </a>

          <span class="account-id" *ngIf="accountId">
            {{ t('common.account') }}: {{ accountId }}
          </span>
          <button class="btn btn-secondary" (click)="logout()">
            {{ t('common.logout') }}
          </button>
        </div>
      </header>

      <!-- Sidebar -->
      <aside class="app-sidebar" *ngIf="isAuthenticated">
        <nav>
          <div class="nav-section">
            <div class="nav-section-title">{{ t('nav.navigation') }}</div>
            <a class="nav-item" routerLink="/dashboard" routerLinkActive="active">
              <span class="nav-item-icon">📊</span>
              <span>{{ t('nav.dashboard') }}</span>
            </a>
            <a class="nav-item" routerLink="/audit" routerLinkActive="active">
              <span class="nav-item-icon">🔍</span>
              <span>{{ t('nav.audit') }}</span>
            </a>
          </div>

          <div class="nav-section" *ngIf="hasResults">
            <div class="nav-section-title">{{ t('nav.resultsByCategory') }}</div>
            <a
              *ngFor="let category of categories"
              class="nav-item"
              [routerLink]="['/results', category]"
              routerLinkActive="active"
            >
              <span class="nav-item-icon">{{ getCategoryIcon(category) }}</span>
              <span>{{ t('categories.' + category) }}</span>
            </a>
          </div>
        </nav>
      </aside>

      <!-- Main Content -->
      <main [class.app-content]="isAuthenticated" [class.app-content-full]="!isAuthenticated">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  styles: [`
    .app-header-right {
      margin-left: auto;
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .account-id {
      font-size: 13px;
      color: var(--color-text-muted);
    }

    .app-content-full {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 24px;
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

    .header-link {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      color: var(--color-text-muted);
      text-decoration: none;
      font-size: 13px;
      font-weight: 500;
      border-radius: 4px;
      transition: all 0.15s;

      &:hover {
        color: var(--color-text-primary);
        background-color: var(--color-bg-hover);
      }
    }
  `]
})
export class AppComponent implements OnInit {
  isAuthenticated = false;
  accountId?: string;
  hasResults = false;
  isDark = true;
  currentLang: Language = 'en';
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
    private themeService: ThemeService,
    private i18nService: I18nService
  ) {}

  ngOnInit(): void {
    // S'abonner à l'état d'authentification
    this.awsService.authState$.subscribe((state: AuthState) => {
      this.isAuthenticated = state.isAuthenticated;
      this.accountId = state.accountId;

      if (!state.isAuthenticated && this.router.url !== '/login') {
        this.router.navigate(['/login']);
      }
    });

    // S'abonner aux résultats d'audit
    this.awsService.auditResults$.subscribe((results: any) => {
      this.hasResults = !!results;
    });

    // S'abonner au thème
    this.themeService.theme$.subscribe((theme: Theme) => {
      this.isDark = theme === 'dark';
    });

    // S'abonner à la langue
    this.i18nService.lang$.subscribe((lang: Language) => {
      this.currentLang = lang;
    });
  }

  getCategoryLabel(category: ServiceCategory): string {
    return CATEGORY_LABELS[category] || category;
  }

  getCategoryIcon(category: ServiceCategory): string {
    return CATEGORY_ICONS[category] || '📁';
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

  logout(): void {
    this.awsService.logout();
    this.router.navigate(['/login']);
  }
}
