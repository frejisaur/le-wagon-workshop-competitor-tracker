const API_ORIGIN = 'https://api.airtable.com/v0';
const defaultSleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function safeApiError(status, body) {
  const label = typeof body?.error === 'string' ? body.error : body?.error?.type || body?.error?.message;
  return new Error(`Airtable API ${status}${label ? `: ${label}` : ''}`);
}

export class AirtableRecordsClient {
  constructor({baseId, token, fetchFn = globalThis.fetch, sleep = defaultSleep, maxRetries = 4}) {
    this.baseId = baseId;
    this.token = token;
    this.fetchFn = fetchFn;
    this.sleep = sleep;
    this.maxRetries = maxRetries;
  }

  async request(path, {method = 'GET', body} = {}) {
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const response = await this.fetchFn(`${API_ORIGIN}${path}`, {
        method,
        headers: {Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json'},
        ...(body === undefined ? {} : {body: JSON.stringify(body)}),
      });
      if (response.status === 429 && attempt < this.maxRetries) {
        const retryAfter = Number(response.headers.get('retry-after'));
        await this.sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1_000 : 1_000 * (2 ** attempt));
        continue;
      }
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw safeApiError(response.status, payload);
      return payload;
    }
    throw new Error('Airtable record retry budget exhausted');
  }

  async listRecords(table) {
    const records = [];
    let offset;
    do {
      const params = new URLSearchParams({pageSize: '100'});
      if (offset) params.set('offset', offset);
      const page = await this.request(`/${encodeURIComponent(this.baseId)}/${encodeURIComponent(table)}?${params}`);
      records.push(...(page.records || []));
      offset = page.offset;
    } while (offset);
    return records;
  }

  updateRecords(table, records) {
    return this.request(`/${encodeURIComponent(this.baseId)}/${encodeURIComponent(table)}`, {
      method: 'PATCH', body: {records},
    });
  }

  createRecord(table, fields) {
    return this.request(`/${encodeURIComponent(this.baseId)}/${encodeURIComponent(table)}`, {
      method: 'POST', body: {fields},
    });
  }
}

const plain = {
  companyId: 'Company ID', canonicalDomain: 'Canonical Domain', systemId: 'System ID',
  railwayStart: 'Railway Last Run Start', railwayFinish: 'Railway Last Run Finish',
  railwaySuccess: 'Railway Last Successful Run', railwayStatus: 'Railway Status',
  railwayProcessed: 'Railway Processed Count', railwaySucceeded: 'Railway Succeeded Count',
  railwayFailed: 'Railway Failed Count', railwayErrors: 'Railway Error Summary',
  railwayVersion: 'Railway Workflow Version', railwayRunId: 'Railway Run ID',
};

export class AirtableRefreshRepository {
  constructor({client, companiesTable = 'Companies', systemTable = 'System', fields = plain, cacheInvalidator}) {
    this.client = client;
    this.companiesTable = companiesTable;
    this.systemTable = systemTable;
    this.fields = fields;
    this.cacheInvalidator = cacheInvalidator;
  }

  async listActiveCompanies() {
    const records = await this.client.listRecords(this.companiesTable);
    return records.map((record) => ({
      recordId: record.id,
      companyId: record.fields[this.fields.companyId],
      canonicalDomain: record.fields[this.fields.canonicalDomain],
    })).filter((company) => company.recordId && company.companyId && company.canonicalDomain);
  }

  async upsertCompanies(records) {
    for (let index = 0; index < records.length; index += 10) {
      const batch = records.slice(index, index + 10).map((record) => ({id: record.recordId, fields: record.fields}));
      await this.client.updateRecords(this.companiesTable, batch);
    }
  }

  async markCompaniesFailed(failures) {
    if (!failures.length) return;
    const records = failures.filter((failure) => failure.recordId).map((failure) => ({
      id: failure.recordId,
      fields: {'Enrichment Status': 'failed'},
    }));
    for (let index = 0; index < records.length; index += 10) {
      await this.client.updateRecords(this.companiesTable, records.slice(index, index + 10));
    }
  }

  async updateRailwayStatus(status) {
    const fields = {
      [this.fields.railwayStatus]: status.status,
      [this.fields.railwayRunId]: status.runId,
      [this.fields.railwayVersion]: 'v1',
      [this.fields.railwayProcessed]: status.processed,
      [this.fields.railwaySucceeded]: status.succeeded,
      [this.fields.railwayFailed]: status.failed,
      [this.fields.railwayErrors]: status.errors?.map((error) => `${error.companyId}:${error.code}`).join(', ') || '',
      ...(status.startedAt ? {[this.fields.railwayStart]: status.startedAt} : {}),
      ...(status.finishedAt ? {[this.fields.railwayFinish]: status.finishedAt} : {}),
      ...(status.status === 'succeeded' ? {[this.fields.railwaySuccess]: status.finishedAt} : {}),
    };
    const existing = (await this.client.listRecords(this.systemTable))[0];
    if (existing) return this.client.updateRecords(this.systemTable, [{id: existing.id, fields}]);
    return this.client.createRecord(this.systemTable, {[this.fields.systemId]: 'system', ...fields});
  }

  async invalidateCache() {
    if (!this.cacheInvalidator) return;
    await this.cacheInvalidator();
  }
}
