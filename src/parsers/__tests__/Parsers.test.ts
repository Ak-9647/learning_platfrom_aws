import { describe, it, expect } from 'vitest';
import { PowerPointParserImpl } from '../PowerPointParser';
import { PdfParserImpl } from '../PdfParser';

describe('Parsers stubs', () => {
  it('PPTX parser returns skeleton', async () => {
    const parser = new PowerPointParserImpl();
    const out = await parser.parse(Buffer.from('pptx'), 'doc-1');
    expect(out.documentId).toBe('doc-1');
    expect(out.metadata.source).toBe('pptx');
    expect(Array.isArray(out.slides)).toBe(true);
  });

  it('PDF parser returns skeleton', async () => {
    const parser = new PdfParserImpl();
    const out = await parser.parse(Buffer.from('pdf'), 'doc-2');
    expect(out.documentId).toBe('doc-2');
    expect(out.metadata.source).toBe('pdf');
    expect(Array.isArray(out.slides)).toBe(true);
  });
});
