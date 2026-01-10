/**
 * Service d'audit Network (VPC, CloudFront, Route53, API Gateway, ELB, etc.)
 */

import {
  EC2Client,
  DescribeVpcsCommand,
  DescribeSubnetsCommand,
  DescribeNatGatewaysCommand,
  DescribeVpnConnectionsCommand,
  DescribeTransitGatewaysCommand
} from '@aws-sdk/client-ec2';
import {
  CloudFrontClient,
  ListDistributionsCommand
} from '@aws-sdk/client-cloudfront';
import {
  Route53Client,
  ListHostedZonesCommand
} from '@aws-sdk/client-route-53';
import {
  APIGatewayClient,
  GetRestApisCommand
} from '@aws-sdk/client-api-gateway';
import {
  ElasticLoadBalancingV2Client,
  DescribeLoadBalancersCommand,
  DescribeTargetGroupsCommand
} from '@aws-sdk/client-elastic-load-balancing-v2';
import { BaseAuditor } from './base';

export class NetworkAuditor extends BaseAuditor {
  get serviceName() { return 'Network'; }
  get category() { return 'network'; }

  async audit(regions?: string[]): Promise<any> {
    const targetRegions = regions || await this.getRegions();

    const [vpc, cloudfront, route53, apiGateway, loadBalancers] = await Promise.all([
      this.auditVPC(targetRegions),
      this.auditCloudFront(),
      this.auditRoute53(),
      this.auditAPIGateway(targetRegions),
      this.auditLoadBalancers(targetRegions)
    ]);

    return this.buildResult({
      vpc,
      cloudfront,
      route53,
      apiGateway,
      loadBalancers
    });
  }

  private async auditVPC(regions: string[]): Promise<any> {
    const vpcs: any[] = [];
    const subnets: any[] = [];
    const natGateways: any[] = [];
    const vpnConnections: any[] = [];
    const transitGateways: any[] = [];

    for (const region of regions) {
      const client = new EC2Client(this.getClientConfig(region));

      // VPCs
      const vpcsResponse = await this.safeApiCall(
        () => client.send(new DescribeVpcsCommand({})),
        `VPCs ${region}`
      );

      if (vpcsResponse?.Vpcs) {
        for (const vpc of vpcsResponse.Vpcs) {
          const name = vpc.Tags?.find(t => t.Key === 'Name')?.Value || '';
          vpcs.push({
            vpcId: vpc.VpcId,
            name,
            cidrBlock: vpc.CidrBlock,
            state: vpc.State,
            isDefault: vpc.IsDefault,
            region
          });
        }
      }

      // Subnets
      const subnetsResponse = await this.safeApiCall(
        () => client.send(new DescribeSubnetsCommand({})),
        `Subnets ${region}`
      );

      if (subnetsResponse?.Subnets) {
        for (const subnet of subnetsResponse.Subnets) {
          const name = subnet.Tags?.find(t => t.Key === 'Name')?.Value || '';
          subnets.push({
            subnetId: subnet.SubnetId,
            name,
            vpcId: subnet.VpcId,
            cidrBlock: subnet.CidrBlock,
            availabilityZone: subnet.AvailabilityZone,
            availableIpAddressCount: subnet.AvailableIpAddressCount,
            mapPublicIpOnLaunch: subnet.MapPublicIpOnLaunch,
            region
          });
        }
      }

      // NAT Gateways
      const natResponse = await this.safeApiCall(
        () => client.send(new DescribeNatGatewaysCommand({})),
        `NAT Gateways ${region}`
      );

      if (natResponse?.NatGateways) {
        for (const nat of natResponse.NatGateways) {
          if (nat.State === 'available' || nat.State === 'pending') {
            natGateways.push({
              natGatewayId: nat.NatGatewayId,
              state: nat.State,
              vpcId: nat.VpcId,
              subnetId: nat.SubnetId,
              connectivityType: nat.ConnectivityType,
              region
            });

            // NAT Gateways sont coûteux
            this.addIssue({
              type: 'NAT_GATEWAY_COST',
              severity: 'INFO',
              message: `NAT Gateway actif: ${nat.NatGatewayId} (~$32/mois + transfert)`,
              resources: [nat.NatGatewayId!],
              potentialSavings: 32,
              recommendation: 'Vérifier si le NAT Gateway est nécessaire'
            });
          }
        }
      }

      // VPN Connections
      const vpnResponse = await this.safeApiCall(
        () => client.send(new DescribeVpnConnectionsCommand({})),
        `VPN ${region}`
      );

      if (vpnResponse?.VpnConnections) {
        for (const vpn of vpnResponse.VpnConnections) {
          vpnConnections.push({
            vpnConnectionId: vpn.VpnConnectionId,
            state: vpn.State,
            type: vpn.Type,
            region
          });
        }
      }

      // Transit Gateways
      const tgwResponse = await this.safeApiCall(
        () => client.send(new DescribeTransitGatewaysCommand({})),
        `Transit Gateways ${region}`
      );

      if (tgwResponse?.TransitGateways) {
        for (const tgw of tgwResponse.TransitGateways) {
          transitGateways.push({
            transitGatewayId: tgw.TransitGatewayId,
            state: tgw.State,
            ownerId: tgw.OwnerId,
            region
          });
        }
      }
    }

    return {
      vpcs,
      subnets,
      natGateways,
      vpnConnections,
      transitGateways,
      summary: {
        totalVpcs: vpcs.length,
        totalSubnets: subnets.length,
        totalNatGateways: natGateways.length,
        totalVpnConnections: vpnConnections.length,
        totalTransitGateways: transitGateways.length
      }
    };
  }

