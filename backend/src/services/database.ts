/**
 * Service d'audit Database (RDS, DynamoDB, ElastiCache, Redshift, etc.)
 */

import {
  RDSClient,
  DescribeDBInstancesCommand,
  DescribeDBClustersCommand,
  DescribeDBSnapshotsCommand,
  DescribeReservedDBInstancesCommand
} from '@aws-sdk/client-rds';
import {
  DynamoDBClient,
  ListTablesCommand,
  DescribeTableCommand
} from '@aws-sdk/client-dynamodb';
import {
  ElastiCacheClient,
  DescribeCacheClustersCommand,
  DescribeReservedCacheNodesCommand
} from '@aws-sdk/client-elasticache';
import {
  RedshiftClient,
  DescribeClustersCommand as RedshiftDescribeClustersCommand
} from '@aws-sdk/client-redshift';
import {
  DocDBClient,
  DescribeDBClustersCommand as DocDBDescribeClustersCommand
} from '@aws-sdk/client-docdb';
import {
  NeptuneClient,
  DescribeDBClustersCommand as NeptuneDescribeClustersCommand
} from '@aws-sdk/client-neptune';
import { BaseAuditor } from './base';

export class DatabaseAuditor extends BaseAuditor {
  get serviceName() { return 'Database'; }
  get category() { return 'database'; }

  async audit(regions?: string[]): Promise<any> {
    const targetRegions = regions || await this.getRegions();

    const [rds, dynamodb, elasticache, redshift, documentdb, neptune] = await Promise.all([
      this.auditRDS(targetRegions),
      this.auditDynamoDB(targetRegions),
      this.auditElastiCache(targetRegions),
      this.auditRedshift(targetRegions),
      this.auditDocumentDB(targetRegions),
      this.auditNeptune(targetRegions)
    ]);

    return this.buildResult({
      rds,
      dynamodb,
      elasticache,
      redshift,
      documentdb,
      neptune
    });
  }

  private async auditRDS(regions: string[]): Promise<any> {
    const instances: any[] = [];
    const clusters: any[] = [];
    const snapshots: any[] = [];
    const reservedInstances: any[] = [];

    for (const region of regions) {
      const client = new RDSClient(this.getClientConfig(region));

      // Instances
      const instancesResponse = await this.safeApiCall(
        () => client.send(new DescribeDBInstancesCommand({})),
        `RDS instances ${region}`
      );

      if (instancesResponse?.DBInstances) {
        for (const db of instancesResponse.DBInstances) {
          instances.push({
            dbInstanceId: db.DBInstanceIdentifier,
            dbInstanceClass: db.DBInstanceClass,
            engine: db.Engine,
            engineVersion: db.EngineVersion,
            status: db.DBInstanceStatus,
            multiAZ: db.MultiAZ,
            allocatedStorage: db.AllocatedStorage,
            storageType: db.StorageType,
            storageEncrypted: db.StorageEncrypted,
            publiclyAccessible: db.PubliclyAccessible,
            backupRetentionPeriod: db.BackupRetentionPeriod,
            region
          });

          // Issues
          if (!db.MultiAZ && db.DBInstanceStatus === 'available') {
            this.addIssue({
              type: 'RDS_NO_MULTI_AZ',
              severity: 'MEDIUM',
              message: `RDS sans Multi-AZ: ${db.DBInstanceIdentifier}`,
              resources: [db.DBInstanceIdentifier!],
              recommendation: 'Activer Multi-AZ pour la haute disponibilité'
            });
          }

          if (db.PubliclyAccessible) {
            this.addIssue({
              type: 'RDS_PUBLICLY_ACCESSIBLE',
              severity: 'HIGH',
              message: `RDS accessible publiquement: ${db.DBInstanceIdentifier}`,
              resources: [db.DBInstanceIdentifier!],
              recommendation: 'Désactiver l\'accès public sauf si nécessaire'
            });
          }

          if (!db.StorageEncrypted) {
            this.addIssue({
              type: 'RDS_NOT_ENCRYPTED',
              severity: 'MEDIUM',
              message: `RDS non chiffré: ${db.DBInstanceIdentifier}`,
              resources: [db.DBInstanceIdentifier!],
              recommendation: 'Activer le chiffrement du stockage'
            });
          }
        }
      }

      // Clusters Aurora
      const clustersResponse = await this.safeApiCall(
        () => client.send(new DescribeDBClustersCommand({})),
        `RDS clusters ${region}`
      );

      if (clustersResponse?.DBClusters) {
        for (const cluster of clustersResponse.DBClusters) {
          clusters.push({
            dbClusterId: cluster.DBClusterIdentifier,
            engine: cluster.Engine,
            engineVersion: cluster.EngineVersion,
            status: cluster.Status,
            multiAZ: cluster.MultiAZ,
            storageEncrypted: cluster.StorageEncrypted,
            members: cluster.DBClusterMembers?.length || 0,
            region
          });
        }
      }

      // Snapshots manuels
      const snapshotsResponse = await this.safeApiCall(
        () => client.send(new DescribeDBSnapshotsCommand({ SnapshotType: 'manual' })),
        `RDS snapshots ${region}`
      );

      if (snapshotsResponse?.DBSnapshots) {
        for (const snapshot of snapshotsResponse.DBSnapshots) {
          snapshots.push({
            snapshotId: snapshot.DBSnapshotIdentifier,
            dbInstanceId: snapshot.DBInstanceIdentifier,
            engine: snapshot.Engine,
            status: snapshot.Status,
            allocatedStorage: snapshot.AllocatedStorage,
            snapshotCreateTime: snapshot.SnapshotCreateTime?.toISOString(),
            encrypted: snapshot.Encrypted,
            region
          });
        }
      }

      // Reserved Instances
      const riResponse = await this.safeApiCall(
        () => client.send(new DescribeReservedDBInstancesCommand({})),
        `RDS reserved ${region}`
      );

      if (riResponse?.ReservedDBInstances) {
        for (const ri of riResponse.ReservedDBInstances) {
          reservedInstances.push({
            reservedId: ri.ReservedDBInstanceId,
            dbInstanceClass: ri.DBInstanceClass,
            duration: ri.Duration,
            state: ri.State,
            instanceCount: ri.DBInstanceCount,
            offeringType: ri.OfferingType,
            region
          });
        }
      }
    }

    return {
      instances,
      clusters,
      snapshots,
      reservedInstances,
      summary: {
        totalInstances: instances.length,
        totalClusters: clusters.length,
        totalSnapshots: snapshots.length,
        totalReserved: reservedInstances.length,
        instancesByEngine: this.countBy(instances, 'engine'),
        totalStorageGB: instances.reduce((sum, i) => sum + (i.allocatedStorage || 0), 0)
      }
    };
  }

