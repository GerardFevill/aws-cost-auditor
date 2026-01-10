/**
 * Serveur local pour le développement
 * Simule API Gateway + Lambda localement
 */

import http from 'http';
import { handler } from './index';
import { runAudit, AUDITOR_MAP } from './services';
import { AWSCredentials, AWS_SERVICES } from './types';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import { APIGatewayProxyEvent, Context } from 'aws-lambda';

const PORT = process.env.PORT || 3000;

/**
 * Extrait les credentials AWS des headers
 */
function extractCredentialsFromHeaders(headers: http.IncomingHttpHeaders): AWSCredentials | null {
  const accessKeyId = headers['x-aws-access-key-id'] as string;
  const secretAccessKey = headers['x-aws-secret-access-key'] as string;
  const region = (headers['x-aws-region'] as string) || 'us-east-1';
  const sessionToken = headers['x-aws-session-token'] as string;

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
 * Convertit une requête HTTP en événement API Gateway
 */
function createAPIGatewayEvent(
  req: http.IncomingMessage,
  body: string
): APIGatewayProxyEvent {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);

  return {
    httpMethod: req.method || 'GET',
    path: url.pathname,
    headers: req.headers as Record<string, string>,
    queryStringParameters: Object.fromEntries(url.searchParams),
    pathParameters: null,
    body: body || null,
    isBase64Encoded: false,
    requestContext: {} as any,
    resource: '',
    stageVariables: null,
    multiValueHeaders: {},
    multiValueQueryStringParameters: null
  };
}

/**
 * Crée un contexte Lambda simulé
 */
function createContext(): Context {
  return {
    callbackWaitsForEmptyEventLoop: true,
    functionName: 'aws-cost-auditor',
    functionVersion: '1.0.0',
    invokedFunctionArn: 'arn:aws:lambda:local:000000000000:function:aws-cost-auditor',
    memoryLimitInMB: '256',
    awsRequestId: `local-${Date.now()}`,
    logGroupName: '/aws/lambda/aws-cost-auditor',
    logStreamName: `local-${Date.now()}`,
    getRemainingTimeInMillis: () => 300000,
    done: () => {},
    fail: () => {},
    succeed: () => {}
  };
}

/**
 * Gère la route /audit/stream avec SSE
 */
async function handleAuditStream(req: http.IncomingMessage, res: http.ServerResponse, body: string) {
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-AWS-Access-Key-Id,X-AWS-Secret-Access-Key,X-AWS-Session-Token,X-AWS-Region');

  const sendEvent = (event: string, data: any) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const credentials = extractCredentialsFromHeaders(req.headers);

  if (!credentials) {
    sendEvent('error', { error: 'Missing AWS credentials' });
    res.end();
    return;
  }

  // Validate credentials
  const validation = await validateCredentials(credentials);
  if (!validation.valid) {
    sendEvent('error', { error: validation.error });
    res.end();
    return;
  }

  sendEvent('connected', { accountId: validation.accountId });

  // Parse body
  let config: { services?: string[]; regions?: string[] } = {};
  if (body) {
    try {
      config = JSON.parse(body);
    } catch {
      sendEvent('error', { error: 'Invalid JSON body' });
      res.end();
      return;
    }
  }

  const services = config.services || Object.keys(AUDITOR_MAP);

  // Run audit with progress callback
  try {
    const results = await runAudit(credentials, services, config.regions, (step, status, data) => {
      sendEvent('progress', { step, status, data: data ? { category: data.category } : undefined });
    });

    sendEvent('complete', {
      accountId: validation.accountId,
      results
    });
  } catch (error: any) {
    sendEvent('error', { error: error.message });
  }

  res.end();
}

/**
 * Serveur HTTP
 */
const server = http.createServer(async (req, res) => {
  let body = '';

  req.on('data', chunk => {
    body += chunk.toString();
  });

  req.on('end', async () => {
    console.log(`${req.method} ${req.url}`);

    const url = new URL(req.url || '/', `http://localhost:${PORT}`);

    // Handle CORS preflight for all routes
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-AWS-Access-Key-Id,X-AWS-Secret-Access-Key,X-AWS-Session-Token,X-AWS-Region');
      res.statusCode = 200;
      res.end();
      return;
    }

    // Handle SSE streaming audit
    if (url.pathname === '/audit/stream' && req.method === 'POST') {
      await handleAuditStream(req, res, body);
      return;
    }

    try {
      const event = createAPIGatewayEvent(req, body);
      const context = createContext();

      const response = await handler(event, context);

      // Set headers
      Object.entries(response.headers || {}).forEach(([key, value]) => {
        res.setHeader(key, value as string);
      });

      res.statusCode = response.statusCode;
      res.end(response.body);

    } catch (error: any) {
      console.error('Server error:', error);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: error.message }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                 AWS Cost Auditor API                       ║
╠═══════════════════════════════════════════════════════════╣
║  Server running at http://localhost:${PORT}                   ║
║                                                           ║
║  Endpoints:                                               ║
║    GET  /services        - List available AWS services    ║
║    POST /validate        - Validate AWS credentials       ║
║    POST /audit           - Run full audit                 ║
║    POST /audit/:category - Run audit for category         ║
║                                                           ║
║  Headers required for audit:                              ║
║    X-AWS-Access-Key-Id: <your-access-key>                 ║
║    X-AWS-Secret-Access-Key: <your-secret-key>             ║
║    X-AWS-Region: <region> (optional, default: us-east-1)  ║
╚═══════════════════════════════════════════════════════════╝
  `);
});