  private async auditCloudFront(): Promise<any> {
    const client = new CloudFrontClient(this.getClientConfig('us-east-1'));
    const distributions: any[] = [];

    const response = await this.safeApiCall(
      () => client.send(new ListDistributionsCommand({})),
      'CloudFront distributions'
    );

    if (response?.DistributionList?.Items) {
      for (const dist of response.DistributionList.Items) {
        distributions.push({
          id: dist.Id,
          domainName: dist.DomainName,
          status: dist.Status,
          enabled: dist.Enabled,
          priceClass: dist.PriceClass,
          httpVersion: dist.HttpVersion,
          origins: dist.Origins?.Items?.length || 0
        });

        // Distribution désactivée mais existante
        if (!dist.Enabled) {
          this.addIssue({
            type: 'DISABLED_CLOUDFRONT',
            severity: 'LOW',
            message: `Distribution CloudFront désactivée: ${dist.Id}`,
            resources: [dist.Id!],
            recommendation: 'Supprimer les distributions inutilisées'
          });
        }
      }
    }

    return {
      distributions,
      summary: {
        totalDistributions: distributions.length,
        enabledDistributions: distributions.filter(d => d.enabled).length
      }
    };
  }

  private async auditRoute53(): Promise<any> {
    const client = new Route53Client(this.getClientConfig('us-east-1'));
    const hostedZones: any[] = [];

    const response = await this.safeApiCall(
      () => client.send(new ListHostedZonesCommand({})),
      'Route53 hosted zones'
    );

    if (response?.HostedZones) {
      for (const zone of response.HostedZones) {
        hostedZones.push({
          id: zone.Id,
          name: zone.Name,
          recordCount: zone.ResourceRecordSetCount,
          isPrivate: zone.Config?.PrivateZone
        });
      }
    }

    return {
      hostedZones,
      summary: {
        totalHostedZones: hostedZones.length,
        publicZones: hostedZones.filter(z => !z.isPrivate).length,
        privateZones: hostedZones.filter(z => z.isPrivate).length
      }
    };
  }

  private async auditAPIGateway(regions: string[]): Promise<any> {
    const apis: any[] = [];

    for (const region of regions) {
      const client = new APIGatewayClient(this.getClientConfig(region));

      const response = await this.safeApiCall(
        () => client.send(new GetRestApisCommand({})),
        `API Gateway ${region}`
      );

      if (response?.items) {
        for (const api of response.items) {
          apis.push({
            id: api.id,
            name: api.name,
            description: api.description,
            createdDate: api.createdDate?.toISOString(),
            apiKeySource: api.apiKeySource,
            endpointConfiguration: api.endpointConfiguration?.types,
            region
          });
        }
      }
    }

    return {
      apis,
      summary: {
        totalApis: apis.length
      }
    };
  }

  private async auditLoadBalancers(regions: string[]): Promise<any> {
    const loadBalancers: any[] = [];
    const targetGroups: any[] = [];

    for (const region of regions) {
      const client = new ElasticLoadBalancingV2Client(this.getClientConfig(region));

      // Load Balancers
      const lbResponse = await this.safeApiCall(
        () => client.send(new DescribeLoadBalancersCommand({})),
        `Load Balancers ${region}`
      );

      if (lbResponse?.LoadBalancers) {
        for (const lb of lbResponse.LoadBalancers) {
          loadBalancers.push({
            arn: lb.LoadBalancerArn,
            name: lb.LoadBalancerName,
            type: lb.Type,
            scheme: lb.Scheme,
            state: lb.State?.Code,
            dnsName: lb.DNSName,
            vpcId: lb.VpcId,
            region
          });
        }
      }

      // Target Groups
      const tgResponse = await this.safeApiCall(
        () => client.send(new DescribeTargetGroupsCommand({})),
        `Target Groups ${region}`
      );

      if (tgResponse?.TargetGroups) {
        for (const tg of tgResponse.TargetGroups) {
          targetGroups.push({
            arn: tg.TargetGroupArn,
            name: tg.TargetGroupName,
            protocol: tg.Protocol,
            port: tg.Port,
            targetType: tg.TargetType,
            vpcId: tg.VpcId,
            region
          });
        }
      }
    }

    return {
      loadBalancers,
      targetGroups,
      summary: {
        totalLoadBalancers: loadBalancers.length,
        byType: this.countBy(loadBalancers, 'type'),
        totalTargetGroups: targetGroups.length
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
