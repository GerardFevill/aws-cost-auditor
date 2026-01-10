/**
 * Service d'audit Storage (S3, EFS, FSx, Backup)
 */

import {
  S3Client,
  ListBucketsCommand,
  GetBucketLocationCommand,
  GetBucketVersioningCommand,
  GetBucketEncryptionCommand,
  GetBucketLifecycleConfigurationCommand,
  GetPublicAccessBlockCommand
} from '@aws-sdk/client-s3';
import {
  EFSClient,
  DescribeFileSystemsCommand
} from '@aws-sdk/client-efs';
import {
  FSxClient,
  DescribeFileSystemsCommand as FSxDescribeFileSystemsCommand
} from '@aws-sdk/client-fsx';
import {
  BackupClient,
  ListBackupVaultsCommand,
  ListBackupPlansCommand
} from '@aws-sdk/client-backup';
import {
  CloudWatchClient,
  GetMetricStatisticsCommand
} from '@aws-sdk/client-cloudwatch';
import { BaseAuditor } from './base';

export class StorageAuditor extends BaseAuditor {
  get serviceName() { return 'Storage'; }
  get category() { return 'storage'; }

  async audit(regions?: string[]): Promise<any> {
    const targetRegions = regions || await this.getRegions();

    const s3Data = await this.auditS3();
    const efsData = await this.auditEFS(targetRegions);
    const fsxData = await this.auditFSx(targetRegions);
    const backupData = await this.auditBackup(targetRegions);

    return this.buildResult({
      s3: s3Data,
      efs: efsData,
      fsx: fsxData,
      backup: backupData
    });
  }

  private async auditS3(): Promise<any> {
    const client = new S3Client(this.getClientConfig());
    const buckets: any[] = [];

    const listResponse = await this.safeApiCall(
      () => client.send(new ListBucketsCommand({})),
      'S3 ListBuckets'
    );

    if (!listResponse?.Buckets) {
      return { buckets, summary: { totalBuckets: 0 } };
    }

    for (const bucket of listResponse.Buckets) {
      const bucketName = bucket.Name!;

      // Région du bucket
      const locationResponse = await this.safeApiCall(
        () => client.send(new GetBucketLocationCommand({ Bucket: bucketName })),
        `S3 location ${bucketName}`
      );
      const region = locationResponse?.LocationConstraint || 'us-east-1';

      // Versioning
      const versioningResponse = await this.safeApiCall(
        () => client.send(new GetBucketVersioningCommand({ Bucket: bucketName })),
        `S3 versioning ${bucketName}`
      );
      const versioning = versioningResponse?.Status || 'Disabled';

      // Encryption
      let encryptionEnabled = false;
      const encryptionResponse = await this.safeApiCall(
        () => client.send(new GetBucketEncryptionCommand({ Bucket: bucketName })),
        `S3 encryption ${bucketName}`
      );
      encryptionEnabled = !!encryptionResponse?.ServerSideEncryptionConfiguration;

      // Lifecycle
      const lifecycleResponse = await this.safeApiCall(
        () => client.send(new GetBucketLifecycleConfigurationCommand({ Bucket: bucketName })),
        `S3 lifecycle ${bucketName}`
      );
      const hasLifecycle = (lifecycleResponse?.Rules?.length || 0) > 0;

      // Public Access
      let publicAccessPossible = true;
      const publicAccessResponse = await this.safeApiCall(
        () => client.send(new GetPublicAccessBlockCommand({ Bucket: bucketName })),
        `S3 public access ${bucketName}`
      );
      if (publicAccessResponse?.PublicAccessBlockConfiguration) {
        const config = publicAccessResponse.PublicAccessBlockConfiguration;
        publicAccessPossible = !(
          config.BlockPublicAcls &&
          config.IgnorePublicAcls &&
          config.BlockPublicPolicy &&
          config.RestrictPublicBuckets
        );
      }

      // Métriques de taille via CloudWatch
      const metrics = await this.getBucketMetrics(bucketName, region);

      buckets.push({
        name: bucketName,
        region,
        creationDate: bucket.CreationDate?.toISOString(),
        versioning,
        encryptionEnabled,
        hasLifecycle,
        publicAccessPossible,
        sizeBytes: metrics.sizeBytes,
        objectCount: metrics.objectCount
      });

      // Détecter les problèmes
      if (!encryptionEnabled) {
        this.addIssue({
          type: 'UNENCRYPTED_BUCKET',
          severity: 'MEDIUM',
          message: `Bucket sans chiffrement: ${bucketName}`,
          resources: [bucketName],
          recommendation: 'Activer le chiffrement par défaut'
        });
      }

      if (publicAccessPossible) {
        this.addIssue({
          type: 'POTENTIALLY_PUBLIC_BUCKET',
          severity: 'HIGH',
          message: `Bucket potentiellement public: ${bucketName}`,
          resources: [bucketName],
          recommendation: 'Bloquer l\'accès public si non nécessaire'
        });
      }

      if (!hasLifecycle && metrics.sizeBytes > 1024 * 1024 * 1024) { // > 1GB
        this.addIssue({
          type: 'NO_LIFECYCLE_POLICY',
          severity: 'LOW',
          message: `Bucket > 1GB sans politique de lifecycle: ${bucketName}`,
          resources: [bucketName],
          recommendation: 'Configurer une politique de lifecycle pour optimiser les coûts'
        });
      }
    }

    const totalSize = buckets.reduce((sum, b) => sum + b.sizeBytes, 0);
    const totalObjects = buckets.reduce((sum, b) => sum + b.objectCount, 0);

    return {
      buckets,
      summary: {
        totalBuckets: buckets.length,
        totalSizeBytes: totalSize,
        totalSizeGB: Math.round(totalSize / (1024 * 1024 * 1024) * 100) / 100,
        totalObjects,
        bucketsWithVersioning: buckets.filter(b => b.versioning === 'Enabled').length,
        bucketsEncrypted: buckets.filter(b => b.encryptionEnabled).length,
        bucketsPotentiallyPublic: buckets.filter(b => b.publicAccessPossible).length
      }
    };
  }

