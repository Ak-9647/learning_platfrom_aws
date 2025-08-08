import { ParsedDocument } from './DocumentTypes';

export interface PdfParser {
  parse(input: Buffer, documentId: string): Promise<ParsedDocument>;
}

export class PdfParserImpl implements PdfParser {
  async parse(input: Buffer, documentId: string): Promise<ParsedDocument> {
    // Minimal stub: returns a skeleton object for now
    return {
      documentId,
      title: 'Untitled PDF',
      slides: [],
      metadata: { source: 'pdf', pageCount: 0 }
    };
  }
}
