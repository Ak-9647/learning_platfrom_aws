import { describe, it, expect, vi } from 'vitest';
import * as analytics from '../analytics';
import { AthenaClient } from '@aws-sdk/client-athena';

vi.mock('@aws-sdk/client-athena', async (orig) => {
  const actual = await (orig as any)();
  return {
    ...actual,
    AthenaClient: vi.fn().mockImplementation(() => ({
      send: vi.fn(async (cmd: any) => {
        const name = cmd.constructor.name;
        if (name === 'StartQueryExecutionCommand') {
          return { QueryExecutionId: 'qid-1' };
        }
        if (name === 'GetQueryExecutionCommand') {
          return { QueryExecution: { Status: { State: 'SUCCEEDED' } } };
        }
        if (name === 'GetQueryResultsCommand') {
          return {
            ResultSet: {
              Rows: [
                { Data: [{ VarCharValue: 'section' }, { VarCharValue: 'ts' }, { VarCharValue: 'views' }, { VarCharValue: 'completions' }] },
                { Data: [{ VarCharValue: 'series' }, { VarCharValue: '2025-08-09T00:00:00Z' }, { VarCharValue: '5' }, { VarCharValue: '1' }] },
                { Data: [{ VarCharValue: 'totals' }, { VarCharValue: null }, { VarCharValue: '5' }, { VarCharValue: '1' }] },
              ],
            },
          };
        }
        return {};
      }),
    })),
  };
});

describe('analytics handler', () => {
  it('validates missing path param', async () => {
    const res = await analytics.handler({ pathParameters: {} });
    expect(res.statusCode).toBe(400);
  });

  it('returns series and totals from mocked Athena', async () => {
    process.env.ATHENA_OUTPUT_S3 = 's3://test-output-bucket/athena-results/';
    const res = await analytics.handler({ pathParameters: { documentId: 'doc-1' }, queryStringParameters: {} });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.documentId).toBe('doc-1');
    expect(body.totals.views).toBe(5);
    expect(body.series[0].views).toBe(5);
  });
});
