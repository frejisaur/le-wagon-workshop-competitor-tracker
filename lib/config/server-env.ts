import {z} from 'zod';

const AirtableEnvSchema = z.object({
  AIRTABLE_PAT: z.string().min(1),
  AIRTABLE_BASE_ID: z.string().min(1),
  AIRTABLE_COMPANIES_TABLE: z.string().min(1),
  AIRTABLE_KEYWORDS_TABLE: z.string().min(1),
  AIRTABLE_PAID_ADS_TABLE: z.string().min(1),
  AIRTABLE_GTM_INSIGHTS_TABLE: z.string().min(1),
  AIRTABLE_INSIGHT_REVIEWS_TABLE: z.string().min(1),
  AIRTABLE_SYSTEM_TABLE: z.string().min(1),
});

const RefreshOnlyEnvSchema = z.object({
  APIFY_TOKEN: z.string().min(1),
  APIFY_ACTOR_ID: z.string().min(1),
  APP_BASE_URL: z.string().url(),
  CACHE_INVALIDATION_SECRET: z.string().min(1),
});

const WebEnvSchema = AirtableEnvSchema;
const RefreshEnvSchema = AirtableEnvSchema.extend(RefreshOnlyEnvSchema.shape);
const InsightEnvSchema = AirtableEnvSchema;
const CacheInvalidationEnvSchema = z.object({CACHE_INVALIDATION_SECRET: z.string().min(1)});

export type WebEnv = z.infer<typeof WebEnvSchema>;
export type RefreshEnv = z.infer<typeof RefreshEnvSchema>;
export type InsightEnv = z.infer<typeof InsightEnvSchema>;
export type CacheInvalidationEnv = z.infer<typeof CacheInvalidationEnvSchema>;
type EnvSource = NodeJS.Dict<string>;

function formatEnvError(error: z.ZodError): string {
  const names = [...new Set(error.issues.map((issue) => issue.path.join('.')))]
    .sort((left, right) => envNameOrder(left) - envNameOrder(right));
  return `Missing or invalid server environment variables: ${names.join(', ')}`;
}

function envNameOrder(name: string): number {
  const priority = [
    'AIRTABLE_PAT',
    'AIRTABLE_BASE_ID',
    'APIFY_TOKEN',
    'APIFY_ACTOR_ID',
  ];
  const index = priority.indexOf(name);
  return index === -1 ? priority.length : index;
}

function parseEnv<T extends z.ZodType>(schema: T, source: EnvSource): z.infer<T> {
  const result = schema.safeParse(source);
  if (!result.success) {
    throw new Error(formatEnvError(result.error));
  }
  return result.data;
}

export function getWebEnv(source: EnvSource = process.env): WebEnv {
  return parseEnv(WebEnvSchema, source);
}

export function getRefreshEnv(source: EnvSource = process.env): RefreshEnv {
  return parseEnv(RefreshEnvSchema, source);
}

export function getInsightEnv(source: EnvSource = process.env): InsightEnv {
  return parseEnv(InsightEnvSchema, source);
}

/** The signed internal endpoint needs only its own secret, never refresh credentials. */
export function getCacheInvalidationEnv(source: EnvSource = process.env): CacheInvalidationEnv {
  return parseEnv(CacheInvalidationEnvSchema, source);
}
