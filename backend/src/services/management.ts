/**
 * Service d'audit Management (CloudWatch, CloudTrail, Config, SSM, Organizations)
 */

import {
  CloudWatchClient,
  DescribeAlarmsCommand,
  ListDashboardsCommand
} from '@aws-sdk/client-cloudwatch';
import {
  CloudWatchLogsClient,
  DescribeLogGroupsCommand
} from '@aws-sdk/client-cloudwatch-logs';
import {
  CloudTrailClient,
  DescribeTrailsCommand,
  GetTrailStatusCommand
} from '@aws-sdk/client-cloudtrail';
import {
  ConfigServiceClient,
  DescribeConfigRulesCommand,
  DescribeConfigurationRecordersCommand
} from '@aws-sdk/client-config-service';
import {
  SSMClient,
  DescribeInstanceInformationCommand,
  ListDocumentsCommand
} from '@aws-sdk/client-ssm';
import {
  OrganizationsClient,
  DescribeOrganizationCommand,
  ListAccountsCommand
} from '@aws-sdk/client-organizations';
import { BaseAuditor } from './base';

export class ManagementAuditor extends BaseAuditor {
  get serviceName() { return 'Management'; }
  get category() { return 'management'; }

  async audit(regions?: string[]): Promise<any> {
    const targetRegions = regions || await this.getRegions();

    const [cloudwatch, cloudwatchLogs, cloudtrail, config, ssm, organizations] = await Promise.all([
      this.auditCloudWatch(targetRegions),
      this.auditCloudWatchLogs(targetRegions),
      this.auditCloudTrail(targetRegions),
      this.auditConfig(targetRegions),
      this.auditSSM(targetRegions),
      this.auditOrganizations()
    ]);

    return this.buildResult({
      cloudwatch,
      cloudwatchLogs,
      cloudtrail,
      config,
      ssm,
      organizations
    });
  }

  private async auditCloudWatch(regions: string[]): Promise<any> {
    const alarms: any[] = [];
    const dashboards: any[] = [];

    for (const region of regions) {
      const client = new CloudWatchClient(this.getClientConfig(region));

      // Alarms
      const alarmsResponse = await this.safeApiCall(
        () => client.send(new DescribeAlarmsCommand({})),
        `CloudWatch alarms ${region}`
      );

      if (alarmsResponse?.MetricAlarms) {
        for (const alarm of alarmsResponse.MetricAlarms) {
          alarms.push({
            alarmName: alarm.AlarmName,
            alarmArn: alarm.AlarmArn,
            stateValue: alarm.StateValue,
            metricName: alarm.MetricName,
            namespace: alarm.Namespace,
            actionsEnabled: alarm.ActionsEnabled,
            region
          });
        }
      }

      // Dashboards
      const dashboardsResponse = await this.safeApiCall(
        () => client.send(new ListDashboardsCommand({})),
        `CloudWatch dashboards ${region}`
      );

      if (dashboardsResponse?.DashboardEntries) {
        for (const dashboard of dashboardsResponse.DashboardEntries) {
          dashboards.push({
            dashboardName: dashboard.DashboardName,
            dashboardArn: dashboard.DashboardArn,
            lastModified: dashboard.LastModified?.toISOString(),
            region
          });
        }
      }
    }

    return {
      alarms,
      dashboards,
      summary: {
        totalAlarms: alarms.length,
        alarmsInAlarm: alarms.filter(a => a.stateValue === 'ALARM').length,
        alarmsOK: alarms.filter(a => a.stateValue === 'OK').length,
        totalDashboards: dashboards.length
      }
    };
  }

  private async auditCloudWatchLogs(regions: string[]): Promise<any> {
    const logGroups: any[] = [];

    for (const region of regions) {
      const client = new CloudWatchLogsClient(this.getClientConfig(region));

      const response = await this.safeApiCall(
        () => client.send(new DescribeLogGroupsCommand({})),
        `CloudWatch Logs ${region}`
      );

      if (response?.logGroups) {
        for (const lg of response.logGroups) {
          logGroups.push({
            logGroupName: lg.logGroupName,
            arn: lg.arn,
            storedBytes: lg.storedBytes,
            retentionInDays: lg.retentionInDays,
            creationTime: lg.creationTime,
            region
          });

          // Log groups sans rétention (conservation infinie = coûts)
          if (!lg.retentionInDays) {
            this.addIssue({
              type: 'LOG_GROUP_NO_RETENTION',
              severity: 'LOW',
              message: `Log group sans limite de rétention: ${lg.logGroupName}`,
              resources: [lg.arn!],
              recommendation: 'Configurer une politique de rétention'
            });
          }
        }
      }
    }

    const totalStoredBytes = logGroups.reduce((sum, lg) => sum + (lg.storedBytes || 0), 0);

    return {
      logGroups,
      summary: {
        totalLogGroups: logGroups.length,
        totalStoredBytes,
        totalStoredGB: Math.round(totalStoredBytes / (1024 * 1024 * 1024) * 100) / 100,
        withRetention: logGroups.filter(lg => lg.retentionInDays).length,
        withoutRetention: logGroups.filter(lg => !lg.retentionInDays).length
      }
    };
  }

