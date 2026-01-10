/**
 * Service d'audit Compute (EC2, Lambda, ECS, EKS, etc.)
 */

import {
  EC2Client,
  DescribeInstancesCommand,
  DescribeVolumesCommand,
  DescribeSnapshotsCommand,
  DescribeAddressesCommand,
  DescribeNatGatewaysCommand,
  DescribeImagesCommand
} from '@aws-sdk/client-ec2';
import {
  LambdaClient,
  ListFunctionsCommand,
  GetFunctionCommand
} from '@aws-sdk/client-lambda';
import {
  ECSClient,
  ListClustersCommand,
  DescribeClustersCommand,
  ListServicesCommand
} from '@aws-sdk/client-ecs';
import {
  EKSClient,
  ListClustersCommand as EKSListClustersCommand,
  DescribeClusterCommand
} from '@aws-sdk/client-eks';
import { LightsailClient, GetInstancesCommand } from '@aws-sdk/client-lightsail';
import { BatchClient, DescribeComputeEnvironmentsCommand } from '@aws-sdk/client-batch';
import { BaseAuditor } from './base';

export class ComputeAuditor extends BaseAuditor {
  get serviceName() { return 'Compute'; }
  get category() { return 'compute'; }

  async audit(regions?: string[]): Promise<any> {
    const targetRegions = regions || await this.getRegions();

    const allEC2 = await this.auditEC2(targetRegions);
    const allLambda = await this.auditLambda(targetRegions);
    const allECS = await this.auditECS(targetRegions);
    const allEKS = await this.auditEKS(targetRegions);
    const allLightsail = await this.auditLightsail(targetRegions);
    const allBatch = await this.auditBatch(targetRegions);

    return this.buildResult({
      ec2: allEC2,
      lambda: allLambda,
      ecs: allECS,
      eks: allEKS,
      lightsail: allLightsail,
      batch: allBatch
    });
  }