  private async getBucketMetrics(bucketName: string, region: string): Promise<{ sizeBytes: number; objectCount: number }> {
    const client = new CloudWatchClient(this.getClientConfig(region === 'us-east-1' ? 'us-east-1' : region));

    const endTime = new Date();
    const startTime = new Date();
    startTime.setDate(startTime.getDate() - 2);

    let sizeBytes = 0;
    let objectCount = 0;

    // Taille du bucket
    const sizeResponse = await this.safeApiCall(
      () => client.send(new GetMetricStatisticsCommand({
        Namespace: 'AWS/S3',
        MetricName: 'BucketSizeBytes',
        Dimensions: [
          { Name: 'BucketName', Value: bucketName },
          { Name: 'StorageType', Value: 'StandardStorage' }
        ],
        StartTime: startTime,
        EndTime: endTime,
        Period: 86400,
        Statistics: ['Average']
      })),
      `CloudWatch S3 size ${bucketName}`
    );

    if (sizeResponse?.Datapoints?.length) {
      sizeBytes = sizeResponse.Datapoints[sizeResponse.Datapoints.length - 1].Average || 0;
    }

    // Nombre d'objets
    const countResponse = await this.safeApiCall(
      () => client.send(new GetMetricStatisticsCommand({
        Namespace: 'AWS/S3',
        MetricName: 'NumberOfObjects',
        Dimensions: [
          { Name: 'BucketName', Value: bucketName },
          { Name: 'StorageType', Value: 'AllStorageTypes' }
        ],
        StartTime: startTime,
        EndTime: endTime,
        Period: 86400,
        Statistics: ['Average']
      })),
      `CloudWatch S3 count ${bucketName}`
    );

    if (countResponse?.Datapoints?.length) {
      objectCount = Math.round(countResponse.Datapoints[countResponse.Datapoints.length - 1].Average || 0);
    }

    return { sizeBytes, objectCount };
  }

  private async auditEFS(regions: string[]): Promise<any> {
    const fileSystems: any[] = [];

    for (const region of regions) {
      const client = new EFSClient(this.getClientConfig(region));

      const response = await this.safeApiCall(
        () => client.send(new DescribeFileSystemsCommand({})),
        `EFS ${region}`
      );

      if (response?.FileSystems) {
        for (const fs of response.FileSystems) {
          fileSystems.push({
            fileSystemId: fs.FileSystemId,
            name: fs.Name,
            lifeCycleState: fs.LifeCycleState,
            sizeInBytes: fs.SizeInBytes?.Value,
            performanceMode: fs.PerformanceMode,
            throughputMode: fs.ThroughputMode,
            encrypted: fs.Encrypted,
            region
          });
        }
      }
    }

    return {
      fileSystems,
      summary: {
        totalFileSystems: fileSystems.length,
        totalSizeBytes: fileSystems.reduce((sum, fs) => sum + (fs.sizeInBytes || 0), 0)
      }
    };
  }

  private async auditFSx(regions: string[]): Promise<any> {
    const fileSystems: any[] = [];

    for (const region of regions) {
      const client = new FSxClient(this.getClientConfig(region));

      const response = await this.safeApiCall(
        () => client.send(new FSxDescribeFileSystemsCommand({})),
        `FSx ${region}`
      );

      if (response?.FileSystems) {
        for (const fs of response.FileSystems) {
          fileSystems.push({
            fileSystemId: fs.FileSystemId,
            fileSystemType: fs.FileSystemType,
            lifecycle: fs.Lifecycle,
            storageCapacity: fs.StorageCapacity,
            storageType: fs.StorageType,
            region
          });
        }
      }
    }

    return {
      fileSystems,
      summary: {
        totalFileSystems: fileSystems.length,
        totalStorageGB: fileSystems.reduce((sum, fs) => sum + (fs.storageCapacity || 0), 0)
      }
    };
  }

  private async auditBackup(regions: string[]): Promise<any> {
    const vaults: any[] = [];
    const plans: any[] = [];

    for (const region of regions) {
      const client = new BackupClient(this.getClientConfig(region));

      // Vaults
      const vaultsResponse = await this.safeApiCall(
        () => client.send(new ListBackupVaultsCommand({})),
        `Backup vaults ${region}`
      );

      if (vaultsResponse?.BackupVaultList) {
        for (const vault of vaultsResponse.BackupVaultList) {
          vaults.push({
            name: vault.BackupVaultName,
            numberOfRecoveryPoints: vault.NumberOfRecoveryPoints,
            region
          });
        }
      }

      // Plans
      const plansResponse = await this.safeApiCall(
        () => client.send(new ListBackupPlansCommand({})),
        `Backup plans ${region}`
      );

      if (plansResponse?.BackupPlansList) {
        for (const plan of plansResponse.BackupPlansList) {
          plans.push({
            planId: plan.BackupPlanId,
            planName: plan.BackupPlanName,
            region
          });
        }
      }
    }

    return {
      vaults,
      plans,
      summary: {
        totalVaults: vaults.length,
        totalPlans: plans.length,
        totalRecoveryPoints: vaults.reduce((sum, v) => sum + (v.numberOfRecoveryPoints || 0), 0)
      }
    };
  }
}
