/**
 * Tests pour les types et constantes
 */

import { AWS_SERVICES, AWSService, ServiceCategory } from '../src/types';

describe('AWS_SERVICES', () => {
  it('devrait être un tableau non vide', () => {
    expect(Array.isArray(AWS_SERVICES)).toBe(true);
    expect(AWS_SERVICES.length).toBeGreaterThan(0);
  });

  it('devrait avoir les propriétés requises pour chaque service', () => {
    for (const service of AWS_SERVICES) {
      expect(service.id).toBeDefined();
      expect(typeof service.id).toBe('string');
      expect(service.id.length).toBeGreaterThan(0);

      expect(service.name).toBeDefined();
      expect(typeof service.name).toBe('string');

      expect(service.category).toBeDefined();
      expect(typeof service.category).toBe('string');

      expect(service.description).toBeDefined();
      expect(typeof service.description).toBe('string');
    }
  });

  it('devrait avoir des IDs uniques', () => {
    const ids = AWS_SERVICES.map(s => s.id);
    const uniqueIds = [...new Set(ids)];
    expect(ids.length).toBe(uniqueIds.length);
  });

  it('devrait couvrir toutes les catégories principales', () => {
    const categories = [...new Set(AWS_SERVICES.map(s => s.category))];

    expect(categories).toContain('compute');
    expect(categories).toContain('storage');
    expect(categories).toContain('database');
    expect(categories).toContain('network');
    expect(categories).toContain('security');
    expect(categories).toContain('analytics');
    expect(categories).toContain('integration');
    expect(categories).toContain('management');
    expect(categories).toContain('containers');
    expect(categories).toContain('ai-ml');
    expect(categories).toContain('cost');
  });

  describe('Services Compute', () => {
    it('devrait inclure EC2, Lambda, ECS, EKS', () => {
      const computeServices = AWS_SERVICES.filter(s => s.category === 'compute');
      const ids = computeServices.map(s => s.id);

      expect(ids).toContain('ec2');
      expect(ids).toContain('lambda');
      expect(ids).toContain('ecs');
      expect(ids).toContain('eks');
    });
  });

  describe('Services Storage', () => {
    it('devrait inclure S3, EBS, EFS', () => {
      const storageServices = AWS_SERVICES.filter(s => s.category === 'storage');
      const ids = storageServices.map(s => s.id);

      expect(ids).toContain('s3');
      expect(ids).toContain('ebs');
      expect(ids).toContain('efs');
    });
  });

  describe('Services Database', () => {
    it('devrait inclure RDS, DynamoDB, ElastiCache', () => {
      const dbServices = AWS_SERVICES.filter(s => s.category === 'database');
      const ids = dbServices.map(s => s.id);

      expect(ids).toContain('rds');
      expect(ids).toContain('dynamodb');
      expect(ids).toContain('elasticache');
    });
  });

  describe('Services Security', () => {
    it('devrait inclure IAM, KMS, Secrets Manager', () => {
      const securityServices = AWS_SERVICES.filter(s => s.category === 'security');
      const ids = securityServices.map(s => s.id);

      expect(ids).toContain('iam');
      expect(ids).toContain('kms');
      expect(ids).toContain('secretsmanager');
    });
  });

  describe('Services Cost', () => {
    it('devrait inclure Cost Explorer et Budgets', () => {
      const costServices = AWS_SERVICES.filter(s => s.category === 'cost');
      const ids = costServices.map(s => s.id);

      expect(ids).toContain('costexplorer');
      expect(ids).toContain('budgets');
    });
  });
});

describe('ServiceCategory', () => {
  const validCategories: ServiceCategory[] = [
    'compute', 'storage', 'database', 'network', 'security',
    'analytics', 'integration', 'management', 'containers', 'ai-ml', 'cost'
  ];

  it('devrait avoir toutes les catégories représentées dans AWS_SERVICES', () => {
    const categoriesInServices = [...new Set(AWS_SERVICES.map(s => s.category))];

    for (const category of validCategories) {
      expect(categoriesInServices).toContain(category);
    }
  });
});
