# Observed Semrush Domain Overview schema

> Generated from the repository payload. This is an observed sample contract,
> not a guarantee that the provider cannot return additional fields or types.

## Contents

- [Source summary](#source-summary)
- [Root record fields](#root-record-fields)
- [Object shapes](#object-shapes)
- [Array shapes](#array-shapes)
- [Scalar field inventory](#scalar-field-inventory)

## Source summary

| Property | Value |
|---|---:|
| Source | `apollo-accounts-semrush-scraper.json` |
| SHA-256 | `52b4f5e8a2401f69a6a2ba97c283b46da569e3974212e998f610a4d1e85d2fe7` |
| Bytes | 38552987 |
| Records analyzed | 52 |
| Top-level fields | 32 |
| Object paths | 27 |
| Array paths | 21 |
| Scalar paths | 297 |

Paths use `[]` for an array item. Coverage is the number of root company
records containing a path, not the number of nested objects. `Values` counts
all observed scalar occurrences. Formats are inferred conservatively from
values; an empty format cell means no special representation was detected.

## Root record fields

| Field | Observed types | Record coverage | Values/instances | Nulls | Formats |
|---|---|---:|---:|---:|---|
| `ai_cited_pages` | number | 52/52 | 52 | 0 | integer |
| `ai_mentions` | number | 52/52 | 52 | 0 | integer |
| `ai_search` | object | 52/52 | 52 | 0 |  |
| `ai_visibility` | number | 52/52 | 52 | 0 | integer |
| `ai_visibility_benchmark` | number | 52/52 | 52 | 0 | integer |
| `authority` | object | 52/52 | 52 | 0 |  |
| `authority_score` | number | 52/52 | 52 | 0 | integer |
| `backlinks` | number | 52/52 | 52 | 0 | integer |
| `backlinks_detail` | object | 52/52 | 52 | 0 |  |
| `database` | string | 52/52 | 52 | 0 |  |
| `domain` | string | 52/52 | 52 | 0 | domain |
| `follow_backlinks` | number | 52/52 | 52 | 0 | integer |
| `is_root_domain` | boolean | 52/52 | 52 | 0 |  |
| `moz` | object | 52/52 | 52 | 0 |  |
| `moz_domain_authority` | string | 52/52 | 52 | 0 | numeric-string |
| `moz_spam_score` | null, string | 52/52 | 52 | 1 | percentage |
| `nofollow_backlinks` | number | 52/52 | 52 | 0 | integer |
| `organic` | object | 52/52 | 52 | 0 |  |
| `organic_competitors_count` | number | 52/52 | 52 | 0 | integer |
| `organic_keywords` | number | 52/52 | 52 | 0 | integer |
| `organic_traffic` | number | 52/52 | 52 | 0 | integer |
| `organic_traffic_cost_usd` | number | 52/52 | 52 | 0 | integer |
| `paid` | object | 52/52 | 52 | 0 |  |
| `paid_competitors_count` | number | 52/52 | 52 | 0 | integer |
| `paid_keywords` | number | 52/52 | 52 | 0 | integer |
| `paid_traffic` | number | 52/52 | 52 | 0 | integer |
| `paid_traffic_cost_usd` | number | 52/52 | 52 | 0 | integer |
| `referring_domains` | number | 52/52 | 52 | 0 | integer |
| `serp_features` | object | 52/52 | 52 | 0 |  |
| `top_country` | string | 52/52 | 52 | 0 |  |
| `top_country_traffic` | number | 52/52 | 52 | 0 | integer |
| `total_traffic` | number | 52/52 | 52 | 0 | integer |

## Object shapes

| Path | Record coverage | Instances | Observed keys |
|---|---:|---:|---|
| `ai_search` | 52/52 | 52 | `ai_visibility`, `ai_visibility_benchmark`, `by_country`, `by_llm`, `top_cited_sources`, `total_cited_pages`, `total_mentions` |
| `ai_search.by_country[]` | 52/52 | 6136 | `country`, `mentions`, `visibility` |
| `ai_search.by_llm[]` | 52/52 | 208 | `cited_pages`, `llm`, `llm_code`, `mentions`, `self_mentions` |
| `ai_search.top_cited_sources[]` | 49/52 | 470 | `domain`, `mentions` |
| `authority` | 52/52 | 52 | `backlinks`, `health`, `link_power`, `naturalness`, `referring_domains`, `score`, `search_traffic_factor` |
| `backlinks_detail` | 52/52 | 52 | `domains`, `follow`, `forms`, `frames`, `images`, `ips`, `links`, `nofollow`, `sample_backlinks`, `top_anchors`, `total_backlinks` |
| `backlinks_detail.sample_backlinks[]` | 52/52 | 260 | `anchor`, `nofollow`, `source_title`, `source_url`, `target_url` |
| `backlinks_detail.top_anchors[]` | 52/52 | 260 | `anchor`, `backlinks`, `domains` |
| `moz` | 52/52 | 52 | `domain_authority`, `linking_domains_trend`, `linking_root_domains`, `ranking_keywords`, `spam_score`, `top_linking_domains`, `top_pages` |
| `moz.linking_domains_trend` | 52/52 | 52 | `discovered_60d`, `lost_60d`, `net_30d` |
| `moz.top_linking_domains[]` | 52/52 | 364 | `domain`, `domain_authority` |
| `moz.top_pages[]` | 52/52 | 520 | `page_authority`, `url` |
| `organic` | 52/52 | 52 | `competitors`, `competitors_total`, `country_summary`, `summary_by_country_daily`, `summary_by_country_monthly`, `top_keywords`, `trend_country_daily`, `trend_country_monthly`, `trend_global_daily`, `trend_global_monthly` |
| `organic.competitors[]` | 52/52 | 312 | `common_keywords`, `competition_level`, `domain`, `organic_keywords`, `organic_traffic`, `organic_traffic_cost_usd`, `paid_keywords`, `serp_feature_keywords`, `serp_feature_traffic`, `total_traffic`, `total_traffic_cost_usd` |
| `organic.summary_by_country_daily[]` | 52/52 | 1579 | `adwordsPositions`, `adwordsTraffic`, `adwordsTrafficCost`, `database`, `organicPositions`, `organicTraffic`, `organicTrafficBranded`, `organicTrafficCost`, `organicTrafficNonBranded`, `positions`, `rank`, `serpFeaturesPositions`, `serpFeaturesTraffic`, `serpFeaturesTrafficBranded`, `serpFeaturesTrafficCost`, `serpFeaturesTrafficNonBranded`, `traffic`, `trafficBranded`, `trafficCost`, `trafficNonBranded` |
| `organic.summary_by_country_monthly[]` | 52/52 | 2007 | `adwordsPositions`, `adwordsTraffic`, `adwordsTrafficCost`, `database`, `organicPositions`, `organicTraffic`, `organicTrafficBranded`, `organicTrafficCost`, `organicTrafficNonBranded`, `positions`, `rank`, `serpFeaturesPositions`, `serpFeaturesTraffic`, `serpFeaturesTrafficBranded`, `serpFeaturesTrafficCost`, `serpFeaturesTrafficNonBranded`, `traffic`, `trafficBranded`, `trafficCost`, `trafficNonBranded` |
| `organic.top_keywords[]` | 52/52 | 358 | `competition`, `cpc_usd`, `intents`, `keyword`, `keyword_difficulty`, `position`, `position_difference`, `previous_position`, `results`, `serp_features_codes`, `traffic`, `traffic_cost_usd`, `traffic_share_pct`, `url`, `volume` |
| `organic.trend_country_daily[]` | 52/52 | 37908 | `branded_traffic`, `date`, `non_branded_traffic`, `organic_keywords`, `organic_traffic`, `organic_traffic_cost_usd`, `paid_keywords`, `paid_traffic`, `paid_traffic_cost_usd`, `rank`, `serp_feature_traffic` |
| `organic.trend_country_monthly[]` | 52/52 | 9152 | `branded_traffic`, `date`, `non_branded_traffic`, `organic_keywords`, `organic_traffic`, `organic_traffic_cost_usd`, `paid_keywords`, `paid_traffic`, `paid_traffic_cost_usd`, `rank`, `serp_feature_traffic` |
| `organic.trend_global_daily[]` | 52/52 | 37908 | `branded_traffic`, `date`, `non_branded_traffic`, `organic_keywords`, `organic_traffic`, `organic_traffic_cost_usd`, `paid_keywords`, `paid_traffic`, `paid_traffic_cost_usd`, `rank`, `serp_feature_traffic` |
| `organic.trend_global_monthly[]` | 52/52 | 9152 | `branded_traffic`, `date`, `non_branded_traffic`, `organic_keywords`, `organic_traffic`, `organic_traffic_cost_usd`, `paid_keywords`, `paid_traffic`, `paid_traffic_cost_usd`, `rank`, `serp_feature_traffic` |
| `paid` | 52/52 | 52 | `competitors`, `competitors_total`, `top_ads` |
| `paid.competitors[]` | 52/52 | 59 | `ad_traffic`, `ad_traffic_cost_usd`, `common_keywords`, `competition_level`, `domain`, `organic_keywords`, `paid_keywords` |
| `paid.top_ads[]` | 5/52 | 16 | `competition`, `cpc_usd`, `description`, `keyword`, `keyword_difficulty`, `position`, `previous_position`, `title`, `traffic`, `traffic_cost_usd`, `traffic_share_pct`, `url`, `visible_url`, `volume` |
| `serp_features` | 52/52 | 52 | `keywords_by_feature`, `positions_by_feature`, `total_positions` |
| `serp_features.keywords_by_feature` | 52/52 | 52 | `0`, `1`, `10`, `11`, `12`, `13`, `14`, `15`, `16`, `17`, `18`, `19`, `2`, `20`, `21`, `22`, `23`, `24`, `25`, `26`, `27`, `28`, `29`, `3`, `30`, `31`, `32`, `34`, `35`, `36`, `37`, `38`, `39`, `4`, `40`, `41`, `42`, `43`, `44`, `45`, `46`, `47`, `48`, `49`, `5`, `50`, `51`, `52`, `6`, `7`, `8`, `9` |
| `serp_features.positions_by_feature` | 52/52 | 52 | `1`, `10`, `11`, `12`, `13`, `18`, `19`, `20`, `21`, `22`, `24`, `25`, `26`, `27`, `28`, `29`, `3`, `31`, `38`, `39`, `4`, `40`, `41`, `42`, `43`, `44`, `45`, `46`, `47`, `48`, `5`, `52`, `6`, `7`, `8`, `9` |

## Array shapes

| Path | Record coverage | Array instances | Minimum length | Median length | Maximum length | Item types |
|---|---:|---:|---:|---:|---:|---|
| `ai_search.by_country` | 52/52 | 52 | 118 | 118 | 118 | object |
| `ai_search.by_llm` | 52/52 | 52 | 4 | 4 | 4 | object |
| `ai_search.top_cited_sources` | 52/52 | 52 | 0 | 10 | 10 | object |
| `backlinks_detail.sample_backlinks` | 52/52 | 52 | 5 | 5 | 5 | object |
| `backlinks_detail.top_anchors` | 52/52 | 52 | 5 | 5 | 5 | object |
| `moz.linking_domains_trend.discovered_60d` | 52/52 | 52 | 7 | 23.5 | 50 | number |
| `moz.linking_domains_trend.lost_60d` | 52/52 | 52 | 1 | 9 | 36 | number |
| `moz.top_linking_domains` | 52/52 | 52 | 7 | 7 | 7 | object |
| `moz.top_pages` | 52/52 | 52 | 10 | 10 | 10 | object |
| `organic.competitors` | 52/52 | 52 | 6 | 6 | 6 | object |
| `organic.summary_by_country_daily` | 52/52 | 52 | 3 | 24.5 | 122 | object |
| `organic.summary_by_country_monthly` | 52/52 | 52 | 5 | 33.5 | 130 | object |
| `organic.top_keywords` | 52/52 | 52 | 1 | 7 | 7 | object |
| `organic.top_keywords[].intents` | 52/52 | 358 | 1 | 1 | 2 | string |
| `organic.top_keywords[].serp_features_codes` | 52/52 | 358 | 0 | 1 | 4 | number |
| `organic.trend_country_daily` | 52/52 | 52 | 729 | 729 | 729 | object |
| `organic.trend_country_monthly` | 52/52 | 52 | 176 | 176 | 176 | object |
| `organic.trend_global_daily` | 52/52 | 52 | 729 | 729 | 729 | object |
| `organic.trend_global_monthly` | 52/52 | 52 | 176 | 176 | 176 | object |
| `paid.competitors` | 52/52 | 52 | 1 | 1 | 6 | object |
| `paid.top_ads` | 52/52 | 52 | 0 | 0 | 6 | object |

## Scalar field inventory

| Path | Observed types | Record coverage | Values | Nulls | Formats |
|---|---|---:|---:|---:|---|
| `ai_cited_pages` | number | 52/52 | 52 | 0 | integer |
| `ai_mentions` | number | 52/52 | 52 | 0 | integer |
| `ai_search.ai_visibility` | number | 52/52 | 52 | 0 | integer |
| `ai_search.ai_visibility_benchmark` | number | 52/52 | 52 | 0 | integer |
| `ai_search.by_country[].country` | string | 52/52 | 6136 | 0 |  |
| `ai_search.by_country[].mentions` | number | 52/52 | 6136 | 0 | integer |
| `ai_search.by_country[].visibility` | number | 52/52 | 6136 | 0 | integer |
| `ai_search.by_llm[].cited_pages` | number | 52/52 | 208 | 0 | integer |
| `ai_search.by_llm[].llm` | string | 52/52 | 208 | 0 |  |
| `ai_search.by_llm[].llm_code` | string | 52/52 | 208 | 0 |  |
| `ai_search.by_llm[].mentions` | number | 52/52 | 208 | 0 | integer |
| `ai_search.by_llm[].self_mentions` | number | 52/52 | 208 | 0 | integer |
| `ai_search.top_cited_sources[].domain` | string | 49/52 | 470 | 0 | domain |
| `ai_search.top_cited_sources[].mentions` | number | 49/52 | 470 | 0 | integer |
| `ai_search.total_cited_pages` | number | 52/52 | 52 | 0 | integer |
| `ai_search.total_mentions` | number | 52/52 | 52 | 0 | integer |
| `ai_visibility` | number | 52/52 | 52 | 0 | integer |
| `ai_visibility_benchmark` | number | 52/52 | 52 | 0 | integer |
| `authority_score` | number | 52/52 | 52 | 0 | integer |
| `authority.backlinks` | number | 52/52 | 52 | 0 | integer |
| `authority.health` | number | 52/52 | 52 | 0 | integer |
| `authority.link_power` | number | 52/52 | 52 | 0 | decimal, integer |
| `authority.naturalness` | number | 52/52 | 52 | 0 | integer |
| `authority.referring_domains` | number | 52/52 | 52 | 0 | integer |
| `authority.score` | number | 52/52 | 52 | 0 | integer |
| `authority.search_traffic_factor` | number | 52/52 | 52 | 0 | decimal, integer |
| `backlinks` | number | 52/52 | 52 | 0 | integer |
| `backlinks_detail.domains` | number | 52/52 | 52 | 0 | integer |
| `backlinks_detail.follow` | number | 52/52 | 52 | 0 | integer |
| `backlinks_detail.forms` | number | 52/52 | 52 | 0 | integer |
| `backlinks_detail.frames` | number | 52/52 | 52 | 0 | integer |
| `backlinks_detail.images` | number | 52/52 | 52 | 0 | integer |
| `backlinks_detail.ips` | number | 52/52 | 52 | 0 | integer |
| `backlinks_detail.links` | number | 52/52 | 52 | 0 | integer |
| `backlinks_detail.nofollow` | number | 52/52 | 52 | 0 | integer |
| `backlinks_detail.sample_backlinks[].anchor` | string | 52/52 | 260 | 0 | domain, empty-string, url |
| `backlinks_detail.sample_backlinks[].nofollow` | boolean | 52/52 | 260 | 0 |  |
| `backlinks_detail.sample_backlinks[].source_title` | string | 52/52 | 260 | 0 | empty-string |
| `backlinks_detail.sample_backlinks[].source_url` | string | 52/52 | 260 | 0 | url |
| `backlinks_detail.sample_backlinks[].target_url` | string | 52/52 | 260 | 0 | url |
| `backlinks_detail.top_anchors[].anchor` | string | 52/52 | 260 | 0 | domain, url |
| `backlinks_detail.top_anchors[].backlinks` | number | 52/52 | 260 | 0 | integer |
| `backlinks_detail.top_anchors[].domains` | number | 52/52 | 260 | 0 | integer |
| `backlinks_detail.total_backlinks` | number | 52/52 | 52 | 0 | integer |
| `database` | string | 52/52 | 52 | 0 |  |
| `domain` | string | 52/52 | 52 | 0 | domain |
| `follow_backlinks` | number | 52/52 | 52 | 0 | integer |
| `is_root_domain` | boolean | 52/52 | 52 | 0 |  |
| `moz_domain_authority` | string | 52/52 | 52 | 0 | numeric-string |
| `moz_spam_score` | null, string | 52/52 | 52 | 1 | percentage |
| `moz.domain_authority` | string | 52/52 | 52 | 0 | numeric-string |
| `moz.linking_domains_trend.discovered_60d[]` | number | 52/52 | 1240 | 0 | integer |
| `moz.linking_domains_trend.lost_60d[]` | number | 52/52 | 625 | 0 | integer |
| `moz.linking_domains_trend.net_30d` | number | 52/52 | 52 | 0 | integer |
| `moz.linking_root_domains` | string | 52/52 | 52 | 0 | compact-number, numeric-string |
| `moz.ranking_keywords` | string | 52/52 | 52 | 0 | compact-number, numeric-string |
| `moz.spam_score` | string | 51/52 | 51 | 0 | percentage |
| `moz.top_linking_domains[].domain` | string | 52/52 | 364 | 0 | domain |
| `moz.top_linking_domains[].domain_authority` | number | 52/52 | 364 | 0 | integer |
| `moz.top_pages[].page_authority` | number | 52/52 | 520 | 0 | integer |
| `moz.top_pages[].url` | string | 52/52 | 520 | 0 | domain |
| `nofollow_backlinks` | number | 52/52 | 52 | 0 | integer |
| `organic_competitors_count` | number | 52/52 | 52 | 0 | integer |
| `organic_keywords` | number | 52/52 | 52 | 0 | integer |
| `organic_traffic` | number | 52/52 | 52 | 0 | integer |
| `organic_traffic_cost_usd` | number | 52/52 | 52 | 0 | integer |
| `organic.competitors_total` | number | 52/52 | 52 | 0 | integer |
| `organic.competitors[].common_keywords` | number | 52/52 | 312 | 0 | integer |
| `organic.competitors[].competition_level` | number | 52/52 | 312 | 0 | decimal, integer |
| `organic.competitors[].domain` | string | 52/52 | 312 | 0 | domain |
| `organic.competitors[].organic_keywords` | number | 52/52 | 312 | 0 | integer |
| `organic.competitors[].organic_traffic` | number | 52/52 | 312 | 0 | integer |
| `organic.competitors[].organic_traffic_cost_usd` | number | 52/52 | 312 | 0 | integer |
| `organic.competitors[].paid_keywords` | number | 52/52 | 312 | 0 | integer |
| `organic.competitors[].serp_feature_keywords` | number | 52/52 | 312 | 0 | integer |
| `organic.competitors[].serp_feature_traffic` | number | 52/52 | 312 | 0 | integer |
| `organic.competitors[].total_traffic` | number | 52/52 | 312 | 0 | integer |
| `organic.competitors[].total_traffic_cost_usd` | number | 52/52 | 312 | 0 | integer |
| `organic.country_summary` | null | 52/52 | 52 | 52 |  |
| `organic.summary_by_country_daily[].adwordsPositions` | number | 52/52 | 1579 | 0 | integer |
| `organic.summary_by_country_daily[].adwordsTraffic` | number | 52/52 | 1579 | 0 | integer |
| `organic.summary_by_country_daily[].adwordsTrafficCost` | number | 52/52 | 1579 | 0 | integer |
| `organic.summary_by_country_daily[].database` | string | 52/52 | 1579 | 0 |  |
| `organic.summary_by_country_daily[].organicPositions` | number | 52/52 | 1579 | 0 | integer |
| `organic.summary_by_country_daily[].organicTraffic` | number | 52/52 | 1579 | 0 | integer |
| `organic.summary_by_country_daily[].organicTrafficBranded` | number | 52/52 | 1579 | 0 | integer |
| `organic.summary_by_country_daily[].organicTrafficCost` | number | 52/52 | 1579 | 0 | integer |
| `organic.summary_by_country_daily[].organicTrafficNonBranded` | number | 52/52 | 1579 | 0 | integer |
| `organic.summary_by_country_daily[].positions` | number | 52/52 | 1579 | 0 | integer |
| `organic.summary_by_country_daily[].rank` | number | 52/52 | 1579 | 0 | integer |
| `organic.summary_by_country_daily[].serpFeaturesPositions` | number | 52/52 | 1579 | 0 | integer |
| `organic.summary_by_country_daily[].serpFeaturesTraffic` | number | 52/52 | 1579 | 0 | integer |
| `organic.summary_by_country_daily[].serpFeaturesTrafficBranded` | number | 52/52 | 1579 | 0 | integer |
| `organic.summary_by_country_daily[].serpFeaturesTrafficCost` | number | 52/52 | 1579 | 0 | integer |
| `organic.summary_by_country_daily[].serpFeaturesTrafficNonBranded` | number | 52/52 | 1579 | 0 | integer |
| `organic.summary_by_country_daily[].traffic` | number | 52/52 | 1579 | 0 | integer |
| `organic.summary_by_country_daily[].trafficBranded` | number | 52/52 | 1579 | 0 | integer |
| `organic.summary_by_country_daily[].trafficCost` | number | 52/52 | 1579 | 0 | integer |
| `organic.summary_by_country_daily[].trafficNonBranded` | number | 52/52 | 1579 | 0 | integer |
| `organic.summary_by_country_monthly[].adwordsPositions` | number | 52/52 | 2007 | 0 | integer |
| `organic.summary_by_country_monthly[].adwordsTraffic` | number | 52/52 | 2007 | 0 | integer |
| `organic.summary_by_country_monthly[].adwordsTrafficCost` | number | 52/52 | 2007 | 0 | integer |
| `organic.summary_by_country_monthly[].database` | string | 52/52 | 2007 | 0 |  |
| `organic.summary_by_country_monthly[].organicPositions` | number | 52/52 | 2007 | 0 | integer |
| `organic.summary_by_country_monthly[].organicTraffic` | number | 52/52 | 2007 | 0 | integer |
| `organic.summary_by_country_monthly[].organicTrafficBranded` | number | 52/52 | 2007 | 0 | integer |
| `organic.summary_by_country_monthly[].organicTrafficCost` | number | 52/52 | 2007 | 0 | integer |
| `organic.summary_by_country_monthly[].organicTrafficNonBranded` | number | 52/52 | 2007 | 0 | integer |
| `organic.summary_by_country_monthly[].positions` | number | 52/52 | 2007 | 0 | integer |
| `organic.summary_by_country_monthly[].rank` | number | 52/52 | 2007 | 0 | integer |
| `organic.summary_by_country_monthly[].serpFeaturesPositions` | number | 52/52 | 2007 | 0 | integer |
| `organic.summary_by_country_monthly[].serpFeaturesTraffic` | number | 52/52 | 2007 | 0 | integer |
| `organic.summary_by_country_monthly[].serpFeaturesTrafficBranded` | number | 52/52 | 2007 | 0 | integer |
| `organic.summary_by_country_monthly[].serpFeaturesTrafficCost` | number | 52/52 | 2007 | 0 | integer |
| `organic.summary_by_country_monthly[].serpFeaturesTrafficNonBranded` | number | 52/52 | 2007 | 0 | integer |
| `organic.summary_by_country_monthly[].traffic` | number | 52/52 | 2007 | 0 | integer |
| `organic.summary_by_country_monthly[].trafficBranded` | number | 52/52 | 2007 | 0 | integer |
| `organic.summary_by_country_monthly[].trafficCost` | number | 52/52 | 2007 | 0 | integer |
| `organic.summary_by_country_monthly[].trafficNonBranded` | number | 52/52 | 2007 | 0 | integer |
| `organic.top_keywords[].competition` | number | 52/52 | 358 | 0 | decimal, integer |
| `organic.top_keywords[].cpc_usd` | number | 52/52 | 358 | 0 | decimal, integer |
| `organic.top_keywords[].intents[]` | string | 52/52 | 421 | 0 |  |
| `organic.top_keywords[].keyword` | string | 52/52 | 358 | 0 |  |
| `organic.top_keywords[].keyword_difficulty` | number | 52/52 | 358 | 0 | integer |
| `organic.top_keywords[].position` | number | 52/52 | 358 | 0 | integer |
| `organic.top_keywords[].position_difference` | number | 52/52 | 358 | 0 | integer |
| `organic.top_keywords[].previous_position` | number | 52/52 | 358 | 0 | integer |
| `organic.top_keywords[].results` | number | 52/52 | 358 | 0 | integer |
| `organic.top_keywords[].serp_features_codes[]` | number | 52/52 | 530 | 0 | integer |
| `organic.top_keywords[].traffic` | number | 52/52 | 358 | 0 | integer |
| `organic.top_keywords[].traffic_cost_usd` | number | 52/52 | 358 | 0 | integer |
| `organic.top_keywords[].traffic_share_pct` | number | 52/52 | 358 | 0 | decimal, integer |
| `organic.top_keywords[].url` | string | 52/52 | 358 | 0 | url |
| `organic.top_keywords[].volume` | number | 52/52 | 358 | 0 | integer |
| `organic.trend_country_daily[].branded_traffic` | number | 52/52 | 37908 | 0 | integer |
| `organic.trend_country_daily[].date` | string | 52/52 | 37908 | 0 | numeric-string |
| `organic.trend_country_daily[].non_branded_traffic` | number | 52/52 | 37908 | 0 | integer |
| `organic.trend_country_daily[].organic_keywords` | number | 52/52 | 37908 | 0 | integer |
| `organic.trend_country_daily[].organic_traffic` | number | 52/52 | 37908 | 0 | integer |
| `organic.trend_country_daily[].organic_traffic_cost_usd` | number | 52/52 | 37908 | 0 | integer |
| `organic.trend_country_daily[].paid_keywords` | number | 52/52 | 37908 | 0 | integer |
| `organic.trend_country_daily[].paid_traffic` | number | 52/52 | 37908 | 0 | integer |
| `organic.trend_country_daily[].paid_traffic_cost_usd` | number | 52/52 | 37908 | 0 | integer |
| `organic.trend_country_daily[].rank` | number | 52/52 | 37908 | 0 | integer |
| `organic.trend_country_daily[].serp_feature_traffic` | number | 52/52 | 37908 | 0 | integer |
| `organic.trend_country_monthly[].branded_traffic` | number | 52/52 | 9152 | 0 | integer |
| `organic.trend_country_monthly[].date` | string | 52/52 | 9152 | 0 | numeric-string |
| `organic.trend_country_monthly[].non_branded_traffic` | number | 52/52 | 9152 | 0 | integer |
| `organic.trend_country_monthly[].organic_keywords` | number | 52/52 | 9152 | 0 | integer |
| `organic.trend_country_monthly[].organic_traffic` | number | 52/52 | 9152 | 0 | integer |
| `organic.trend_country_monthly[].organic_traffic_cost_usd` | number | 52/52 | 9152 | 0 | integer |
| `organic.trend_country_monthly[].paid_keywords` | number | 52/52 | 9152 | 0 | integer |
| `organic.trend_country_monthly[].paid_traffic` | number | 52/52 | 9152 | 0 | integer |
| `organic.trend_country_monthly[].paid_traffic_cost_usd` | number | 52/52 | 9152 | 0 | integer |
| `organic.trend_country_monthly[].rank` | number | 52/52 | 9152 | 0 | integer |
| `organic.trend_country_monthly[].serp_feature_traffic` | number | 52/52 | 9152 | 0 | integer |
| `organic.trend_global_daily[].branded_traffic` | number | 52/52 | 37908 | 0 | integer |
| `organic.trend_global_daily[].date` | string | 52/52 | 37908 | 0 | numeric-string |
| `organic.trend_global_daily[].non_branded_traffic` | number | 52/52 | 37908 | 0 | integer |
| `organic.trend_global_daily[].organic_keywords` | number | 52/52 | 37908 | 0 | integer |
| `organic.trend_global_daily[].organic_traffic` | number | 52/52 | 37908 | 0 | integer |
| `organic.trend_global_daily[].organic_traffic_cost_usd` | number | 52/52 | 37908 | 0 | integer |
| `organic.trend_global_daily[].paid_keywords` | number | 52/52 | 37908 | 0 | integer |
| `organic.trend_global_daily[].paid_traffic` | number | 52/52 | 37908 | 0 | integer |
| `organic.trend_global_daily[].paid_traffic_cost_usd` | number | 52/52 | 37908 | 0 | integer |
| `organic.trend_global_daily[].rank` | number | 52/52 | 37908 | 0 | integer |
| `organic.trend_global_daily[].serp_feature_traffic` | number | 52/52 | 37908 | 0 | integer |
| `organic.trend_global_monthly[].branded_traffic` | number | 52/52 | 9152 | 0 | integer |
| `organic.trend_global_monthly[].date` | string | 52/52 | 9152 | 0 | numeric-string |
| `organic.trend_global_monthly[].non_branded_traffic` | number | 52/52 | 9152 | 0 | integer |
| `organic.trend_global_monthly[].organic_keywords` | number | 52/52 | 9152 | 0 | integer |
| `organic.trend_global_monthly[].organic_traffic` | number | 52/52 | 9152 | 0 | integer |
| `organic.trend_global_monthly[].organic_traffic_cost_usd` | number | 52/52 | 9152 | 0 | integer |
| `organic.trend_global_monthly[].paid_keywords` | number | 52/52 | 9152 | 0 | integer |
| `organic.trend_global_monthly[].paid_traffic` | number | 52/52 | 9152 | 0 | integer |
| `organic.trend_global_monthly[].paid_traffic_cost_usd` | number | 52/52 | 9152 | 0 | integer |
| `organic.trend_global_monthly[].rank` | number | 52/52 | 9152 | 0 | integer |
| `organic.trend_global_monthly[].serp_feature_traffic` | number | 52/52 | 9152 | 0 | integer |
| `paid_competitors_count` | number | 52/52 | 52 | 0 | integer |
| `paid_keywords` | number | 52/52 | 52 | 0 | integer |
| `paid_traffic` | number | 52/52 | 52 | 0 | integer |
| `paid_traffic_cost_usd` | number | 52/52 | 52 | 0 | integer |
| `paid.competitors_total` | number | 52/52 | 52 | 0 | integer |
| `paid.competitors[].ad_traffic` | number | 52/52 | 59 | 0 | integer |
| `paid.competitors[].ad_traffic_cost_usd` | number | 52/52 | 59 | 0 | integer |
| `paid.competitors[].common_keywords` | number | 52/52 | 59 | 0 | integer |
| `paid.competitors[].competition_level` | number | 52/52 | 59 | 0 | decimal, integer |
| `paid.competitors[].domain` | string | 52/52 | 59 | 0 | domain |
| `paid.competitors[].organic_keywords` | number | 52/52 | 59 | 0 | integer |
| `paid.competitors[].paid_keywords` | number | 52/52 | 59 | 0 | integer |
| `paid.top_ads[].competition` | number | 5/52 | 16 | 0 | decimal, integer |
| `paid.top_ads[].cpc_usd` | number | 5/52 | 16 | 0 | decimal, integer |
| `paid.top_ads[].description` | string | 5/52 | 16 | 0 | empty-string |
| `paid.top_ads[].keyword` | string | 5/52 | 16 | 0 |  |
| `paid.top_ads[].keyword_difficulty` | number | 5/52 | 16 | 0 | integer |
| `paid.top_ads[].position` | number | 5/52 | 16 | 0 | integer |
| `paid.top_ads[].previous_position` | number | 5/52 | 16 | 0 | integer |
| `paid.top_ads[].title` | string | 5/52 | 16 | 0 |  |
| `paid.top_ads[].traffic` | number | 5/52 | 16 | 0 | integer |
| `paid.top_ads[].traffic_cost_usd` | number | 5/52 | 16 | 0 | integer |
| `paid.top_ads[].traffic_share_pct` | number | 5/52 | 16 | 0 | decimal, integer |
| `paid.top_ads[].url` | string | 5/52 | 16 | 0 | url |
| `paid.top_ads[].visible_url` | string | 5/52 | 16 | 0 | url |
| `paid.top_ads[].volume` | number | 5/52 | 16 | 0 | integer |
| `referring_domains` | number | 52/52 | 52 | 0 | integer |
| `serp_features.keywords_by_feature.0` | number | 52/52 | 52 | 0 | integer |
| `serp_features.keywords_by_feature.1` | number | 52/52 | 52 | 0 | integer |
| `serp_features.keywords_by_feature.10` | number | 52/52 | 52 | 0 | integer |
| `serp_features.keywords_by_feature.11` | number | 52/52 | 52 | 0 | integer |
| `serp_features.keywords_by_feature.12` | number | 52/52 | 52 | 0 | integer |
| `serp_features.keywords_by_feature.13` | number | 52/52 | 52 | 0 | integer |
| `serp_features.keywords_by_feature.14` | number | 52/52 | 52 | 0 | integer |
| `serp_features.keywords_by_feature.15` | number | 52/52 | 52 | 0 | integer |
| `serp_features.keywords_by_feature.16` | number | 52/52 | 52 | 0 | integer |
| `serp_features.keywords_by_feature.17` | number | 52/52 | 52 | 0 | integer |
| `serp_features.keywords_by_feature.18` | number | 52/52 | 52 | 0 | integer |
| `serp_features.keywords_by_feature.19` | number | 52/52 | 52 | 0 | integer |
| `serp_features.keywords_by_feature.2` | number | 52/52 | 52 | 0 | integer |
| `serp_features.keywords_by_feature.20` | number | 52/52 | 52 | 0 | integer |
| `serp_features.keywords_by_feature.21` | number | 52/52 | 52 | 0 | integer |
| `serp_features.keywords_by_feature.22` | number | 52/52 | 52 | 0 | integer |
| `serp_features.keywords_by_feature.23` | number | 52/52 | 52 | 0 | integer |
| `serp_features.keywords_by_feature.24` | number | 52/52 | 52 | 0 | integer |
| `serp_features.keywords_by_feature.25` | number | 52/52 | 52 | 0 | integer |
| `serp_features.keywords_by_feature.26` | number | 52/52 | 52 | 0 | integer |
| `serp_features.keywords_by_feature.27` | number | 52/52 | 52 | 0 | integer |
| `serp_features.keywords_by_feature.28` | number | 52/52 | 52 | 0 | integer |
| `serp_features.keywords_by_feature.29` | number | 52/52 | 52 | 0 | integer |
| `serp_features.keywords_by_feature.3` | number | 52/52 | 52 | 0 | integer |
| `serp_features.keywords_by_feature.30` | number | 52/52 | 52 | 0 | integer |
| `serp_features.keywords_by_feature.31` | number | 52/52 | 52 | 0 | integer |
| `serp_features.keywords_by_feature.32` | number | 52/52 | 52 | 0 | integer |
| `serp_features.keywords_by_feature.34` | number | 52/52 | 52 | 0 | integer |
| `serp_features.keywords_by_feature.35` | number | 52/52 | 52 | 0 | integer |
| `serp_features.keywords_by_feature.36` | number | 52/52 | 52 | 0 | integer |
| `serp_features.keywords_by_feature.37` | number | 52/52 | 52 | 0 | integer |
| `serp_features.keywords_by_feature.38` | number | 52/52 | 52 | 0 | integer |
| `serp_features.keywords_by_feature.39` | number | 52/52 | 52 | 0 | integer |
| `serp_features.keywords_by_feature.4` | number | 52/52 | 52 | 0 | integer |
| `serp_features.keywords_by_feature.40` | number | 52/52 | 52 | 0 | integer |
| `serp_features.keywords_by_feature.41` | number | 52/52 | 52 | 0 | integer |
| `serp_features.keywords_by_feature.42` | number | 52/52 | 52 | 0 | integer |
| `serp_features.keywords_by_feature.43` | number | 52/52 | 52 | 0 | integer |
| `serp_features.keywords_by_feature.44` | number | 52/52 | 52 | 0 | integer |
| `serp_features.keywords_by_feature.45` | number | 52/52 | 52 | 0 | integer |
| `serp_features.keywords_by_feature.46` | number | 52/52 | 52 | 0 | integer |
| `serp_features.keywords_by_feature.47` | number | 52/52 | 52 | 0 | integer |
| `serp_features.keywords_by_feature.48` | number | 52/52 | 52 | 0 | integer |
| `serp_features.keywords_by_feature.49` | number | 52/52 | 52 | 0 | integer |
| `serp_features.keywords_by_feature.5` | number | 52/52 | 52 | 0 | integer |
| `serp_features.keywords_by_feature.50` | number | 52/52 | 52 | 0 | integer |
| `serp_features.keywords_by_feature.51` | number | 52/52 | 52 | 0 | integer |
| `serp_features.keywords_by_feature.52` | number | 52/52 | 52 | 0 | integer |
| `serp_features.keywords_by_feature.6` | number | 52/52 | 52 | 0 | integer |
| `serp_features.keywords_by_feature.7` | number | 52/52 | 52 | 0 | integer |
| `serp_features.keywords_by_feature.8` | number | 52/52 | 52 | 0 | integer |
| `serp_features.keywords_by_feature.9` | number | 52/52 | 52 | 0 | integer |
| `serp_features.positions_by_feature.1` | number | 52/52 | 52 | 0 | integer |
| `serp_features.positions_by_feature.10` | number | 52/52 | 52 | 0 | integer |
| `serp_features.positions_by_feature.11` | number | 52/52 | 52 | 0 | integer |
| `serp_features.positions_by_feature.12` | number | 52/52 | 52 | 0 | integer |
| `serp_features.positions_by_feature.13` | number | 52/52 | 52 | 0 | integer |
| `serp_features.positions_by_feature.18` | number | 52/52 | 52 | 0 | integer |
| `serp_features.positions_by_feature.19` | number | 52/52 | 52 | 0 | integer |
| `serp_features.positions_by_feature.20` | number | 52/52 | 52 | 0 | integer |
| `serp_features.positions_by_feature.21` | number | 52/52 | 52 | 0 | integer |
| `serp_features.positions_by_feature.22` | number | 52/52 | 52 | 0 | integer |
| `serp_features.positions_by_feature.24` | number | 52/52 | 52 | 0 | integer |
| `serp_features.positions_by_feature.25` | number | 52/52 | 52 | 0 | integer |
| `serp_features.positions_by_feature.26` | number | 52/52 | 52 | 0 | integer |
| `serp_features.positions_by_feature.27` | number | 52/52 | 52 | 0 | integer |
| `serp_features.positions_by_feature.28` | number | 52/52 | 52 | 0 | integer |
| `serp_features.positions_by_feature.29` | number | 52/52 | 52 | 0 | integer |
| `serp_features.positions_by_feature.3` | number | 52/52 | 52 | 0 | integer |
| `serp_features.positions_by_feature.31` | number | 52/52 | 52 | 0 | integer |
| `serp_features.positions_by_feature.38` | number | 52/52 | 52 | 0 | integer |
| `serp_features.positions_by_feature.39` | number | 52/52 | 52 | 0 | integer |
| `serp_features.positions_by_feature.4` | number | 52/52 | 52 | 0 | integer |
| `serp_features.positions_by_feature.40` | number | 52/52 | 52 | 0 | integer |
| `serp_features.positions_by_feature.41` | number | 52/52 | 52 | 0 | integer |
| `serp_features.positions_by_feature.42` | number | 52/52 | 52 | 0 | integer |
| `serp_features.positions_by_feature.43` | number | 52/52 | 52 | 0 | integer |
| `serp_features.positions_by_feature.44` | number | 52/52 | 52 | 0 | integer |
| `serp_features.positions_by_feature.45` | number | 52/52 | 52 | 0 | integer |
| `serp_features.positions_by_feature.46` | number | 52/52 | 52 | 0 | integer |
| `serp_features.positions_by_feature.47` | number | 52/52 | 52 | 0 | integer |
| `serp_features.positions_by_feature.48` | number | 52/52 | 52 | 0 | integer |
| `serp_features.positions_by_feature.5` | number | 52/52 | 52 | 0 | integer |
| `serp_features.positions_by_feature.52` | number | 52/52 | 52 | 0 | integer |
| `serp_features.positions_by_feature.6` | number | 52/52 | 52 | 0 | integer |
| `serp_features.positions_by_feature.7` | number | 52/52 | 52 | 0 | integer |
| `serp_features.positions_by_feature.8` | number | 52/52 | 52 | 0 | integer |
| `serp_features.positions_by_feature.9` | number | 52/52 | 52 | 0 | integer |
| `serp_features.total_positions` | number | 52/52 | 52 | 0 | integer |
| `top_country` | string | 52/52 | 52 | 0 |  |
| `top_country_traffic` | number | 52/52 | 52 | 0 | integer |
| `total_traffic` | number | 52/52 | 52 | 0 | integer |
