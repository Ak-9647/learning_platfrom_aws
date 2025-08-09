export interface SuggestRequestBody {
  content?: string;
  slides?: string[]; // slide titles or concatenated texts
  topK?: number;
}

export interface SuggestResponseBody {
  suggestions: string[];
}

function extractTopic(input: SuggestRequestBody): string {
  const src = (input.content || input.slides?.join(' ') || '').trim();
  if (!src) return 'the topic';
  // naive heuristic: pick first 5 words as topic phrase
  const words = src.replace(/\s+/g, ' ').split(' ').slice(0, 5).join(' ');
  return words || 'the topic';
}

export async function handler(event: any): Promise<{ statusCode: number; body: string }> {
  try {
    const body: SuggestRequestBody = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : (event.body || {});
    const k = Math.max(1, Math.min(5, Number(body.topK) || 3));

    const topic = extractTopic(body);
    const base = [
      `Understand core concepts of ${topic}`,
      `Apply ${topic} with practical examples and exercises`,
      `Assess comprehension and identify gaps for ${topic}`,
      `Relate ${topic} to real-world scenarios in your domain`,
      `Summarize key takeaways and next steps for ${topic}`,
    ];

    const suggestions = base.slice(0, k);

    const resp: SuggestResponseBody = { suggestions };
    return { statusCode: 200, body: JSON.stringify(resp) };
  } catch {
    return { statusCode: 400, body: JSON.stringify({ message: 'Invalid request' }) };
  }
}
