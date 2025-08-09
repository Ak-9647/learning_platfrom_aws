import { describe, it, expect, vi } from 'vitest';
import * as del from '../delete';
import * as s3mod from '@aws-sdk/client-s3';
import * as ddbmod from '@aws-sdk/lib-dynamodb';

vi.spyOn(s3mod, 'S3Client').mockImplementation(() => ({
  send: vi.fn(async (cmd: any) => {
    const name = cmd.constructor.name;
    if (name === 'ListObjectsV2Command') {
      return { Contents: [{ Key: 'documents/doc-1/file.txt' }], IsTruncated: false } as any;
    }
    if (name === 'DeleteObjectsCommand') {
      return {} as any;
    }
    return {} as any;
  }),
}) as any);

vi.spyOn(ddbmod, 'DynamoDBDocumentClient' as any).mockImplementation(() => ({
  send: vi.fn(async (_cmd: any) => ({})),
})) as any;

// Patch from() to return our mocked client
(ddbmod as any).DynamoDBDocumentClient.from = () => (ddbmod as any).DynamoDBDocumentClient();

describe('delete handler', () => {
  it('requires auth', async () => {
    const res = await del.handler({ pathParameters: { documentId: 'doc-1' } });
    expect(res.statusCode).toBe(401);
  });

  it('deletes and deactivates sharing', async () => {
    const res = await del.handler({ pathParameters: { documentId: 'doc-1' }, requestContext: { authorizer: { principalId: 'u1' } } });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.documentId).toBe('doc-1');
  });
});
