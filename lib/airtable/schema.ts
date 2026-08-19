type TextField = {name: string; type: 'singleLineText' | 'multilineText'};
type NumberField = {name: string; type: 'number'; options: {precision: number}};
type CheckboxField = {name: string; type: 'checkbox'; options: {color: 'greenBright'; icon: 'check'}};
type LinkField = {name: string; type: 'multipleRecordLinks'; linkedTable: 'Companies'};
export type AirtableSchemaField = TextField | NumberField | CheckboxField | LinkField;
export type AirtableSchemaTable = {name: string; fields: AirtableSchemaField[]};

const text = (...names: string[]): TextField[] => names.map((name) => ({name, type: 'singleLineText'}));
const longText = (...names: string[]): TextField[] => names.map((name) => ({name, type: 'multilineText'}));
const integers = (...names: string[]): NumberField[] => names.map((name) => ({name, type: 'number', options: {precision: 0}}));
const decimals = (...names: string[]): NumberField[] => names.map((name) => ({name, type: 'number', options: {precision: 2}}));
const checkbox = (name: string): CheckboxField => ({name, type: 'checkbox', options: {color: 'greenBright', icon: 'check'}});
const companyLink = (): LinkField => ({name: 'Identity • Company Link', type: 'multipleRecordLinks', linkedTable: 'Companies'});

const companies: AirtableSchemaTable = {
  name: 'Companies',
  fields: [
    ...text(
      'Identity • Company ID', 'Identity • Canonical Domain',
      'Observed • Apollo Account ID', 'Observed • Apollo Record ID', 'Observed • Display Name', 'Observed • Segment',
      'Observed • Apollo Website', 'Observed • Apify Domain', 'Observed • Apollo Account Stage', 'Observed • Apollo Lists',
      'Observed • Apollo Employees', 'Observed • Apollo Industry', 'Observed • Apollo Company Country',
      'Observed • Source', 'Observed • At', 'Observed • Database', 'Observed • Raw Ref', 'Observed • Domain', 'Observed • Top Country',
      'Observed • Moz Domain Authority Raw', 'Observed • Moz Spam Score Raw', 'Calculated • At',
      'Workflow • Evidence Fingerprint', 'Workflow • Last Successful Refresh At', 'Workflow • Next Insight Due At',
    ),
    ...integers(
      'Observed • Authority Score', 'Observed • Backlinks', 'Observed • Referring Domains', 'Observed • Follow Backlinks',
      'Observed • No-follow Backlinks', 'Observed • Organic Traffic', 'Observed • Total Traffic', 'Observed • Organic Keywords',
      'Observed • Organic Traffic Cost USD', 'Observed • Paid Traffic', 'Observed • Paid Keywords', 'Observed • Paid Traffic Cost USD',
      'Observed • AI Visibility', 'Observed • AI Visibility Benchmark', 'Observed • AI Mentions', 'Observed • AI Cited Pages',
      'Observed • Top Country Traffic', 'Observed • Organic Competitors Observed Count', 'Observed • Paid Competitors Observed Count',
      'Observed • AI Countries Observed Count', 'Observed • AI by LLM Observed Count', 'Observed • SERP Codes Observed Count',
      'Observed • AI Top Cited Sources Observed Count', 'Observed • Moz Top Pages Observed Count', 'Calculated • AI Countries Observed Count',
      'Calculated • Moz Top Pages Observed Count', 'Calculated • Top Keyword Sample Count',
    ),
    ...decimals(
      'Calculated • Organic Traffic 30d Movement', 'Calculated • Organic Traffic 12m Movement', 'Calculated • Non-brand Share',
      'Calculated • AI Benchmark Gap', 'Calculated • Tracked Set Traffic Share', 'Calculated • Moz Domain Authority',
      'Calculated • Moz Spam Score',
    ),
    ...longText(
      'Observed • Organic Competitors JSON', 'Observed • Paid Competitors JSON', 'Observed • AI Countries JSON',
      'Observed • AI by LLM JSON', 'Observed • AI Top Cited Sources JSON', 'Observed • SERP Codes JSON', 'Observed • Moz Top Pages JSON',
      'Calculated • Inputs JSON', 'Calculated • Organic Competitors JSON', 'Calculated • Paid Competitors JSON',
      'Calculated • AI Countries JSON', 'Calculated • Moz Top Pages JSON', 'Calculated • Compact Organic Trend JSON',
      'Calculated • Landing Page Portfolio JSON', 'Quality • Issues JSON',
    ),
    checkbox('Calculated • Paid Activity Present'),
  ],
};

