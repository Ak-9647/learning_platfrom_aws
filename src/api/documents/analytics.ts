import { AthenaClient, StartQueryExecutionCommand, GetQueryExecutionCommand, GetQueryResultsCommand } from '@aws-sdk/client-athena';

export interface AnalyticsQueryParams {
  documentId: string;
  from?: string; // ISO date
  to?: string;   // ISO date
}

export interface AnalyticsSeriesPoint {
  ts: string;
  views: number;
  completions: number;
}

export interface AnalyticsResponse {
  documentId: string;
  from?: string;
  to?: string;
  totals: {
    views: number;
    completions: number;
  };
  series: AnalyticsSeriesPoint[];
}

export class ValidationError extends Error {}

async function runAthenaQuery(client: AthenaClient, params: { db: string; output: string; query: string }) {
  const start = await client.send(
    new StartQueryExecutionCommand({
      QueryString: params.query,
      QueryExecutionContext: { Database: params.db },
      ResultConfiguration: { OutputLocation: params.output },
    })
  );
  const qid = start.QueryExecutionId;
  if (!qid) throw new Error('Failed to start Athena query');

  // poll status
  // NOTE: simple polling; caller may set provisioned concurrency in production
  let status = 'RUNNING';
  const deadline = Date.now() + 60000; // 60s
  while (Date.now() < deadline && (status === 'RUNNING' || status === 'QUEUED')) {
    const ex = await client.send(new GetQueryExecutionCommand({ QueryExecutionId: qid }));
    status = ex.QueryExecution?.Status?.State || 'RUNNING';
    if (status === 'SUCCEEDED') break;
    if (status === 'FAILED' || status === 'CANCELLED') {
      const reason = ex.QueryExecution?.Status?.StateChangeReason || 'Unknown error';
      throw new Error(`Athena query ${status}: ${reason}`);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  if (status !== 'SUCCEEDED') throw new Error('Athena query timeout');

  return client.send(new GetQueryResultsCommand({ QueryExecutionId: qid }));
}

function buildQuery({ documentId, from, to }: AnalyticsQueryParams, table: string): string {
  const conditions: string[] = [`document_id = '${documentId.replace(/'/g, "''")}'`];
  if (from) conditions.push(`ts >= timestamp '${from}'`);
  if (to) conditions.push(`ts <= timestamp '${to}'`);
  const where = conditions.join(' AND ');
  return `
    WITH series AS (
      SELECT date_trunc('hour', ts) as ts_hour,
             count_if(event_type = 'slide_viewed') as views,
             count_if(event_type = 'completed') as completions
      FROM ${table}
      WHERE ${where}
      GROUP BY 1
      ORDER BY 1
    ), totals AS (
      SELECT sum(views) as views, sum(completions) as completions FROM series
    )
    SELECT 'series' as section, cast(ts_hour as varchar) as ts, views, completions FROM series
    UNION ALL
    SELECT 'totals' as section, NULL as ts, views, completions FROM totals
  `;
}

function mapResults(rows: any[]): { totals: { views: number; completions: number }; series: AnalyticsSeriesPoint[] } {
  // First row is header in Athena API; skip if necessary
  const data = rows.map((r) => r.Data?.map((d: any) => d.VarCharValue ?? null) ?? []);
  const header = data[0] || [];
  const body = header.includes('section') ? data.slice(1) : data;
  const series: AnalyticsSeriesPoint[] = [];
  let totalsViews = 0;
  let totalsCompletions = 0;
  for (const row of body) {
    const [section, ts, viewsStr, compsStr] = row;
    const views = Number(viewsStr || 0);
    const completions = Number(compsStr || 0);
    if (section === 'series') {
      if (ts) series.push({ ts: String(ts), views, completions });
    } else if (section === 'totals') {
      totalsViews = views;
      totalsCompletions = completions;
    }
  }
  return { totals: { views: totalsViews, completions: totalsCompletions }, series };
}

export async function handler(event: any): Promise<{ statusCode: number; body: string }> {
  try {
    const docId = event?.pathParameters?.documentId;
    if (!docId) throw new ValidationError('Missing documentId');
    const qs = event?.queryStringParameters || {};
    const from = qs.from;
    const to = qs.to;

    const db = process.env.ATHENA_DB || 'analytics';
    const table = process.env.ATHENA_TABLE || 'events';
    const output = process.env.ATHENA_OUTPUT_S3 || process.env.ANALYTICS_DATALAKE_BUCKET || '';
    if (!output) throw new Error('ATHENA_OUTPUT_S3 not configured');
    const outputLocation = output.startsWith('s3://') ? output : `s3://${output}/athena-results/`;

    const client = new AthenaClient({ region: process.env.AWS_REGION || 'us-west-2' });
    const query = buildQuery({ documentId: docId, from, to }, `${db}.${table}`);
    const results = await runAthenaQuery(client, { db, output: outputLocation, query });

    const rows = results.ResultSet?.Rows || [];
    const mapped = mapResults(rows);

    const response: AnalyticsResponse = {
      documentId: docId,
      from,
      to,
      totals: mapped.totals,
      series: mapped.series,
    };

    return { statusCode: 200, body: JSON.stringify(response) };
  } catch (err: any) {
    if (err instanceof ValidationError) {
      return { statusCode: 400, body: JSON.stringify({ message: err.message }) };
    }
    return { statusCode: 500, body: JSON.stringify({ message: 'Internal Server Error' }) };
  }
}
