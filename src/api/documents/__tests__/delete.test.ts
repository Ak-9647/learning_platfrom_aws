import { describe, it, expect, vi } from 'vitest';
import * as del from '../delete';

vi.mock('@aws-sdk/client-s3', () => {
  class MockS3Client {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async send(cmd: any): Promise<any> {
      const name = cmd?.constructor?.name;
      if (name === 'ListObjectsV2Command') {
        return { Contents: [{ Key: 'documents/doc-1/file.txt' }], IsTruncated: false } as any;
      }
      if (name === 'DeleteObjectsCommand') {
        return {} as any;
      }
      return {} as any;
    }
  }
  class ListObjectsV2Command { constructor(public input: any) {} }
  class DeleteObjectsCommand { constructor(public input: any) {} }
  return { S3Client: MockS3Client, ListObjectsV2Command, DeleteObjectsCommand };
});

vi.mock('@aws-sdk/lib-dynamodb', () => {
  class UpdateCommand { constructor(public input: any) {} }
  class DeleteCommand { constructor(public input: any) {} }
  class MockDocClient {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async send(_cmd: any): Promise<any> { return {}; }
    static from(): MockDocClient { return new MockDocClient(); }
  }
  return { DynamoDBDocumentClient: MockDocClient, UpdateCommand, DeleteCommand };
});

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
