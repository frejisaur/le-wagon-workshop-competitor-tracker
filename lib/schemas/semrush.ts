import {z} from 'zod';

const nullableNumber = z.number().finite().nullable();
const nullableString = z.string().nullable();
const numericMap = z.record(z.string(), nullableNumber);

const AuthoritySchema = z.object({
  backlinks: nullableNumber, health: nullableNumber, link_power: nullableNumber,
  naturalness: nullableNumber, referring_domains: nullableNumber, score: nullableNumber,
  search_traffic_factor: nullableNumber,
}).strict();

const BacklinksDetailSchema = z.object({
  domains: nullableNumber, follow: nullableNumber, forms: nullableNumber, frames: nullableNumber,
  images: nullableNumber, ips: nullableNumber, links: nullableNumber, nofollow: nullableNumber,
  total_backlinks: nullableNumber,
  top_anchors: z.array(z.object({anchor: nullableString, backlinks: nullableNumber, domains: nullableNumber}).strict()),
  sample_backlinks: z.array(z.object({
    anchor: nullableString, nofollow: z.boolean().nullable(), source_title: nullableString,
    source_url: nullableString, target_url: nullableString,
  }).strict()),
}).strict();

const TrendPointSchema = z.object({
  date: z.string(), rank: nullableNumber, organic_traffic: nullableNumber,
  organic_keywords: nullableNumber, organic_traffic_cost_usd: nullableNumber,
  branded_traffic: nullableNumber, non_branded_traffic: nullableNumber, paid_traffic: nullableNumber,
  paid_keywords: nullableNumber, paid_traffic_cost_usd: nullableNumber, serp_feature_traffic: nullableNumber,
}).strict();

const OrganicSchema = z.object({
  competitors_total: nullableNumber,
  country_summary: z.null(),
  top_keywords: z.array(z.object({
    keyword: nullableString, position: nullableNumber, previous_position: nullableNumber,
    position_difference: nullableNumber, volume: nullableNumber, cpc_usd: nullableNumber,
    keyword_difficulty: nullableNumber, competition: nullableNumber, traffic: nullableNumber,
    traffic_share_pct: nullableNumber, traffic_cost_usd: nullableNumber, url: nullableString,
    intents: z.array(z.string()), serp_features_codes: z.array(z.number().finite()), results: nullableNumber,
  }).strict()),
  competitors: z.array(z.object({
    domain: nullableString, common_keywords: nullableNumber, competition_level: nullableNumber,
    organic_keywords: nullableNumber, organic_traffic: nullableNumber, organic_traffic_cost_usd: nullableNumber,
    paid_keywords: nullableNumber, serp_feature_keywords: nullableNumber, serp_feature_traffic: nullableNumber,
    total_traffic: nullableNumber, total_traffic_cost_usd: nullableNumber,
  }).strict()),
  trend_country_daily: z.array(TrendPointSchema), trend_country_monthly: z.array(TrendPointSchema),
  trend_global_daily: z.array(TrendPointSchema), trend_global_monthly: z.array(TrendPointSchema),
  summary_by_country_daily: z.array(z.record(z.string(), z.union([z.string(), nullableNumber]))),
  summary_by_country_monthly: z.array(z.record(z.string(), z.union([z.string(), nullableNumber]))),
}).strict();

const PaidSchema = z.object({
  competitors_total: nullableNumber,
  competitors: z.array(z.object({
    domain: nullableString, common_keywords: nullableNumber, competition_level: nullableNumber,
    organic_keywords: nullableNumber, paid_keywords: nullableNumber, ad_traffic: nullableNumber,
    ad_traffic_cost_usd: nullableNumber,
  }).strict()),
  top_ads: z.array(z.object({
    keyword: nullableString, title: nullableString, description: nullableString, visible_url: nullableString,
    url: nullableString, position: nullableNumber, previous_position: nullableNumber, volume: nullableNumber,
    cpc_usd: nullableNumber, keyword_difficulty: nullableNumber, competition: nullableNumber,
    traffic: nullableNumber, traffic_share_pct: nullableNumber, traffic_cost_usd: nullableNumber,
  }).strict()),
}).strict();

