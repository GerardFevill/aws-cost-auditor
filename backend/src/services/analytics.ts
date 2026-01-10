/**
 * Service d'audit Analytics (Athena, EMR, Kinesis, OpenSearch, Glue)
 */

import {
  AthenaClient,
  ListWorkGroupsCommand
} from '@aws-sdk/client-athena';
import {
  EMRClient,
  ListClustersCommand
} from '@aws-sdk/client-emr';
import {
  KinesisClient,
  ListStreamsCommand,
  DescribeStreamSummaryCommand
} from '@aws-sdk/client-kinesis';
import {
  OpenSearchClient,
  ListDomainNamesCommand,
  DescribeDomainCommand
} from '@aws-sdk/client-opensearch';
import {
  GlueClient,
  GetJobsCommand,
  GetCrawlersCommand,
  GetDatabasesCommand
} from '@aws-sdk/client-glue';
import { BaseAuditor } from './base';

export class AnalyticsAuditor extends BaseAuditor {
  get serviceName() { return 'Analytics'; }
  get category() { return 'analytics'; }

  async audit(regions?: string[]): Promise<any> {
    const targetRegions = regions || await this.getRegions();

    const [athena, emr, kinesis, opensearch, glue] = await Promise.all([
      this.auditAthena(targetRegions),
      this.auditEMR(targetRegions),
      this.auditKinesis(targetRegions),
      this.auditOpenSearch(targetRegions),
      this.auditGlue(targetRegions)
    ]);

    return this.buildResult({
      athena,
      emr,
      kinesis,
      opensearch,
      glue
    });
  }

  private async auditAthena(regions: string[]): Promise<any> {
    const workgroups: any[] = [];

    for (const region of regions) {
      const client = new AthenaClient(this.getClientConfig(region));

      const response = await this.safeApiCall(
        () => client.send(new ListWorkGroupsCommand({})),
        `Athena ${region}`
      );

      if (response?.WorkGroups) {
        for (const wg of response.WorkGroups) {
          workgroups.push({
            name: wg.Name,
            state: wg.State,
            description: wg.Description,
            region
          });
        }
      }
    }

    return {
      workgroups,
      summary: {
        totalWorkgroups: workgroups.length
      }
    };
  }

  private async auditEMR(regions: string[]): Promise<any> {
    const clusters: any[] = [];

    for (const region of regions) {
      const client = new EMRClient(this.getClientConfig(region));

      const response = await this.safeApiCall(
        () => client.send(new ListClustersCommand({
          ClusterStates: ['STARTING', 'BOOTSTRAPPING', 'RUNNING', 'WAITING']
        })),
        `EMR ${region}`
      );

      if (response?.Clusters) {
        for (const cluster of response.Clusters) {
          clusters.push({
            id: cluster.Id,
            name: cluster.Name,
            status: cluster.Status?.State,
            normalizedInstanceHours: cluster.NormalizedInstanceHours,
            region
          });

          // Les clusters EMR actifs sont coûteux
          if (cluster.Status?.State === 'WAITING') {
            this.addIssue({
              type: 'EMR_WAITING',
              severity: 'MEDIUM',
              message: `Cluster EMR en attente: ${cluster.Name}`,
              resources: [cluster.Id!],
              recommendation: 'Terminer les clusters EMR inutilisés'
            });
          }
        }
      }
    }

    return {
      clusters,
      summary: {
        totalClusters: clusters.length,
        runningClusters: clusters.filter(c => c.status === 'RUNNING').length,
        waitingClusters: clusters.filter(c => c.status === 'WAITING').length
      }
    };
  }

