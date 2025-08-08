import { describe, it, expect, beforeEach } from 'vitest';
import { ConfigurationManager } from '../ConfigurationManager';

const baseEnv = {
  AWS_REGION: 'us-east-1',
  AWS_ACCOUNT_ID: '123456789012',
  DOCUMENT_REGISTRY_TABLE: 'doc-reg',
  USER_SESSIONS_TABLE: 'sessions',
  USER_PROFILES_TABLE: 'profiles',
  ASSESSMENTS_TABLE: 'assess',
  USER_RESPONSES_TABLE: 'responses',
  SESSION_SUMMARIES_TABLE: 'summaries',
  RAW_DOCUMENTS_BUCKET: 'raw-bkt',
  PROCESSED_CONTENT_BUCKET: 'proc-bkt',
  ANALYTICS_DATALAKE_BUCKET: 'lake-bkt',
  OPENSEARCH_ENDPOINT: 'https://opensearch.local',
  PGVECTOR_CONNECTION_URL: 'postgres://user:pass@host/db',
  COGNITO_USER_POOL_ID: 'pool',
  COGNITO_USER_POOL_CLIENT_ID: 'client',
  API_BASE_URL: 'https://api.local',
  API_TIMEOUT_MS: '2000',
  BEDROCK_REGION: 'us-east-1',
  BEDROCK_MODEL_ID_CLAUDE: 'anthropic.claude-3-sonnet-20240229-v1:0',
  BEDROCK_EMBEDDING_MODEL: 'embed-model',
  FF_PARSE_TEXTRACT: '1',
  FF_PARSE_FAST: '0',
  FF_ANALYTICS_REALTIME: '1'
} as unknown as NodeJS.ProcessEnv;

beforeEach(() => {
  ConfigurationManager.resetForTesting();
});

describe('ConfigurationManager', () => {
  it('loads and provides typed config', () => {
    const cm = ConfigurationManager.loadAndValidateConfig(baseEnv).get();
    expect(cm.AWS_REGION).toBe('us-east-1');
    expect(cm.API_TIMEOUT_MS).toBe(2000);
    expect(cm.featureFlags.parseTextract).toBe(true);
    expect(cm.featureFlags.parseFast).toBe(false);
    expect(cm.featureFlags.analyticsRealtime).toBe(true);
  });

  it('throws with helpful error on missing vars', () => {
    const bad = { ...baseEnv };
    delete (bad as any).AWS_REGION;
    expect(() => ConfigurationManager.loadAndValidateConfig(bad)).toThrow(/AWS_REGION/);
  });
});
