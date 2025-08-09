import { redactPII } from './redact';

export function createPiiMiddleware() {
  return async function piiMiddleware(ctx: any, next: () => Promise<void>) {
    if (ctx?.request?.body && typeof ctx.request.body.text === 'string') {
      ctx.request.body.text = await redactPII(ctx.request.body.text);
    }
    await next();
    if (ctx?.body && typeof ctx.body === 'string') {
      ctx.body = await redactPII(ctx.body);
    }
  };
}
