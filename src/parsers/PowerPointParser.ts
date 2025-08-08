import { ParsedDocument } from './DocumentTypes';

export interface PowerPointParser {
  parse(input: Buffer, documentId: string): Promise<ParsedDocument>;
}

export class PowerPointParserImpl implements PowerPointParser {
  async parse(input: Buffer, documentId: string): Promise<ParsedDocument> {
    // Minimal stub: returns a skeleton object for now
    return {
      documentId,
      title: 'Untitled PPTX',
      slides: [],
      metadata: { source: 'pptx', slideCount: 0 }
    };
  }
}
