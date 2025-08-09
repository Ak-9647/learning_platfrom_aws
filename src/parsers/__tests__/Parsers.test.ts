import { describe, it, expect } from 'vitest';
import { PowerPointParserImpl } from '../PowerPointParser';
import { PdfParserImpl } from '../PdfParser';
import JSZip from 'jszip';

async function buildMinimalPptx(): Promise<Buffer> {
  const zip = new JSZip();
  zip.file('[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n' +
    '  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>\n' +
    '  <Default Extension="xml" ContentType="application/xml"/>\n' +
    '  <Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>\n' +
    '</Types>');
  zip.file('ppt/slides/slide1.xml',
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">\n' +
    '  <p:cSld>\n' +
    '    <p:spTree>\n' +
    '      <p:sp>\n' +
    '        <p:txBody>\n' +
    '          <a:p><a:r><a:t>Hello World</a:t></a:r></a:p>\n' +
    '        </p:txBody>\n' +
    '      </p:sp>\n' +
    '      <p:pic>\n' +
    '        <p:blipFill><a:blip r:embed="rId2" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/></p:blipFill>\n' +
    '      </p:pic>\n' +
    '    </p:spTree>\n' +
    '  </p:cSld>\n' +
    '</p:sld>');
  zip.file('ppt/slides/_rels/slide1.xml.rels',
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n' +
    '  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/>\n' +
    '</Relationships>');
  zip.file('ppt/media/image1.png', new Uint8Array([137,80,78,71]));
  const buf = await zip.generateAsync({ type: 'nodebuffer' });
  return buf as Buffer;
}

// Minimal PDF (one page, simple text). Generated content bytes for a very small valid PDF.
const minimalPdf = Buffer.from(
  '%PDF-1.1\n' +
  '1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj\n' +
  '2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj\n' +
  '3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R /Resources <</Font <</F1 5 0 R>>>>>> endobj\n' +
  '4 0 obj <</Length 44>> stream\nBT /F1 24 Tf 50 150 Td (Hello PDF World) Tj ET\nendstream endobj\n' +
  '5 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica>> endobj\n' +
  'xref\n0 6\n0000000000 65535 f \n0000000010 00000 n \n0000000060 00000 n \n0000000117 00000 n \n0000000274 00000 n \n0000000361 00000 n \ntrailer <</Root 1 0 R /Size 6>>\nstartxref\n433\n%%EOF\n'
);

describe('Parsers', () => {
  it('PPTX parser extracts text and images', async () => {
    const pptx = await buildMinimalPptx();
    const parser = new PowerPointParserImpl();
    const out = await parser.parse(pptx, 'doc-pp');
    expect(out.metadata.source).toBe('pptx');
    expect(out.slides.length).toBe(1);
    expect(out.slides[0].content.join(' ')).toContain('Hello World');
    expect(out.slides[0].images[0].uri).toContain('ppt/media/image1.png');
  });

  it('PDF parser extracts text per page', async () => {
    const parser = new PdfParserImpl();
    const out = await parser.parse(minimalPdf, 'doc-pdf');
    expect(out.metadata.source).toBe('pdf');
    expect(out.slides.length).toBeGreaterThanOrEqual(1);
    const joined = out.slides.map(s => s.content.join(' ')).join(' ');
    expect(joined).toMatch(/Hello\s+PDF\s+World/i);
  });
});