  private async auditDynamoDB(regions: string[]): Promise<any> {
    const tables: any[] = [];

    for (const region of regions) {
      const client = new DynamoDBClient(this.getClientConfig(region));

      const listResponse = await this.safeApiCall(
        () => client.send(new ListTablesCommand({})),
        `DynamoDB list ${region}`
      );

      if (listResponse?.TableNames) {
        for (const tableName of listResponse.TableNames) {
          const describeResponse = await this.safeApiCall(
            () => client.send(new DescribeTableCommand({ TableName: tableName })),
            `DynamoDB describe ${tableName}`
          );

          if (describeResponse?.Table) {
            const table = describeResponse.Table;
            tables.push({
              tableName: table.TableName,
              status: table.TableStatus,
              itemCount: table.ItemCount,
              sizeBytes: table.TableSizeBytes,
              billingMode: table.BillingModeSummary?.BillingMode || 'PROVISIONED',
              readCapacity: table.ProvisionedThroughput?.ReadCapacityUnits,
              writeCapacity: table.ProvisionedThroughput?.WriteCapacityUnits,
              globalSecondaryIndexes: table.GlobalSecondaryIndexes?.length || 0,
              region
            });
          }
        }
      }
    }

    return {
      tables,
      summary: {
        totalTables: tables.length,
        totalSizeBytes: tables.reduce((sum, t) => sum + (t.sizeBytes || 0), 0),
        totalItems: tables.reduce((sum, t) => sum + (t.itemCount || 0), 0),
        byBillingMode: this.countBy(tables, 'billingMode')
      }
    };
  }