const AiSearchSchema = z.object({
  ai_visibility: nullableNumber, ai_visibility_benchmark: nullableNumber,
  total_mentions: nullableNumber, total_cited_pages: nullableNumber,
  by_llm: z.array(z.object({llm: nullableString, llm_code: nullableString, mentions: nullableNumber, self_mentions: nullableNumber, cited_pages: nullableNumber}).strict()),
  by_country: z.array(z.object({country: nullableString, mentions: nullableNumber, visibility: nullableNumber}).strict()),
  top_cited_sources: z.array(z.object({domain: nullableString, mentions: nullableNumber}).strict()),
}).strict();

const SerpFeaturesSchema = z.object({
  total_positions: nullableNumber, keywords_by_feature: numericMap, positions_by_feature: numericMap,
}).strict();

const MozSchema = z.object({
  domain_authority: nullableString, spam_score: nullableString.optional(), linking_root_domains: nullableString,
  ranking_keywords: nullableString,
  linking_domains_trend: z.object({
    discovered_60d: z.array(nullableNumber), lost_60d: z.array(nullableNumber), net_30d: nullableNumber,
  }).strict(),
  top_linking_domains: z.array(z.object({domain: nullableString, domain_authority: nullableNumber}).strict()),
  top_pages: z.array(z.object({url: z.string(), page_authority: nullableNumber}).strict()),
}).strict();

const sections = {authority: AuthoritySchema, backlinks_detail: BacklinksDetailSchema, organic: OrganicSchema, paid: PaidSchema, ai_search: AiSearchSchema, serp_features: SerpFeaturesSchema, moz: MozSchema} as const;

/** Strictly validates independently useful, provider-observed root metrics. */
export const SemrushDomainOverviewSchema = z.object({
  domain: z.string().min(1), database: z.string().min(1), is_root_domain: z.boolean(),
  authority_score: nullableNumber, backlinks: nullableNumber, referring_domains: nullableNumber,
  follow_backlinks: nullableNumber, nofollow_backlinks: nullableNumber, organic_traffic: nullableNumber,
  total_traffic: nullableNumber, organic_keywords: nullableNumber, organic_traffic_cost_usd: nullableNumber,
  organic_competitors_count: nullableNumber, paid_traffic: nullableNumber, paid_keywords: nullableNumber,
  paid_traffic_cost_usd: nullableNumber, paid_competitors_count: nullableNumber, ai_visibility: nullableNumber,
  ai_visibility_benchmark: nullableNumber, ai_mentions: nullableNumber, ai_cited_pages: nullableNumber,
  top_country: nullableString, top_country_traffic: nullableNumber, moz_domain_authority: nullableString,
  moz_spam_score: nullableString,
  authority: z.unknown(), backlinks_detail: z.unknown(), organic: z.unknown(), paid: z.unknown(),
  ai_search: z.unknown(), serp_features: z.unknown(), moz: z.unknown(),
}).strict();

type SectionName = keyof typeof sections;
export type SemrushSectionIssue = {domain: string; section: SectionName; message: string};
export type SemrushDomainOverview = Omit<z.infer<typeof SemrushDomainOverviewSchema>, SectionName> & Partial<{
  [Name in SectionName]: z.infer<(typeof sections)[Name]>;
}>;

/** Keeps a valid provider record usable when one nested enrichment module drifts. */
export function parseSemrushPayload(value: unknown): {records: SemrushDomainOverview[]; issues: SemrushSectionIssue[]} {
  if (!Array.isArray(value)) throw new TypeError('Semrush payload must be an array');
  const records: SemrushDomainOverview[] = [];
  const issues: SemrushSectionIssue[] = [];
  for (const [index, rawRecord] of value.entries()) {
    const root = SemrushDomainOverviewSchema.safeParse(rawRecord);
    if (!root.success) throw new Error(`Semrush record ${index} is invalid: ${root.error.message}`);
    const {
      authority, backlinks_detail, organic, paid, ai_search, serp_features, moz,
      ...topLevel
    } = root.data;
    const rawSections = {authority, backlinks_detail, organic, paid, ai_search, serp_features, moz};
    const record: SemrushDomainOverview = topLevel;
    for (const [section, schema] of Object.entries(sections) as [SectionName, (typeof sections)[SectionName]][]) {
      const result = schema.safeParse(rawSections[section]);
      if (result.success) Object.assign(record, {[section]: result.data});
      else {
        delete record[section];
        issues.push({domain: record.domain, section, message: result.error.message});
      }
    }
    records.push(record);
  }
  return {records, issues};
}