  private async auditKinesis(regions: string[]): Promise<any> {
    const streams: any[] = [];

    for (const region of regions) {
      const client = new KinesisClient(this.getClientConfig(region));

      const listResponse = await this.safeApiCall(
        () => client.send(new ListStreamsCommand({})),
        `Kinesis ${region}`
      );

      if (listResponse?.StreamNames) {
        for (const streamName of listResponse.StreamNames) {
          const describeResponse = await this.safeApiCall(
            () => client.send(new DescribeStreamSummaryCommand({ StreamName: streamName })),
            `Kinesis describe ${streamName}`
          );

          if (describeResponse?.StreamDescriptionSummary) {
            const summary = describeResponse.StreamDescriptionSummary;
            streams.push({
              streamName: summary.StreamName,
              streamARN: summary.StreamARN,
              streamStatus: summary.StreamStatus,
              openShardCount: summary.OpenShardCount,
              retentionPeriodHours: summary.RetentionPeriodHours,
              streamModeDetails: summary.StreamModeDetails?.StreamMode,
              region
            });
          }
        }
      }
    }

    return {
      streams,
      summary: {
        totalStreams: streams.length,
        totalShards: streams.reduce((sum, s) => sum + (s.openShardCount || 0), 0)
      }
    };
  }

  private async auditOpenSearch(regions: string[]): Promise<any> {
    const domains: any[] = [];

    for (const region of regions) {
      const client = new OpenSearchClient(this.getClientConfig(region));

      const listResponse = await this.safeApiCall(
        () => client.send(new ListDomainNamesCommand({})),
        `OpenSearch ${region}`
      );

      if (listResponse?.DomainNames) {
        for (const domain of listResponse.DomainNames) {
          const describeResponse = await this.safeApiCall(
            () => client.send(new DescribeDomainCommand({ DomainName: domain.DomainName })),
            `OpenSearch describe ${domain.DomainName}`
          );

          if (describeResponse?.DomainStatus) {
            const status = describeResponse.DomainStatus;
            domains.push({
              domainId: status.DomainId,
              domainName: status.DomainName,
              engineVersion: status.EngineVersion,
              instanceType: status.ClusterConfig?.InstanceType,
              instanceCount: status.ClusterConfig?.InstanceCount,
              dedicatedMasterEnabled: status.ClusterConfig?.DedicatedMasterEnabled,
              zoneAwarenessEnabled: status.ClusterConfig?.ZoneAwarenessEnabled,
              encryptionEnabled: status.EncryptionAtRestOptions?.Enabled,
              region
            });
          }
        }
      }
    }

    return {
      domains,
      summary: {
        totalDomains: domains.length,
        totalInstances: domains.reduce((sum, d) => sum + (d.instanceCount || 0), 0)
      }
    };
  }

  private async auditGlue(regions: string[]): Promise<any> {
    const jobs: any[] = [];
    const crawlers: any[] = [];
    const databases: any[] = [];

    for (const region of regions) {
      const client = new GlueClient(this.getClientConfig(region));

      // Jobs
      const jobsResponse = await this.safeApiCall(
        () => client.send(new GetJobsCommand({})),
        `Glue jobs ${region}`
      );

      if (jobsResponse?.Jobs) {
        for (const job of jobsResponse.Jobs) {
          jobs.push({
            name: job.Name,
            role: job.Role,
            command: job.Command?.Name,
            maxCapacity: job.MaxCapacity,
            workerType: job.WorkerType,
            numberOfWorkers: job.NumberOfWorkers,
            region
          });
        }
      }

      // Crawlers
      const crawlersResponse = await this.safeApiCall(
        () => client.send(new GetCrawlersCommand({})),
        `Glue crawlers ${region}`
      );

      if (crawlersResponse?.Crawlers) {
        for (const crawler of crawlersResponse.Crawlers) {
          crawlers.push({
            name: crawler.Name,
            state: crawler.State,
            databaseName: crawler.DatabaseName,
            schedule: crawler.Schedule?.ScheduleExpression,
            region
          });
        }
      }

      // Databases
      const dbResponse = await this.safeApiCall(
        () => client.send(new GetDatabasesCommand({})),
        `Glue databases ${region}`
      );

      if (dbResponse?.DatabaseList) {
        for (const db of dbResponse.DatabaseList) {
          databases.push({
            name: db.Name,
            description: db.Description,
            locationUri: db.LocationUri,
            region
          });
        }
      }
    }

    return {
      jobs,
      crawlers,
      databases,
      summary: {
        totalJobs: jobs.length,
        totalCrawlers: crawlers.length,
        totalDatabases: databases.length
      }
    };
  }
}
