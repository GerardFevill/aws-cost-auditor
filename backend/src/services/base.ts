/**
 * Classe de base pour tous les services d'audit
 */

import { AWSCredentials, AuditResult, AuditIssue } from '../types';

export abstract class BaseAuditor {
  protected credentials: AWSCredentials;
  protected errors: string[] = [];
  protected issues: AuditIssue[] = [];

  constructor(credentials: AWSCredentials) {
    this.credentials = credentials;
  }

  abstract get serviceName(): string;
  abstract get category(): string;
  abstract audit(regions?: string[]): Promise<any>;

  protected getClientConfig(region?: string) {
    return {
      credentials: {
        accessKeyId: this.credentials.accessKeyId,
        secretAccessKey: this.credentials.secretAccessKey,
        sessionToken: this.credentials.sessionToken
      },
      region: region || this.credentials.region
    };
  }

  protected async safeApiCall<T>(
    apiCall: () => Promise<T>,
    errorContext: string
  ): Promise<T | null> {
    try {
      return await apiCall();
    } catch (error: any) {
      const errorMessage = `${errorContext}: ${error.message || error}`;
      this.errors.push(errorMessage);
      console.warn(errorMessage);
      return null;
    }
  }

  protected addIssue(issue: AuditIssue): void {
    this.issues.push(issue);
  }

  protected buildResult(data: any): AuditResult {
    return {
      service: this.serviceName,
      category: this.category,
      timestamp: new Date().toISOString(),
      success: this.errors.length === 0,
      error: this.errors.length > 0 ? this.errors.join('; ') : undefined,
      data,
      issues: this.issues
    };
  }

  // Régions AWS principales
  protected async getRegions(): Promise<string[]> {
    return [
      'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
      'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-central-1', 'eu-north-1',
      'ap-northeast-1', 'ap-northeast-2', 'ap-southeast-1', 'ap-southeast-2',
      'sa-east-1', 'ca-central-1'
    ];
  }
}
