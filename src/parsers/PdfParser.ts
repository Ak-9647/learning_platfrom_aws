import { ParsedDocument, Slide } from './DocumentTypes';
import { ConfigurationManager } from '../config/ConfigurationManager';
import { extractTextWithTextract } from '../aws/TextractFallback';

export interface PdfParser {
  parse(input: Buffer, documentId: string): Promise<ParsedDocument>;
}

function extractTextFromPdfContentStreams(buf: Buffer): string[] {
  const text = buf.toString('latin1');
  const streams: string[] = [];
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/gm;
  let m: RegExpExecArray | null;
  while ((m = streamRegex.exec(text)) !== null) {
    const seg = m[1];
    if (typeof seg === 'string') streams.push(seg);
  }
  const lines: string[] = [];
  for (const s of streams) {
    const textMatches = s.match(/\(([^)]*)\)\s*(?:Tj|TJ)/g) || [];
    for (const match of textMatches) {
      const inner = match.replace(/\s*(Tj|TJ)\s*$/i, '').replace(/^\(/, '').replace(/\)\s*$/, '');
      if (inner.trim()) lines.push(inner);
    }
  }
  return lines;
}

export class PdfParserImpl implements PdfParser {
  async parse(input: Buffer, documentId: string): Promise<ParsedDocument> {
    let lines = extractTextFromPdfContentStreams(input);

    // Textract fallback if no text and flag enabled
    const ffTextract = String(process.env.FF_PARSE_TEXTRACT || '0') === '1';
    if (ffTextract && lines.length === 0) {
      try {
        const cm = ConfigurationManager.loadAndValidateConfig().get();
        const bucket = cm.RAW_DOCUMENTS_BUCKET;
        lines = await extractTextWithTextract(input, documentId, {
          region: cm.BEDROCK_REGION || cm.AWS_REGION,
          bucket,
          keyPrefix: 'textract/uploads',
          maxWaitMs: 60000,
          pollIntervalMs: 2000,
        });
      } catch (err) {
        // Leave as empty; caller can handle lack of text
      }
    }

    const title = lines[0] || 'Untitled PDF';
    const slides: Slide[] = [
      {
        slideNumber: 1,
        title,
        content: lines,
        images: [],
      },
    ];

    const parsed: ParsedDocument = {
      documentId,
      title,
      slides,
      metadata: { source: 'pdf', pageCount: slides.length },
    };

    return parsed;
  }
}
