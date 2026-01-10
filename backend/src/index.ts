/**
 * AWS Cost Auditor - Lambda Handler
 * Point d'entrée pour AWS Lambda + API Gateway
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import { runAudit, AUDITOR_MAP } from './services';
import { AWSCredentials, AWS_SERVICES, APIResponse } from './types';

// Headers CORS
const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-AWS-Access-Key-Id,X-AWS-Secret-Access-Key,X-AWS-Session-Token,X-AWS-Region',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
};

/**
 * Crée une réponse API standardisée
 */
function createResponse(statusCode: number, body: APIResponse): APIGatewayProxyResult {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify(body)
  };
}

/**
 * Extrait les credentials AWS des headers
 */
function extractCredentials(headers: Record<string, string | undefined>): AWSCredentials | null {
  const accessKeyId = headers['x-aws-access-key-id'] || headers['X-AWS-Access-Key-Id'];
  const secretAccessKey = headers['x-aws-secret-access-key'] || headers['X-AWS-Secret-Access-Key'];
  const region = headers['x-aws-region'] || headers['X-AWS-Region'] || 'us-east-1';
  const sessionToken = headers['x-aws-session-token'] || headers['X-AWS-Session-Token'];

  if (!accessKeyId || !secretAccessKey) {
    return null;
  }

  return {
    accessKeyId,
    secretAccessKey,
    region,
    sessionToken: sessionToken || undefined
  };
}

/**
 * Valide les credentials AWS
 */
async function validateCredentials(credentials: AWSCredentials): Promise<{ valid: boolean; accountId?: string; error?: string }> {
  try {
    const stsClient = new STSClient({
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken
      },
      region: credentials.region
    });

    const response = await stsClient.send(new GetCallerIdentityCommand({}));

    return {
      valid: true,
      accountId: response.Account
    };
  } catch (error: any) {
    return {
      valid: false,
      error: error.message || 'Invalid credentials'
    };
  }
}

/**
 * Handler principal Lambda
 */
export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  console.log('Request:', JSON.stringify({ path: event.path, method: event.httpMethod }));

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return createResponse(200, { success: true, timestamp: new Date().toISOString() });
  }

  const path = event.path;
  const method = event.httpMethod;

  try {
    // Route: GET /services - Liste des services disponibles
    if (path === '/services' && method === 'GET') {
      return createResponse(200, {
        success: true,
        data: {
          services: AWS_SERVICES,
          categories: [...new Set(AWS_SERVICES.map(s => s.category))]
        },
        timestamp: new Date().toISOString()
      });
    }

    // Route: POST /validate - Valider les credentials
    if (path === '/validate' && method === 'POST') {
      const credentials = extractCredentials(event.headers as Record<string, string>);

      if (!credentials) {
        return createResponse(401, {
          success: false,
          error: 'Missing AWS credentials in headers',
          timestamp: new Date().toISOString()
        });
      }

      const validation = await validateCredentials(credentials);

      if (!validation.valid) {
        return createResponse(401, {
          success: false,
          error: validation.error,
          timestamp: new Date().toISOString()
        });
      }

      return createResponse(200, {
        success: true,
        data: {
          accountId: validation.accountId,
          region: credentials.region
        },
        timestamp: new Date().toISOString()
      });
    }

    // Route: POST /audit/stream - Lancer un audit avec streaming SSE
    // Note: Cette route est gérée par le local-server.ts pour le streaming

    // Route: POST /audit - Lancer un audit
    if (path === '/audit' && method === 'POST') {
      const credentials = extractCredentials(event.headers as Record<string, string>);

      if (!credentials) {
        return createResponse(401, {
          success: false,
          error: 'Missing AWS credentials in headers',
          timestamp: new Date().toISOString()
        });
      }

      // Parse body
      let body: { services?: string[]; regions?: string[] } = {};
      if (event.body) {
        try {
          body = JSON.parse(event.body);
        } catch {
          return createResponse(400, {
            success: false,
            error: 'Invalid JSON body',
            timestamp: new Date().toISOString()
          });
        }
      }

      // Services à auditer (tous par défaut)
      const services = body.services || Object.keys(AUDITOR_MAP);
      const regions = body.regions;

      // Valider les credentials d'abord
      const validation = await validateCredentials(credentials);
      if (!validation.valid) {
        return createResponse(401, {
          success: false,
          error: validation.error,
          timestamp: new Date().toISOString()
        });
      }

      // Lancer l'audit
      console.log(`Starting audit for services: ${services.join(', ')}`);
      const startTime = Date.now();

      const results = await runAudit(credentials, services, regions);

      const duration = Date.now() - startTime;
      console.log(`Audit completed in ${duration}ms`);

      return createResponse(200, {
        success: true,
        data: {
          accountId: validation.accountId,
          auditDuration: duration,
          results
        },
        timestamp: new Date().toISOString()
      });
    }

    // Route: POST /audit/:category - Lancer un audit pour une catégorie spécifique
    if (path.startsWith('/audit/') && method === 'POST') {
      const category = path.replace('/audit/', '');
      const credentials = extractCredentials(event.headers as Record<string, string>);

      if (!credentials) {
        return createResponse(401, {
          success: false,
          error: 'Missing AWS credentials in headers',
          timestamp: new Date().toISOString()
        });
      }

      // Parse body for regions
      let body: { regions?: string[] } = {};
      if (event.body) {
        try {
          body = JSON.parse(event.body);
        } catch {
          // Ignore parse errors
        }
      }

      // Trouver les services de cette catégorie
      const categoryServices = AWS_SERVICES
        .filter(s => s.category === category)
        .map(s => s.id);

      if (categoryServices.length === 0) {
        return createResponse(404, {
          success: false,
          error: `Category not found: ${category}`,
          timestamp: new Date().toISOString()
        });
      }

      // Valider les credentials
      const validation = await validateCredentials(credentials);
      if (!validation.valid) {
        return createResponse(401, {
          success: false,
          error: validation.error,
          timestamp: new Date().toISOString()
        });
      }

      // Lancer l'audit
      const startTime = Date.now();
      const results = await runAudit(credentials, categoryServices, body.regions);
      const duration = Date.now() - startTime;

      return createResponse(200, {
        success: true,
        data: {
          accountId: validation.accountId,
          category,
          auditDuration: duration,
          results
        },
        timestamp: new Date().toISOString()
      });
    }

    // Route non trouvée
    return createResponse(404, {
      success: false,
      error: `Route not found: ${method} ${path}`,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error:', error);
    return createResponse(500, {
      success: false,
      error: error.message || 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
};
