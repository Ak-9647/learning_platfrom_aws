import { ComprehendClient, DetectPiiEntitiesCommand } from '@aws-sdk/client-comprehend';
import { defaultRegexes } from './regexPatterns';

export interface RedactionOptions {
  useComprehend?: boolean;
  region?: string;
}

export async function redactPII(text: string, options: RedactionOptions = {}): Promise<string> {
  if (!text) return text;
  const region = options.region || process.env.AWS_REGION || 'us-west-2';
  const enableComprehend = options.useComprehend ?? (process.env.FF_PII_COMPREHEND === '1');

  if (enableComprehend) {
    try {
      const client = new ComprehendClient({ region });
      const res = await client.send(new DetectPiiEntitiesCommand({ Text: text, LanguageCode: 'en' }));
      const entities = (res.Entities || []) as Array<{ BeginOffset?: number; EndOffset?: number }>;
      let redacted = text;
      entities
        .slice()
        .sort((a: any, b: any) => (b.BeginOffset ?? 0) - (a.BeginOffset ?? 0))
        .forEach((e: any) => {
          const start = e.BeginOffset ?? 0;
          const end = e.EndOffset ?? start;
          redacted = redacted.slice(0, start) + '[REDACTED]' + redacted.slice(end);
        });
      return redacted;
    } catch {
      // fall through to regex if Comprehend unavailable
    }
  }

  let out = text;
  for (const rx of defaultRegexes) {
    out = out.replace(rx, '[REDACTED]');
  }
  return out;
}