  private async auditEC2(regions: string[]): Promise<any> {
    const instances: any[] = [];
    const volumes: any[] = [];
    const snapshots: any[] = [];
    const elasticIps: any[] = [];
    const natGateways: any[] = [];

    for (const region of regions) {
      const client = new EC2Client(this.getClientConfig(region));

      // Instances
      const instancesResponse = await this.safeApiCall(
        () => client.send(new DescribeInstancesCommand({})),
        `EC2 instances ${region}`
      );

      if (instancesResponse?.Reservations) {
        for (const reservation of instancesResponse.Reservations) {
          for (const instance of reservation.Instances || []) {
            const name = instance.Tags?.find(t => t.Key === 'Name')?.Value || '';
            instances.push({
              instanceId: instance.InstanceId,
              name,
              type: instance.InstanceType,
              state: instance.State?.Name,
              region,
              launchTime: instance.LaunchTime?.toISOString(),
              privateIp: instance.PrivateIpAddress,
              publicIp: instance.PublicIpAddress,
              platform: instance.Platform || 'linux',
              tags: instance.Tags
            });

            // Détecter les instances arrêtées
            if (instance.State?.Name === 'stopped') {
              this.addIssue({
                type: 'STOPPED_INSTANCE',
                severity: 'MEDIUM',
                message: `Instance arrêtée: ${instance.InstanceId} (${name})`,
                resources: [instance.InstanceId!],
                recommendation: 'Supprimer ou redémarrer les instances arrêtées'
              });
            }
          }
        }
      }

      // Volumes
      const volumesResponse = await this.safeApiCall(
        () => client.send(new DescribeVolumesCommand({})),
        `EBS volumes ${region}`
      );

      if (volumesResponse?.Volumes) {
        for (const volume of volumesResponse.Volumes) {
          const attached = (volume.Attachments?.length || 0) > 0;
          volumes.push({
            volumeId: volume.VolumeId,
            size: volume.Size,
            type: volume.VolumeType,
            state: volume.State,
            attached,
            attachedTo: volume.Attachments?.[0]?.InstanceId,
            region,
            encrypted: volume.Encrypted
          });

          // Détecter les volumes non attachés
          if (!attached && volume.State === 'available') {
            this.addIssue({
              type: 'UNATTACHED_VOLUME',
              severity: 'HIGH',
              message: `Volume non attaché: ${volume.VolumeId} (${volume.Size}GB)`,
              resources: [volume.VolumeId!],
              potentialSavings: (volume.Size || 0) * 0.10, // ~$0.10/GB/mois
              recommendation: 'Supprimer les volumes non utilisés'
            });
          }
        }
      }

      // Snapshots
      const snapshotsResponse = await this.safeApiCall(
        () => client.send(new DescribeSnapshotsCommand({ OwnerIds: ['self'] })),
        `EBS snapshots ${region}`
      );

      if (snapshotsResponse?.Snapshots) {
        for (const snapshot of snapshotsResponse.Snapshots) {
          snapshots.push({
            snapshotId: snapshot.SnapshotId,
            volumeId: snapshot.VolumeId,
            size: snapshot.VolumeSize,
            state: snapshot.State,
            startTime: snapshot.StartTime?.toISOString(),
            region,
            encrypted: snapshot.Encrypted
          });
        }

        // Détecter les vieux snapshots
        const oldSnapshots = snapshotsResponse.Snapshots.filter(s => {
          if (!s.StartTime) return false;
          const age = Date.now() - s.StartTime.getTime();
          return age > 90 * 24 * 60 * 60 * 1000; // 90 jours
        });

        if (oldSnapshots.length > 0) {
          const totalSize = oldSnapshots.reduce((sum, s) => sum + (s.VolumeSize || 0), 0);
          this.addIssue({
            type: 'OLD_SNAPSHOTS',
            severity: 'LOW',
            message: `${oldSnapshots.length} snapshots de plus de 90 jours (${totalSize}GB)`,
            resources: oldSnapshots.map(s => s.SnapshotId!),
            potentialSavings: totalSize * 0.05,
            recommendation: 'Vérifier et supprimer les snapshots obsolètes'
          });
        }
      }

      // Elastic IPs
      const eipsResponse = await this.safeApiCall(
        () => client.send(new DescribeAddressesCommand({})),
        `Elastic IPs ${region}`
      );

      if (eipsResponse?.Addresses) {
        for (const eip of eipsResponse.Addresses) {
          const associated = !!eip.AssociationId;
          elasticIps.push({
            allocationId: eip.AllocationId,
            publicIp: eip.PublicIp,
            associated,
            instanceId: eip.InstanceId,
            region
          });

          if (!associated) {
            this.addIssue({
              type: 'UNUSED_ELASTIC_IP',
              severity: 'MEDIUM',
              message: `Elastic IP non associée: ${eip.PublicIp}`,
              resources: [eip.AllocationId!],
              potentialSavings: 3.65, // ~$3.65/mois
              recommendation: 'Associer ou libérer les Elastic IPs inutilisées'
            });
          }
        }
      }

      // NAT Gateways
      const natResponse = await this.safeApiCall(
        () => client.send(new DescribeNatGatewaysCommand({})),
        `NAT Gateways ${region}`
      );

      if (natResponse?.NatGateways) {
        for (const nat of natResponse.NatGateways) {
          natGateways.push({
            natGatewayId: nat.NatGatewayId,
            state: nat.State,
            vpcId: nat.VpcId,
            subnetId: nat.SubnetId,
            region
          });
        }
      }
    }

    return {
      instances,
      volumes,
      snapshots,
      elasticIps,
      natGateways,
      summary: {
        totalInstances: instances.length,
        runningInstances: instances.filter(i => i.state === 'running').length,
        stoppedInstances: instances.filter(i => i.state === 'stopped').length,
        totalVolumes: volumes.length,
        unattachedVolumes: volumes.filter(v => !v.attached).length,
        totalSnapshots: snapshots.length,
        totalElasticIps: elasticIps.length,
        unusedElasticIps: elasticIps.filter(e => !e.associated).length,
        totalNatGateways: natGateways.length
      }
    };
  }

