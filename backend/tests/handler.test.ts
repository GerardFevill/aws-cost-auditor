/**
 * Tests pour le handler Lambda
 */

import { handler } from '../src/index';
import { APIGatewayProxyEvent, Context } from 'aws-lambda';

// Mock STS
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

// Mock tous les clients AWS pour éviter les appels réels
jest.mock('@aws-sdk/client-cost-explorer', () => ({
  CostExplorerClient: jest.fn().mockImplementation(() => ({ send: jest.fn().mockResolvedValue({}) })),
  GetCostAndUsageCommand: jest.fn(),
  GetCostForecastCommand: jest.fn(),
  GetReservationCoverageCommand: jest.fn(),
  GetSavingsPlansCoverageCommand: jest.fn(),
  GetRightsizingRecommendationCommand: jest.fn()
}));

jest.mock('@aws-sdk/client-budgets', () => ({
  BudgetsClient: jest.fn().mockImplementation(() => ({ send: jest.fn().mockResolvedValue({}) })),
  DescribeBudgetsCommand: jest.fn()
}));

/**
 * Crée un événement API Gateway de test
 */
function createEvent(
  method: string,
  path: string,
  headers: Record<string, string> = {},
  body?: any
): APIGatewayProxyEvent {
  return {
    httpMethod: method,
    path,
    headers,
    body: body ? JSON.stringify(body) : null,
    queryStringParameters: null,
    pathParameters: null,
    isBase64Encoded: false,
    requestContext: {} as any,
    resource: '',
    stageVariables: null,
    multiValueHeaders: {},
    multiValueQueryStringParameters: null
  };
}

/**
 * Crée un contexte Lambda de test
 */
function createContext(): Context {
  return {
    callbackWaitsForEmptyEventLoop: true,
    functionName: 'test',
    functionVersion: '1',
    invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test',
    memoryLimitInMB: '256',
    awsRequestId: 'test-request-id',
    logGroupName: '/aws/lambda/test',
    logStreamName: 'test-stream',
    getRemainingTimeInMillis: () => 300000,
    done: () => {},
    fail: () => {},
    succeed: () => {}
  };
}

describe('Lambda Handler', () => {
  const context = createContext();

  describe('OPTIONS (CORS)', () => {
    it('devrait retourner 200 pour les requêtes OPTIONS', async () => {
      const event = createEvent('OPTIONS', '/services');
      const response = await handler(event, context);

      expect(response.statusCode).toBe(200);
      expect(response.headers?.['Access-Control-Allow-Origin']).toBe('*');
      expect(response.headers?.['Access-Control-Allow-Methods']).toContain('POST');
    });
  });

  describe('GET /services', () => {
    it('devrait retourner la liste des services AWS', async () => {
      const event = createEvent('GET', '/services');
      const response = await handler(event, context);

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.services).toBeDefined();
      expect(Array.isArray(body.data.services)).toBe(true);
      expect(body.data.services.length).toBeGreaterThan(0);
      expect(body.data.categories).toBeDefined();
    });

    it('devrait inclure les catégories de services', async () => {
      const event = createEvent('GET', '/services');
      const response = await handler(event, context);

      const body = JSON.parse(response.body);
      expect(body.data.categories).toContain('compute');
      expect(body.data.categories).toContain('storage');
      expect(body.data.categories).toContain('database');
      expect(body.data.categories).toContain('network');
      expect(body.data.categories).toContain('security');
    });
  });

  describe('POST /validate', () => {
    it('devrait retourner 401 si les credentials sont manquants', async () => {
      const event = createEvent('POST', '/validate');
      const response = await handler(event, context);

      expect(response.statusCode).toBe(401);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toContain('Missing AWS credentials');
    });

    it('devrait valider les credentials valides', async () => {
      const event = createEvent('POST', '/validate', {
        'X-AWS-Access-Key-Id': 'AKIAIOSFODNN7EXAMPLE',
        'X-AWS-Secret-Access-Key': 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        'X-AWS-Region': 'us-east-1'
      });

      const response = await handler(event, context);

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.accountId).toBe('123456789012');
    });
  });

  describe('POST /audit', () => {
    it('devrait retourner 401 sans credentials', async () => {
      const event = createEvent('POST', '/audit');
      const response = await handler(event, context);

      expect(response.statusCode).toBe(401);
    });

    it('devrait accepter un body avec services spécifiques', async () => {
      const event = createEvent(
        'POST',
        '/audit',
        {
          'X-AWS-Access-Key-Id': 'AKIAIOSFODNN7EXAMPLE',
          'X-AWS-Secret-Access-Key': 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'
        },
        { services: ['costexplorer'], regions: ['us-east-1'] }
      );

      const response = await handler(event, context);

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.accountId).toBeDefined();
      expect(body.data.results).toBeDefined();
    });

    it('devrait retourner 400 pour un body JSON invalide', async () => {
      const event = createEvent(
        'POST',
        '/audit',
        {
          'X-AWS-Access-Key-Id': 'AKIAIOSFODNN7EXAMPLE',
          'X-AWS-Secret-Access-Key': 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'
        }
      );
      event.body = 'invalid json';

      const response = await handler(event, context);

      expect(response.statusCode).toBe(400);

      const body = JSON.parse(response.body);
      expect(body.error).toContain('Invalid JSON');
    });
  });

  describe('POST /audit/:category', () => {
    it('devrait auditer une catégorie spécifique', async () => {
      const event = createEvent(
        'POST',
        '/audit/cost',
        {
          'X-AWS-Access-Key-Id': 'AKIAIOSFODNN7EXAMPLE',
          'X-AWS-Secret-Access-Key': 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'
        }
      );

      const response = await handler(event, context);

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.category).toBe('cost');
    });

    it('devrait retourner 404 pour une catégorie inexistante', async () => {
      const event = createEvent(
        'POST',
        '/audit/inexistant',
        {
          'X-AWS-Access-Key-Id': 'AKIAIOSFODNN7EXAMPLE',
          'X-AWS-Secret-Access-Key': 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'
        }
      );

      const response = await handler(event, context);

      expect(response.statusCode).toBe(404);

      const body = JSON.parse(response.body);
      expect(body.error).toContain('Category not found');
    });
  });

  describe('Routes non trouvées', () => {
    it('devrait retourner 404 pour une route inexistante', async () => {
      const event = createEvent('GET', '/route-inexistante');
      const response = await handler(event, context);

      expect(response.statusCode).toBe(404);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toContain('Route not found');
    });
  });
});