  private async auditElastiCache(regions: string[]): Promise<any> {
    const clusters: any[] = [];
    const reserved: any[] = [];

    for (const region of regions) {
      const client = new ElastiCacheClient(this.getClientConfig(region));

      const clustersResponse = await this.safeApiCall(
        () => client.send(new DescribeCacheClustersCommand({})),
        `ElastiCache clusters ${region}`
      );

      if (clustersResponse?.CacheClusters) {
        for (const cluster of clustersResponse.CacheClusters) {
          clusters.push({
            clusterId: cluster.CacheClusterId,
            engine: cluster.Engine,
            engineVersion: cluster.EngineVersion,
            cacheNodeType: cluster.CacheNodeType,
            numCacheNodes: cluster.NumCacheNodes,
            status: cluster.CacheClusterStatus,
            region
          });
        }
      }

      const reservedResponse = await this.safeApiCall(
        () => client.send(new DescribeReservedCacheNodesCommand({})),
        `ElastiCache reserved ${region}`
      );

      if (reservedResponse?.ReservedCacheNodes) {
        for (const r of reservedResponse.ReservedCacheNodes) {
          reserved.push({
            reservedId: r.ReservedCacheNodeId,
            cacheNodeType: r.CacheNodeType,
            state: r.State,
            nodeCount: r.CacheNodeCount,
            region
          });
        }
      }
    }

    return {
      clusters,
      reserved,
      summary: {
        totalClusters: clusters.length,
        totalReserved: reserved.length,
        byEngine: this.countBy(clusters, 'engine')
      }
    };
  }

  private async auditRedshift(regions: string[]): Promise<any> {
    const clusters: any[] = [];

    for (const region of regions) {
      const client = new RedshiftClient(this.getClientConfig(region));

      const response = await this.safeApiCall(
        () => client.send(new RedshiftDescribeClustersCommand({})),
        `Redshift ${region}`
      );

      if (response?.Clusters) {
        for (const cluster of response.Clusters) {
          clusters.push({
            clusterId: cluster.ClusterIdentifier,
            nodeType: cluster.NodeType,
            numberOfNodes: cluster.NumberOfNodes,
            status: cluster.ClusterStatus,
            encrypted: cluster.Encrypted,
            publiclyAccessible: cluster.PubliclyAccessible,
            region
          });

          if (cluster.PubliclyAccessible) {
            this.addIssue({
              type: 'REDSHIFT_PUBLICLY_ACCESSIBLE',
              severity: 'HIGH',
              message: `Redshift accessible publiquement: ${cluster.ClusterIdentifier}`,
              resources: [cluster.ClusterIdentifier!],
              recommendation: 'Désactiver l\'accès public'
            });
          }
        }
      }
    }

    return {
      clusters,
      summary: {
        totalClusters: clusters.length,
        totalNodes: clusters.reduce((sum, c) => sum + (c.numberOfNodes || 0), 0)
      }
    };
  }

  private async auditDocumentDB(regions: string[]): Promise<any> {
    const clusters: any[] = [];

    for (const region of regions) {
      const client = new DocDBClient(this.getClientConfig(region));

      const response = await this.safeApiCall(
        () => client.send(new DocDBDescribeClustersCommand({})),
        `DocumentDB ${region}`
      );

      if (response?.DBClusters) {
        for (const cluster of response.DBClusters) {
          clusters.push({
            clusterId: cluster.DBClusterIdentifier,
            engine: cluster.Engine,
            engineVersion: cluster.EngineVersion,
            status: cluster.Status,
            storageEncrypted: cluster.StorageEncrypted,
            members: cluster.DBClusterMembers?.length || 0,
            region
          });
        }
      }
    }

    return {
      clusters,
      summary: {
        totalClusters: clusters.length
      }
    };
  }

  private async auditNeptune(regions: string[]): Promise<any> {
    const clusters: any[] = [];

    for (const region of regions) {
      const client = new NeptuneClient(this.getClientConfig(region));

      const response = await this.safeApiCall(
        () => client.send(new NeptuneDescribeClustersCommand({})),
        `Neptune ${region}`
      );

      if (response?.DBClusters) {
        for (const cluster of response.DBClusters) {
          clusters.push({
            clusterId: cluster.DBClusterIdentifier,
            engine: cluster.Engine,
            status: cluster.Status,
            storageEncrypted: cluster.StorageEncrypted,
            members: cluster.DBClusterMembers?.length || 0,
            region
          });
        }
      }
    }

    return {
      clusters,
      summary: {
        totalClusters: clusters.length
      }
    };
  }

  private countBy(items: any[], key: string): Record<string, number> {
    return items.reduce((acc, item) => {
      const value = item[key] || 'unknown';
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {});
  }
}
