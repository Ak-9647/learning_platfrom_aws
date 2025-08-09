import crypto from 'crypto';

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

export async function handler(event: any): Promise<{ statusCode: number; body: string }> {
  try {
    if (!event || !event.pathParameters || !event.pathParameters.documentId) {
      throw new ValidationError('Missing path parameter: documentId');
    }
    const documentId = String(event.pathParameters.documentId);

    // TODO: authN/authZ context extraction
    const user = event.requestContext?.authorizer?.principalId;
    if (!user) {
      return { statusCode: 401, body: JSON.stringify({ message: 'Unauthorized' }) };
    }

    // TODO: verify user has rights to publish this document
    const hasAccess = true; // Placeholder until integrated with data layer
    if (!hasAccess) {
      throw new AccessDeniedError('Forbidden');
    }

    const body = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : event.body || {};
    const access: 'private' | 'org' | 'public' = body.access || 'private';

    // TODO: deactivate prior links and persist new publish state
    const token = generateShareToken(documentId);
    const urlBase = process.env.API_BASE_URL || 'https://example.com';
    const shareableLink = `${urlBase.replace(/\/$/, '')}/share/${documentId}/${token}`;

    const response: PublishResponse = {
      shareableLink,
      documentId,
      publishedAt: new Date().toISOString(),
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
