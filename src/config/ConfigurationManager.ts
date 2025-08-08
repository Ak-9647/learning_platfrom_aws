import { z } from 'zod';

const envSchema = z.object({
  AWS_REGION: z.string().min(1),
  AWS_ACCOUNT_ID: z.string().min(1),
  DOCUMENT_REGISTRY_TABLE: z.string().min(1),
  USER_SESSIONS_TABLE: z.string().min(1),
  USER_PROFILES_TABLE: z.string().min(1),
  ASSESSMENTS_TABLE: z.string().min(1),
  USER_RESPONSES_TABLE: z.string().min(1),
  SESSION_SUMMARIES_TABLE: z.string().min(1),
  RAW_DOCUMENTS_BUCKET: z.string().min(1),
  PROCESSED_CONTENT_BUCKET: z.string().min(1),
  ANALYTICS_DATALAKE_BUCKET: z.string().min(1),
  OPENSEARCH_ENDPOINT: z.string().url().or(z.string().min(1)),
  PGVECTOR_CONNECTION_URL: z.string().min(1),
  COGNITO_USER_POOL_ID: z.string().min(1),
  COGNITO_USER_POOL_CLIENT_ID: z.string().min(1),
  API_BASE_URL: z.string().url().or(z.string().min(1)),
  API_TIMEOUT_MS: z.coerce.number().int().positive(),
  BEDROCK_REGION: z.string().min(1),
  BEDROCK_MODEL_ID_CLAUDE: z.string().min(1),
  BEDROCK_EMBEDDING_MODEL: z.string().min(1),
  FF_PARSE_TEXTRACT: z.coerce.number().int().min(0).max(1),
  FF_PARSE_FAST: z.coerce.number().int().min(0).max(1),
  FF_ANALYTICS_REALTIME: z.coerce.number().int().min(0).max(1)
});

export type AppConfig = z.infer<typeof envSchema> & {
  featureFlags: {
    parseTextract: boolean;
    parseFast: boolean;
    analyticsRealtime: boolean;
  };
};

export class ConfigurationManager {
  private static instance: ConfigurationManager | null = null;
  private readonly config: AppConfig;

  private constructor(env: NodeJS.ProcessEnv) {
    const parsed = envSchema.safeParse(env);
    if (!parsed.success) {
      const issues = parsed.error.issues.map(i => `- ${i.path.join('.')}: ${i.message}`).join('\n');
      throw new Error(`Missing/invalid environment variables:\n${issues}`);
    }
    const data = parsed.data;
    this.config = {
      ...data,
      featureFlags: {
        parseTextract: Number(data.FF_PARSE_TEXTRACT) === 1,
        parseFast: Number(data.FF_PARSE_FAST) === 1,
        analyticsRealtime: Number(data.FF_ANALYTICS_REALTIME) === 1
      }
    } as AppConfig;
  }

  public static loadAndValidateConfig(env: NodeJS.ProcessEnv = process.env): ConfigurationManager {
    // If a non-default env is passed, rebuild instance to respect provided values
    if (env !== process.env) {
      ConfigurationManager.instance = new ConfigurationManager(env);
      return ConfigurationManager.instance;
    }
    if (!ConfigurationManager.instance) {
      ConfigurationManager.instance = new ConfigurationManager(env);
    }
    return ConfigurationManager.instance;
  }

  // For tests only
  public static resetForTesting(): void {
    ConfigurationManager.instance = null;
  }

  public get(): AppConfig {
    return this.config;
  }

  public get apiTimeoutMs(): number {
    return this.config.API_TIMEOUT_MS;
  }

  public get bedrockRegion(): string {
    return this.config.BEDROCK_REGION;
  }

  public get parseTextractEnabled(): boolean {
    return this.config.featureFlags.parseTextract;
  }
}
