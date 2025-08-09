import { describe, it, expect, vi } from 'vitest';
import { handler, persistPublish } from '../publish';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

describe('publish handler', () => {
  it('returns 400 on missing documentId', async () => {
    const res = await handler({ pathParameters: {}, requestContext: { authorizer: { principalId: 'u' } } });
    expect(res.statusCode).toBe(400);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await handler({ pathParameters: { documentId: 'd1' } });
    expect(res.statusCode).toBe(401);
  });

  it('returns shareable link on success', async () => {
    const res = await handler({
      pathParameters: { documentId: 'doc-123' },
      requestContext: { authorizer: { principalId: 'user-1' } },
      body: JSON.stringify({ access: 'org' }),
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.documentId).toBe('doc-123');
    expect(body.shareableLink).toMatch(/\/share\/doc-123\//);
    expect(body.accessSettings).toBe('org');
    expect(new Date(body.publishedAt).toString()).not.toBe('Invalid Date');
  });
});

describe('persistPublish', () => {
  it('calls UpdateCommand with expected values', async () => {
    const sends: any[] = [];
    const fakeClient = { send: vi.fn(async (cmd) => { sends.push(cmd); }) } as unknown as DynamoDBDocumentClient;
    await persistPublish('tbl', 'doc-1', 'tok', '2020-01-01T00:00:00Z', 'private', 'https://x/y', fakeClient);
    expect(sends.length).toBe(1);
    const sent = sends[0].input;
    expect(sent.TableName).toBe('tbl');
    expect(sent.Key.documentId).toBe('doc-1');
    expect(sent.ExpressionAttributeValues[':pub']).toBe(true);
    expect(sent.ExpressionAttributeValues[':acc']).toBe('private');
  });
});
