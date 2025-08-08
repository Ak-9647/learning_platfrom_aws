export interface ImageReference {
  uri: string;
  alt?: string;
}

export interface DocumentMetadata {
  createdAt?: string;
  updatedAt?: string;
  source?: 'pptx' | 'pdf';
  pageCount?: number;
  slideCount?: number;
  language?: string;
}

export interface Slide {
  slideNumber: number;
  title: string;
  content: string[];
  images: ImageReference[];
  speakerNotes?: string;
}

export interface ParsedDocument {
  documentId: string;
  title: string;
  slides: Slide[];
  metadata: DocumentMetadata;
}
