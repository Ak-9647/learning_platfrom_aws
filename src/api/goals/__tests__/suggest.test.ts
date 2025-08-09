import { describe, it, expect } from 'vitest';
import { handler } from '../suggest';

describe('goals suggest', () => {
  it('returns suggestions based on content', async () => {
    const res = await handler({ body: JSON.stringify({ content: 'Neural networks and backpropagation' }) });
    expect(res.statusCode).toBe(200);
    const { suggestions } = JSON.parse(res.body);
    expect(suggestions.length).toBe(3);
    expect(suggestions[0]).toMatch(/Neural networks/);
  });

  it('limits suggestions by topK', async () => {
    const res = await handler({ body: JSON.stringify({ content: 'Graph algorithms', topK: 2 }) });
    const { suggestions } = JSON.parse(res.body);
    expect(suggestions.length).toBe(2);
  });
});
