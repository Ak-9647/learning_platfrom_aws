import { describe, it, expect } from 'vitest';
import { handler } from '../publish';

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
