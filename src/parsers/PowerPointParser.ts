import { ParsedDocument, Slide, ImageReference } from './DocumentTypes';
import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';

export interface PowerPointParser {
  parse(input: Buffer, documentId: string): Promise<ParsedDocument>;
}

function sortSlidePaths(paths: string[]): string[] {
  return paths.sort((a, b) => {
    const ax = /slide(\d+)\.xml$/.exec(a)?.[1];
    const bx = /slide(\d+)\.xml$/.exec(b)?.[1];
    const ai = ax ? parseInt(ax, 10) : 0;
    const bi = bx ? parseInt(bx, 10) : 0;
    return ai - bi;
  });
}

function resolveRelTarget(target: string): string {
  // Targets in relationships are relative to ppt/slides; normalize to start at ppt/
  if (target.startsWith('../')) {
    return 'ppt/' + target.replace(/^.\//, '').replace(/^\.\.\//, '');
  }
  if (!target.startsWith('ppt/')) {
    return `ppt/${target}`;
  }
  return target;
}

export class PowerPointParserImpl implements PowerPointParser {
  async parse(input: Buffer, documentId: string): Promise<ParsedDocument> {
    const zip = await JSZip.loadAsync(input);
    const slideFiles = Object.keys(zip.files).filter((p) => p.startsWith('ppt/slides/slide') && p.endsWith('.xml'));
    const sortedSlides = sortSlidePaths(slideFiles);

    const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true, attributeNamePrefix: '@_' });

    const slides: Slide[] = [];

    for (let idx = 0; idx < sortedSlides.length; idx++) {
      const slidePath = sortedSlides[idx];
      if (!slidePath || !zip.files[slidePath]) {
        continue;
      }
      const xmlText = await zip.files[slidePath]!.async('text');
      const xml = parser.parse(xmlText);

      // Collect text nodes (a:t)
      const texts: string[] = [];
      const collectText = (node: any) => {
        if (!node || typeof node !== 'object') return;
        for (const [k, v] of Object.entries(node)) {
          if (k === 't') {
            if (typeof v === 'string') texts.push(v);
          } else if (typeof v === 'object') {
            collectText(v);
          }
        }
      };
      collectText(xml);

      // Find embedded image rIds from blip nodes
      const embedIds: string[] = [];
      const collectBlips = (node: any) => {
        if (!node || typeof node !== 'object') return;
        for (const [k, v] of Object.entries(node)) {
          if (k === 'blip' && v && typeof v === 'object') {
            const rid = (v as any)['@_embed'];
            if (typeof rid === 'string') embedIds.push(rid);
          } else if (typeof v === 'object') {
            collectBlips(v);
          }
        }
      };
      collectBlips(xml);

      // Map rIds to relationship targets
      const relsPath = slidePath.replace('slides/slide', 'slides/_rels/slide') + '.rels';
      const images: ImageReference[] = [];
      if (relsPath && zip.files[relsPath]) {
        const relsXmlText = await zip.files[relsPath]!.async('text');
        const rels = parser.parse(relsXmlText);
        const relList = rels?.Relationships?.Relationship;
        const relArray = Array.isArray(relList) ? relList : relList ? [relList] : [];
        const ridToTarget = new Map<string, string>();
        for (const rel of relArray) {
          const id = rel['@_Id'];
          const target = rel['@_Target'];
          if (id && target) ridToTarget.set(id, resolveRelTarget(String(target)));
        }
        for (const rid of embedIds) {
          const target = ridToTarget.get(rid);
          if (target && target.startsWith('ppt/media/')) {
            images.push({ uri: target });
          }
        }
      }

      const content = texts.filter((t) => t && t.trim().length > 0);
      const title = content[0]?.slice(0, 120) || `Slide ${idx + 1}`;

      slides.push({
        slideNumber: idx + 1,
        title,
        content,
        images,
      });
    }

    const parsed: ParsedDocument = {
      documentId,
      title: slides[0]?.title || 'Untitled PPTX',
      slides,
      metadata: { source: 'pptx', slideCount: slides.length },
    };

    return parsed;
  }
}
