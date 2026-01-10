/**
 * Tests pour les services d'audit AWS
 */

import { AWSCredentials } from '../src/types';
import { AUDITOR_MAP, runAudit } from '../src/services';
import { CostAuditor } from '../src/services/cost';
import { ComputeAuditor } from '../src/services/compute';
import { StorageAuditor } from '../src/services/storage';
import { DatabaseAuditor } from '../src/services/database';
import { NetworkAuditor } from '../src/services/network';
import { SecurityAuditor } from '../src/services/security';

// Mock des clients AWS
jest.mock('@aws-sdk/client-sts', () => ({
  STSClient: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({
      Account: '123456789012',
      Arn: 'arn:aws:iam::123456789012:user/test',
      UserId: 'AIDATEST'
    })
  })),
  GetCallerIdentityCommand: jest.fn()
}));

jest.mock('@aws-sdk/client-cost-explorer', () => ({
  CostExplorerClient: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({
      ResultsByTime: [{
        TimePeriod: { Start: '2025-01-01', End: '2025-01-31' },
        Total: { UnblendedCost: { Amount: '1234.56', Unit: 'USD' } }
      }]
    })
  })),
  GetCostAndUsageCommand: jest.fn(),
  GetCostForecastCommand: jest.fn(),
  GetReservationCoverageCommand: jest.fn(),
  GetSavingsPlansCoverageCommand: jest.fn(),
  GetRightsizingRecommendationCommand: jest.fn()
}));

jest.mock('@aws-sdk/client-ec2', () => ({
  EC2Client: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({
      Reservations: [{
        Instances: [{
          InstanceId: 'i-1234567890abcdef0',
          InstanceType: 't3.micro',
          State: { Name: 'running' },
          Tags: [{ Key: 'Name', Value: 'TestInstance' }]
        }]
      }],
      Volumes: [{
        VolumeId: 'vol-1234567890abcdef0',
        Size: 100,
        VolumeType: 'gp3',
        State: 'available',
        Attachments: []
      }],
      Snapshots: [],
      Addresses: [],
      NatGateways: []
    })
  })),
  DescribeInstancesCommand: jest.fn(),
  DescribeVolumesCommand: jest.fn(),
  DescribeSnapshotsCommand: jest.fn(),
  DescribeAddressesCommand: jest.fn(),
  DescribeNatGatewaysCommand: jest.fn(),
  DescribeImagesCommand: jest.fn(),
  DescribeVpcsCommand: jest.fn(),
  DescribeSubnetsCommand: jest.fn(),
  DescribeVpnConnectionsCommand: jest.fn(),
  DescribeTransitGatewaysCommand: jest.fn()
}));

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({
      Buckets: [{
        Name: 'test-bucket',
        CreationDate: new Date()
      }],
      LocationConstraint: 'us-east-1'
    })
  })),
  ListBucketsCommand: jest.fn(),
  GetBucketLocationCommand: jest.fn(),
  GetBucketVersioningCommand: jest.fn(),
  GetBucketEncryptionCommand: jest.fn(),
  GetBucketLifecycleConfigurationCommand: jest.fn(),
  GetPublicAccessBlockCommand: jest.fn()
}));

// Credentials de test
const testCredentials: AWSCredentials = {
  accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
  secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  region: 'us-east-1'
};

describe('AUDITOR_MAP', () => {
  it('devrait avoir des mappings pour tous les services principaux', () => {
    expect(AUDITOR_MAP['ec2']).toBeDefined();
    expect(AUDITOR_MAP['s3']).toBeDefined();
    expect(AUDITOR_MAP['rds']).toBeDefined();
    expect(AUDITOR_MAP['lambda']).toBeDefined();
    expect(AUDITOR_MAP['costexplorer']).toBeDefined();
    expect(AUDITOR_MAP['iam']).toBeDefined();
  });

  it('devrait mapper les services aux bons auditeurs', () => {
    expect(AUDITOR_MAP['ec2']).toBe(ComputeAuditor);
    expect(AUDITOR_MAP['lambda']).toBe(ComputeAuditor);
    expect(AUDITOR_MAP['s3']).toBe(StorageAuditor);
    expect(AUDITOR_MAP['rds']).toBe(DatabaseAuditor);
    expect(AUDITOR_MAP['vpc']).toBe(NetworkAuditor);
    expect(AUDITOR_MAP['iam']).toBe(SecurityAuditor);
    expect(AUDITOR_MAP['costexplorer']).toBe(CostAuditor);
  });
});

describe('CostAuditor', () => {
  it('devrait créer une instance avec les credentials', () => {
    const auditor = new CostAuditor(testCredentials);
    expect(auditor).toBeDefined();
    expect(auditor.serviceName).toBe('Cost Explorer');
    expect(auditor.category).toBe('cost');
  });

  it('devrait retourner des résultats d\'audit', async () => {
    const auditor = new CostAuditor(testCredentials);
    const result = await auditor.audit();

    expect(result).toBeDefined();
    expect(result.service).toBe('Cost Explorer');
    expect(result.category).toBe('cost');
    expect(result.timestamp).toBeDefined();
  });
});

describe('ComputeAuditor', () => {
  it('devrait créer une instance avec les credentials', () => {
    const auditor = new ComputeAuditor(testCredentials);
    expect(auditor).toBeDefined();
    expect(auditor.serviceName).toBe('Compute');
    expect(auditor.category).toBe('compute');
  });

  it('devrait retourner des résultats d\'audit', async () => {
    const auditor = new ComputeAuditor(testCredentials);
    const result = await auditor.audit(['us-east-1']);

    expect(result).toBeDefined();
    expect(result.service).toBe('Compute');
    expect(result.data).toBeDefined();
  });
});

describe('StorageAuditor', () => {
  it('devrait créer une instance avec les credentials', () => {
    const auditor = new StorageAuditor(testCredentials);
    expect(auditor).toBeDefined();
    expect(auditor.serviceName).toBe('Storage');
    expect(auditor.category).toBe('storage');
  });
});

describe('DatabaseAuditor', () => {
  it('devrait créer une instance avec les credentials', () => {
    const auditor = new DatabaseAuditor(testCredentials);
    expect(auditor).toBeDefined();
    expect(auditor.serviceName).toBe('Database');
    expect(auditor.category).toBe('database');
  });
});

describe('NetworkAuditor', () => {
  it('devrait créer une instance avec les credentials', () => {
    const auditor = new NetworkAuditor(testCredentials);
    expect(auditor).toBeDefined();
    expect(auditor.serviceName).toBe('Network');
    expect(auditor.category).toBe('network');
  });
});

describe('SecurityAuditor', () => {
  it('devrait créer une instance avec les credentials', () => {
    const auditor = new SecurityAuditor(testCredentials);
    expect(auditor).toBeDefined();
    expect(auditor.serviceName).toBe('Security');
    expect(auditor.category).toBe('security');
  });
});

describe('runAudit', () => {
  it('devrait exécuter l\'audit pour les services spécifiés', async () => {
    const results = await runAudit(testCredentials, ['costexplorer'], ['us-east-1']);

    expect(results).toBeDefined();
    expect(typeof results).toBe('object');
  });

  it('devrait gérer les services non supportés', async () => {
    const results = await runAudit(testCredentials, ['service-inexistant'], ['us-east-1']);

    expect(results['service-inexistant']).toBeDefined();
    expect(results['service-inexistant'].success).toBe(false);
    expect(results['service-inexistant'].error).toContain('non supporté');
  });
});
