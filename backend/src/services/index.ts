/**
 * Export de tous les services d'audit
 */

export { BaseAuditor } from './base';
export { CostAuditor } from './cost';
export { ComputeAuditor } from './compute';
export { StorageAuditor } from './storage';
export { DatabaseAuditor } from './database';
export { NetworkAuditor } from './network';
export { SecurityAuditor } from './security';
export { AnalyticsAuditor } from './analytics';
export { IntegrationAuditor } from './integration';
export { ManagementAuditor } from './management';
export { ContainersAuditor } from './containers';
export { AIMLAuditor } from './aiml';

import { AWSCredentials } from '../types';
import { CostAuditor } from './cost';
import { ComputeAuditor } from './compute';
import { StorageAuditor } from './storage';
import { DatabaseAuditor } from './database';
import { NetworkAuditor } from './network';
import { SecurityAuditor } from './security';
import { AnalyticsAuditor } from './analytics';
import { IntegrationAuditor } from './integration';
import { ManagementAuditor } from './management';
import { ContainersAuditor } from './containers';
import { AIMLAuditor } from './aiml';

// Mapping service ID -> Auditor class
export const AUDITOR_MAP: Record<string, new (credentials: AWSCredentials) => any> = {
  // Cost
  'costexplorer': CostAuditor,
  'budgets': CostAuditor,

  // Compute
  'ec2': ComputeAuditor,
  'lambda': ComputeAuditor,
  'ecs': ComputeAuditor,
  'eks': ComputeAuditor,
  'lightsail': ComputeAuditor,
  'beanstalk': ComputeAuditor,
  'batch': ComputeAuditor,

  // Storage
  's3': StorageAuditor,
  'ebs': StorageAuditor,
  'efs': StorageAuditor,
  'fsx': StorageAuditor,
  'backup': StorageAuditor,

  // Database
  'rds': DatabaseAuditor,
  'dynamodb': DatabaseAuditor,
  'elasticache': DatabaseAuditor,
  'redshift': DatabaseAuditor,
  'documentdb': DatabaseAuditor,
  'neptune': DatabaseAuditor,

  // Network
  'vpc': NetworkAuditor,
  'cloudfront': NetworkAuditor,
  'route53': NetworkAuditor,
  'apigateway': NetworkAuditor,
  'elb': NetworkAuditor,
  'natgateway': NetworkAuditor,

  // Security
  'iam': SecurityAuditor,
  'kms': SecurityAuditor,
  'secretsmanager': SecurityAuditor,
  'acm': SecurityAuditor,
  'waf': SecurityAuditor,
  'guardduty': SecurityAuditor,

  // Analytics
  'athena': AnalyticsAuditor,
  'emr': AnalyticsAuditor,
  'kinesis': AnalyticsAuditor,
  'opensearch': AnalyticsAuditor,
  'glue': AnalyticsAuditor,

  // Integration
  'sqs': IntegrationAuditor,
  'sns': IntegrationAuditor,
  'eventbridge': IntegrationAuditor,
  'stepfunctions': IntegrationAuditor,

  // Management
  'cloudwatch': ManagementAuditor,
  'cloudtrail': ManagementAuditor,
  'config': ManagementAuditor,
  'ssm': ManagementAuditor,
  'organizations': ManagementAuditor,

  // Containers
  'ecr': ContainersAuditor,

  // AI/ML
  'sagemaker': AIMLAuditor,
  'bedrock': AIMLAuditor
};

/**
 * Callback pour reporter la progression
 */
export type ProgressCallback = (step: string, status: 'start' | 'complete' | 'error', data?: any) => void;

/**
 * Exécute l'audit pour les services spécifiés
 */
export async function runAudit(
  credentials: AWSCredentials,
  serviceIds: string[],
  regions?: string[],
  onProgress?: ProgressCallback
): Promise<Record<string, any>> {
  const results: Record<string, any> = {};
  const auditorsRun = new Set<string>();

  // Reporter le début
  if (onProgress) {
    onProgress('init', 'start');
    onProgress('init', 'complete');
  }

  for (const serviceId of serviceIds) {
    const AuditorClass = AUDITOR_MAP[serviceId];

    if (!AuditorClass) {
      results[serviceId] = {
        success: false,
        error: `Service non supporté: ${serviceId}`
      };
      continue;
    }

    // Éviter de lancer le même auditor plusieurs fois
    const auditorName = AuditorClass.name;
    if (auditorsRun.has(auditorName)) {
      continue;
    }
    auditorsRun.add(auditorName);

    try {
      const auditor = new AuditorClass(credentials);
      const category = auditor.category;

      // Reporter le début de cette catégorie
      if (onProgress) {
        onProgress(category, 'start');
      }

      const result = await auditor.audit(regions);

      // Reporter la fin de cette catégorie
      if (onProgress) {
        onProgress(category, 'complete', result);
      }

      // Merger les résultats par catégorie
      if (!results[category]) {
        results[category] = result;
      } else {
        // Fusionner les données
        results[category] = {
          ...results[category],
          ...result
        };
      }
    } catch (error: any) {
      if (onProgress) {
        onProgress(serviceId, 'error', { error: error.message });
      }
      results[serviceId] = {
        success: false,
        error: error.message
      };
    }
  }

  // Reporter la finalisation
  if (onProgress) {
    onProgress('finalize', 'start');
    onProgress('finalize', 'complete');
  }

  return results;
}