  private async auditCloudTrail(regions: string[]): Promise<any> {
    const trails: any[] = [];

    for (const region of regions) {
      const client = new CloudTrailClient(this.getClientConfig(region));

      const response = await this.safeApiCall(
        () => client.send(new DescribeTrailsCommand({})),
        `CloudTrail ${region}`
      );

      if (response?.trailList) {
        for (const trail of response.trailList) {
          // Get trail status
          const statusResponse = await this.safeApiCall(
            () => client.send(new GetTrailStatusCommand({ Name: trail.Name })),
            `CloudTrail status ${trail.Name}`
          );

          trails.push({
            name: trail.Name,
            homeRegion: trail.HomeRegion,
            s3BucketName: trail.S3BucketName,
            isMultiRegionTrail: trail.IsMultiRegionTrail,
            isOrganizationTrail: trail.IsOrganizationTrail,
            includeGlobalServiceEvents: trail.IncludeGlobalServiceEvents,
            logFileValidationEnabled: trail.LogFileValidationEnabled,
            isLogging: statusResponse?.IsLogging,
            region
          });

          // Trail non actif
          if (!statusResponse?.IsLogging) {
            this.addIssue({
              type: 'CLOUDTRAIL_NOT_LOGGING',
              severity: 'HIGH',
              message: `CloudTrail non actif: ${trail.Name}`,
              resources: [trail.TrailARN!],
              recommendation: 'Activer le logging CloudTrail'
            });
          }
        }
      }
    }

    return {
      trails,
      summary: {
        totalTrails: trails.length,
        activeTrails: trails.filter(t => t.isLogging).length,
        multiRegionTrails: trails.filter(t => t.isMultiRegionTrail).length
      }
    };
  }

  private async auditConfig(regions: string[]): Promise<any> {
    const rules: any[] = [];
    const recorders: any[] = [];

    for (const region of regions) {
      const client = new ConfigServiceClient(this.getClientConfig(region));

      // Config Rules
      const rulesResponse = await this.safeApiCall(
        () => client.send(new DescribeConfigRulesCommand({})),
        `Config rules ${region}`
      );

      if (rulesResponse?.ConfigRules) {
        for (const rule of rulesResponse.ConfigRules) {
          rules.push({
            configRuleName: rule.ConfigRuleName,
            configRuleArn: rule.ConfigRuleArn,
            configRuleState: rule.ConfigRuleState,
            source: rule.Source?.Owner,
            region
          });
        }
      }

      // Configuration Recorders
      const recordersResponse = await this.safeApiCall(
        () => client.send(new DescribeConfigurationRecordersCommand({})),
        `Config recorders ${region}`
      );

      if (recordersResponse?.ConfigurationRecorders) {
        for (const recorder of recordersResponse.ConfigurationRecorders) {
          recorders.push({
            name: recorder.name,
            roleARN: recorder.roleARN,
            recordingGroup: recorder.recordingGroup,
            region
          });
        }
      }
    }

    return {
      rules,
      recorders,
      summary: {
        totalRules: rules.length,
        activeRules: rules.filter(r => r.configRuleState === 'ACTIVE').length,
        totalRecorders: recorders.length
      }
    };
  }

  private async auditSSM(regions: string[]): Promise<any> {
    const managedInstances: any[] = [];
    const documents: any[] = [];

    for (const region of regions) {
      const client = new SSMClient(this.getClientConfig(region));

      // Managed Instances
      const instancesResponse = await this.safeApiCall(
        () => client.send(new DescribeInstanceInformationCommand({})),
        `SSM instances ${region}`
      );

      if (instancesResponse?.InstanceInformationList) {
        for (const instance of instancesResponse.InstanceInformationList) {
          managedInstances.push({
            instanceId: instance.InstanceId,
            pingStatus: instance.PingStatus,
            platformType: instance.PlatformType,
            platformName: instance.PlatformName,
            platformVersion: instance.PlatformVersion,
            agentVersion: instance.AgentVersion,
            region
          });
        }
      }

      // SSM Documents (custom only)
      const docsResponse = await this.safeApiCall(
        () => client.send(new ListDocumentsCommand({
          Filters: [{ Key: 'Owner', Values: ['Self'] }]
        })),
        `SSM documents ${region}`
      );

      if (docsResponse?.DocumentIdentifiers) {
        for (const doc of docsResponse.DocumentIdentifiers) {
          documents.push({
            name: doc.Name,
            documentType: doc.DocumentType,
            documentFormat: doc.DocumentFormat,
            owner: doc.Owner,
            region
          });
        }
      }
    }

    return {
      managedInstances,
      documents,
      summary: {
        totalManagedInstances: managedInstances.length,
        onlineInstances: managedInstances.filter(i => i.pingStatus === 'Online').length,
        totalDocuments: documents.length
      }
    };
  }

  private async auditOrganizations(): Promise<any> {
    const client = new OrganizationsClient(this.getClientConfig('us-east-1'));

    // Organization info
    const orgResponse = await this.safeApiCall(
      () => client.send(new DescribeOrganizationCommand({})),
      'Organizations'
    );

    if (!orgResponse?.Organization) {
      return {
        enabled: false,
        organization: null,
        accounts: [],
        summary: { totalAccounts: 0 }
      };
    }

    const organization = {
      id: orgResponse.Organization.Id,
      arn: orgResponse.Organization.Arn,
      masterAccountId: orgResponse.Organization.MasterAccountId,
      masterAccountEmail: orgResponse.Organization.MasterAccountEmail,
      featureSet: orgResponse.Organization.FeatureSet
    };

    // List accounts
    const accounts: any[] = [];
    const accountsResponse = await this.safeApiCall(
      () => client.send(new ListAccountsCommand({})),
      'Organizations accounts'
    );

    if (accountsResponse?.Accounts) {
      for (const account of accountsResponse.Accounts) {
        accounts.push({
          id: account.Id,
          arn: account.Arn,
          name: account.Name,
          email: account.Email,
          status: account.Status,
          joinedMethod: account.JoinedMethod,
          joinedTimestamp: account.JoinedTimestamp?.toISOString()
        });
      }
    }

    return {
      enabled: true,
      organization,
      accounts,
      summary: {
        totalAccounts: accounts.length,
        activeAccounts: accounts.filter(a => a.status === 'ACTIVE').length
      }
    };
  }
}