  private async auditLambda(regions: string[]): Promise<any> {
    const functions: any[] = [];

    for (const region of regions) {
      const client = new LambdaClient(this.getClientConfig(region));

      const response = await this.safeApiCall(
        () => client.send(new ListFunctionsCommand({})),
        `Lambda functions ${region}`
      );

      if (response?.Functions) {
        for (const fn of response.Functions) {
          functions.push({
            functionName: fn.FunctionName,
            runtime: fn.Runtime,
            memorySize: fn.MemorySize,
            timeout: fn.Timeout,
            codeSize: fn.CodeSize,
            lastModified: fn.LastModified,
            region
          });

          // Détecter les fonctions avec beaucoup de mémoire
          if ((fn.MemorySize || 0) >= 1024) {
            this.addIssue({
              type: 'HIGH_MEMORY_LAMBDA',
              severity: 'INFO',
              message: `Lambda avec ${fn.MemorySize}MB: ${fn.FunctionName}`,
              resources: [fn.FunctionArn!],
              recommendation: 'Vérifier si la mémoire allouée est nécessaire'
            });
          }
        }
      }
    }

    return {
      functions,
      summary: {
        totalFunctions: functions.length,
        byRuntime: this.countBy(functions, 'runtime')
      }
    };
  }

  private async auditECS(regions: string[]): Promise<any> {
    const clusters: any[] = [];

    for (const region of regions) {
      const client = new ECSClient(this.getClientConfig(region));

      const listResponse = await this.safeApiCall(
        () => client.send(new ListClustersCommand({})),
        `ECS clusters ${region}`
      );

      if (listResponse?.clusterArns?.length) {
        const describeResponse = await this.safeApiCall(
          () => client.send(new DescribeClustersCommand({
            clusters: listResponse.clusterArns
          })),
          `ECS describe clusters ${region}`
        );

        if (describeResponse?.clusters) {
          for (const cluster of describeResponse.clusters) {
            clusters.push({
              clusterName: cluster.clusterName,
              status: cluster.status,
              runningTasksCount: cluster.runningTasksCount,
              pendingTasksCount: cluster.pendingTasksCount,
              activeServicesCount: cluster.activeServicesCount,
              registeredContainerInstancesCount: cluster.registeredContainerInstancesCount,
              region
            });
          }
        }
      }
    }

    return {
      clusters,
      summary: {
        totalClusters: clusters.length,
        totalRunningTasks: clusters.reduce((sum, c) => sum + (c.runningTasksCount || 0), 0)
      }
    };
  }

  private async auditEKS(regions: string[]): Promise<any> {
    const clusters: any[] = [];

    for (const region of regions) {
      const client = new EKSClient(this.getClientConfig(region));

      const listResponse = await this.safeApiCall(
        () => client.send(new EKSListClustersCommand({})),
        `EKS clusters ${region}`
      );

      if (listResponse?.clusters) {
        for (const clusterName of listResponse.clusters) {
          const describeResponse = await this.safeApiCall(
            () => client.send(new DescribeClusterCommand({ name: clusterName })),
            `EKS describe ${clusterName}`
          );

          if (describeResponse?.cluster) {
            const cluster = describeResponse.cluster;
            clusters.push({
              name: cluster.name,
              status: cluster.status,
              version: cluster.version,
              endpoint: cluster.endpoint,
              createdAt: cluster.createdAt?.toISOString(),
              region
            });
          }
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

  private async auditLightsail(regions: string[]): Promise<any> {
    const instances: any[] = [];

    for (const region of regions) {
      const client = new LightsailClient(this.getClientConfig(region));

      const response = await this.safeApiCall(
        () => client.send(new GetInstancesCommand({})),
        `Lightsail instances ${region}`
      );

      if (response?.instances) {
        for (const instance of response.instances) {
          instances.push({
            name: instance.name,
            blueprintId: instance.blueprintId,
            bundleId: instance.bundleId,
            state: instance.state?.name,
            publicIpAddress: instance.publicIpAddress,
            region: instance.location?.regionName
          });
        }
      }
    }

    return {
      instances,
      summary: {
        totalInstances: instances.length
      }
    };
  }

  private async auditBatch(regions: string[]): Promise<any> {
    const computeEnvironments: any[] = [];

    for (const region of regions) {
      const client = new BatchClient(this.getClientConfig(region));

      const response = await this.safeApiCall(
        () => client.send(new DescribeComputeEnvironmentsCommand({})),
        `Batch compute environments ${region}`
      );

      if (response?.computeEnvironments) {
        for (const env of response.computeEnvironments) {
          computeEnvironments.push({
            name: env.computeEnvironmentName,
            type: env.type,
            state: env.state,
            status: env.status,
            region
          });
        }
      }
    }

    return {
      computeEnvironments,
      summary: {
        totalComputeEnvironments: computeEnvironments.length
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