const keywords: AirtableSchemaTable = {
  name: 'Keywords',
  fields: [
    ...text(
      'Identity • Keyword ID', 'Identity • Company ID', 'Observed • Source', 'Observed • At', 'Observed • Database',
      'Observed • Keyword', 'Observed • Landing URL', 'Calculated • Normalized Landing URL', 'Calculated • At',
    ),
    companyLink(),
    ...integers(
      'Observed • Position', 'Observed • Previous Position', 'Observed • Position Difference', 'Observed • Volume',
      'Observed • Keyword Difficulty', 'Observed • Traffic', 'Observed • Traffic Cost USD', 'Observed • Results',
    ),
    ...decimals('Observed • CPC USD', 'Observed • Competition', 'Observed • Traffic Share Pct'),
    ...longText('Observed • Intents JSON', 'Observed • SERP Codes JSON'),
  ],
};

const paidAds: AirtableSchemaTable = {
  name: 'Paid Ads',
  fields: [
    ...text(
      'Identity • Paid Ad ID', 'Identity • Company ID', 'Observed • Source', 'Observed • At', 'Observed • Database',
      'Observed • Keyword', 'Observed • Title', 'Observed • Visible URL', 'Observed • Landing URL',
      'Observed • First Observed At', 'Observed • Last Observed At', 'Calculated • Normalized Landing URL', 'Calculated • At',
    ),
    companyLink(),
    ...longText('Observed • Description'),
    ...integers(
      'Observed • Position', 'Observed • Previous Position', 'Observed • Volume', 'Observed • Keyword Difficulty',
      'Observed • Traffic', 'Observed • Traffic Cost USD',
    ),
    ...decimals('Observed • CPC USD', 'Observed • Competition', 'Observed • Traffic Share Pct'),
  ],
};

const insightClaimFields = [
  ...longText('Observed • Themes JSON', 'Inferred • Claims JSON', 'Inferred • Recommendations JSON'),
  ...integers(
    'Observed • Themes Claim Count', 'Observed • Themes Claims Retained Count',
    'Inferred • Claims Claim Count', 'Inferred • Claims Retained Count',
    'Inferred • Recommendations Claim Count', 'Inferred • Recommendations Claims Retained Count',
  ),
];

const workflowFields = [
  ...text(
    'Inferred • Overall Confidence', 'Workflow • Agent Harness', 'Workflow • Model', 'Workflow • Skill Version',
    'Workflow • Evidence Fingerprint', 'Workflow • Version', 'Workflow • Run ID', 'Workflow • Generated At',
  ),
];

const insights: AirtableSchemaTable = {
  name: 'GTM Insights',
  fields: [
    ...text('Identity • Insight ID', 'Identity • Company ID'),
    companyLink(),
    ...insightClaimFields,
    ...longText('Inferred • Summary', 'Inferred • Paid Message Summary', 'Inferred • AI Search Summary'),
    ...workflowFields,
  ],
};

const reviews: AirtableSchemaTable = {
  name: 'Insight Reviews',
  fields: [
    ...text('Identity • Company ID'),
    companyLink(),
    ...insightClaimFields,
    ...longText('Inferred • Review Reasons JSON'),
    ...workflowFields,
    ...text('Review • Status', 'Review • Identity', 'Review • At'),
    ...longText('Review • Notes'),
  ],
};

