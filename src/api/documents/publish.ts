import crypto from 'crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { isAuthorizedToPublish, UserContext } from '../../security/AccessControl';

export interface PublishRequest {
  documentId: string;
  access?: 'private' | 'org' | 'public';
}

export interface PublishResponse {
  shareableLink: string;
  documentId: string;
  publishedAt: string;
  accessSettings: 'private' | 'org' | 'public';
}

export class AccessDeniedError extends Error {}
export class ValidationError extends Error {}

function generateShareToken(documentId: string): string {
  const nonce = crypto.randomBytes(8).toString('hex');
  return crypto.createHash('sha256').update(`${documentId}:${nonce}`).digest('hex').slice(0, 32);
}

export async function persistPublish(
  tableName: string,
  documentId: string,
  shareToken: string,
  publishedAt: string,
  access: 'private' | 'org' | 'public',
  shareableLink: string,
  client?: DynamoDBDocumentClient
): Promise<void> {
  const ddb =
    client || DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION || 'us-west-2' }));
  const cmd = new UpdateCommand({
    TableName: tableName,
    Key: { documentId },
    UpdateExpression:
      'SET published = :pub, publishedAt = :ts, access = :acc, shareToken = :tok, shareableLink = :lnk, previousLinks = list_append(if_not_exists(previousLinks, :empty), :old)',
    ExpressionAttributeValues: {
      ':pub': true,
      ':ts': publishedAt,
      ':acc': access,
      ':tok': shareToken,
      ':lnk': shareableLink,
      ':empty': [],
      ':old': [], // placeholder; in real impl, fetch existing and append; here we just ensure attr exists
    },
  });
  await ddb.send(cmd);
}

function extractUserContext(event: any): UserContext | null {
  const auth = event.requestContext?.authorizer;
  if (!auth?.principalId) return null;
  return {
    userId: String(auth.principalId),
    orgId: auth.orgId ? String(auth.orgId) : undefined,
    roles: Array.isArray(auth.roles) ? auth.roles.map(String) : undefined,
  };
}

export async function handler(event: any): Promise<{ statusCode: number; body: string }> {
  try {
    if (!event || !event.pathParameters || !event.pathParameters.documentId) {
      throw new ValidationError('Missing path parameter: documentId');
    }
    const documentId = String(event.pathParameters.documentId);

    const userCtx = extractUserContext(event);
    if (!userCtx) {
      return { statusCode: 401, body: JSON.stringify({ message: 'Unauthorized' }) };
    }

    const allowed = await isAuthorizedToPublish(userCtx, documentId);
    if (!allowed) {
      throw new AccessDeniedError('Forbidden');
    }

    const body = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : event.body || {};
    const access: 'private' | 'org' | 'public' = body.access || 'private';

    const token = generateShareToken(documentId);
    const urlBase = process.env.API_BASE_URL || 'https://example.com';
    const shareableLink = `${urlBase.replace(/\/$/, '')}/share/${documentId}/${token}`;
    const publishedAt = new Date().toISOString();

    const tableName = process.env.DOCUMENT_REGISTRY_TABLE;
    if (tableName) {
      await persistPublish(tableName, documentId, token, publishedAt, access, shareableLink);
    }

    const response: PublishResponse = {
      shareableLink,
      documentId,
      publishedAt,
      accessSettings: access,
    };

    return { statusCode: 200, body: JSON.stringify(response) };
  } catch (err: any) {
    if (err instanceof ValidationError) {
      return { statusCode: 400, body: JSON.stringify({ message: err.message }) };
    }
    if (err instanceof AccessDeniedError) {
      return { statusCode: 403, body: JSON.stringify({ message: err.message }) };
    }
    return { statusCode: 500, body: JSON.stringify({ message: 'Internal Server Error' }) };
  }
}
