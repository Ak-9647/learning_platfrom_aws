import { describe, it, expect } from 'vitest';
import { redactPII } from '../redact';

describe('redactPII', () => {
  it('redacts emails and phones', async () => {
    const input = 'Contact me at test.user@example.com or +1 (555) 123-4567';
    const out = await redactPII(input, { useComprehend: false });
    expect(out).not.toMatch(/example\.com/);
    expect(out).not.toMatch(/555/);
    expect(out).toContain('[REDACTED]');
  });

  it('handles empty', async () => {
    expect(await redactPII('', { useComprehend: false })).toBe('');
  });
});