const system: AirtableSchemaTable = {
  name: 'System',
  fields: [
    ...text(
      'Identity • System ID', 'Workflow • Last Run Started At', 'Workflow • Last Run Finished At',
      'Workflow • Last Successful Run At', 'Workflow • Status', 'Workflow • Cache Version',
      'Railway • Workflow Version', 'Railway • Run ID', 'Agent • Last Run At', 'Agent • Skill Version',
    ),
    ...integers(
      'Workflow • Processed Companies', 'Workflow • Succeeded Companies', 'Workflow • Failed Companies',
      'Agent • Processed Companies', 'Agent • Review Count',
    ),
    ...longText('Workflow • Error Summary', 'Agent • Error Summary'),
  ],
};

export const AIRTABLE_SCHEMA: AirtableSchemaTable[] = [companies, keywords, paidAds, insights, reviews, system];

type RemoteField = {id: string; name: string; type: string};
type RemoteTable = {id: string; name: string; fields: RemoteField[]};
type SchemaFetch = typeof globalThis.fetch;

export type EnsureAirtableSchemaOptions = {
  baseId: string;
  apiToken: string;
  fetch?: SchemaFetch;
};

export type EnsureAirtableSchemaResult = {
  createdTables: string[];
  createdFields: Record<string, number>;
};

function remoteField(field: AirtableSchemaField, companiesTableId: string | undefined): Record<string, unknown> {
  if (field.type !== 'multipleRecordLinks') return field;
  if (!companiesTableId) throw new TypeError('Companies table must exist before linked fields are created');
  return {name: field.name, type: field.type, options: {linkedTableId: companiesTableId}};
}

async function request(fetch: SchemaFetch, token: string, url: string, init: RequestInit = {}): Promise<unknown> {
  const response = await fetch(url, {
    ...init,
    headers: {...init.headers, Authorization: `Bearer ${token}`},
  });
  if (!response.ok) throw new Error(`Airtable schema request failed (HTTP ${response.status})`);
  return response.json();
}

/** Idempotently creates only missing serving tables/fields. Existing schema is never renamed or deleted. */
export async function ensureAirtableSchema(options: EnsureAirtableSchemaOptions): Promise<EnsureAirtableSchemaResult> {
  const fetch = options.fetch ?? globalThis.fetch;
  const endpoint = `https://api.airtable.com/v0/meta/bases/${encodeURIComponent(options.baseId)}`;
  const listed = await request(fetch, options.apiToken, `${endpoint}/tables`) as {tables?: RemoteTable[]};
  const tables = [...(listed.tables ?? [])];
  const createdTables: string[] = [];
  const createdFields: Record<string, number> = {};

  for (const definition of AIRTABLE_SCHEMA) {
    let table = tables.find((candidate) => candidate.name === definition.name);
    const companiesTableId = definition.name === 'Companies'
      ? table?.id
      : tables.find((candidate) => candidate.name === 'Companies')?.id;

    if (!table) {
      const fields = definition.fields.map((field) => remoteField(field, companiesTableId));
      table = await request(fetch, options.apiToken, `${endpoint}/tables`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({name: definition.name, fields}),
      }) as RemoteTable;
      tables.push(table);
      createdTables.push(definition.name);
      createdFields[definition.name] = definition.fields.length;
      continue;
    }

    let count = 0;
    for (const field of definition.fields) {
      if (table.fields.some((candidate) => candidate.name === field.name)) continue;
      const companiesId = definition.name === 'Companies'
        ? table.id
        : tables.find((candidate) => candidate.name === 'Companies')?.id;
      const created = await request(fetch, options.apiToken, `${endpoint}/tables/${encodeURIComponent(table.id)}/fields`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(remoteField(field, companiesId)),
      }) as RemoteField;
      table.fields.push(created);
      count += 1;
    }
    createdFields[definition.name] = count;
  }

  return {createdTables, createdFields};
}
