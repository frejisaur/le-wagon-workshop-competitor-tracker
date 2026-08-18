import type {AirtableListResponse, AirtableRecord, AirtableTable, AirtableWriteRecord, AirtableWriteResponse} from './types';

const MAX_BATCH_SIZE = 10;

export class AirtableClientError extends Error {
  constructor(readonly operation: 'list' | 'create' | 'update' | 'delete', readonly table: AirtableTable, readonly status?: number) {
    super(`Airtable ${operation} failed for ${table}${status ? ` (HTTP ${status})` : ''}`);
    this.name = 'AirtableClientError';
  }
}

export type AirtableClientOptions = {
  baseId: string;
  apiToken: string;
  endpoint?: string;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
  maxAttempts?: number;
  jitter?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
};

function chunks<T>(items: T[]): T[][] {
  return Array.from({length: Math.ceil(items.length / MAX_BATCH_SIZE)}, (_, index) => items.slice(index * MAX_BATCH_SIZE, (index + 1) * MAX_BATCH_SIZE));
}

function retryAfterMilliseconds(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;
  const date = Date.parse(value);
  return Number.isNaN(date) ? null : Math.max(0, date - Date.now());
}

export class AirtableClient {
  private readonly endpoint: string;
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly timeoutMs: number;
  private readonly maxAttempts: number;
  private readonly jitter: () => number;
  private readonly sleep: (milliseconds: number) => Promise<void>;

  constructor(private readonly options: AirtableClientOptions) {
    this.endpoint = (options.endpoint ?? 'https://api.airtable.com').replace(/\/$/, '');
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.maxAttempts = options.maxAttempts ?? 3;
    this.jitter = options.jitter ?? Math.random;
    this.sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  }

  async list(table: AirtableTable, options: {filterByFormula?: string} = {}): Promise<AirtableRecord[]> {
    const records: AirtableRecord[] = [];
    let offset: string | undefined;
    do {
      const query = new URLSearchParams();
      if (options.filterByFormula) query.set('filterByFormula', options.filterByFormula);
      if (offset) query.set('offset', offset);
      const response = await this.request<AirtableListResponse>('list', table, `?${query.toString()}`, {method: 'GET'});
      records.push(...response.records);
      offset = response.offset;
    } while (offset);
    return records;
  }

  async create(table: AirtableTable, records: AirtableWriteRecord[]): Promise<AirtableRecord[]> {
    return this.write('create', table, records);
  }

  async update(table: AirtableTable, records: AirtableWriteRecord[]): Promise<AirtableRecord[]> {
    return this.write('update', table, records);
  }

  async delete(table: AirtableTable, recordIds: string[]): Promise<AirtableRecord[]> {
    const deleted: AirtableRecord[] = [];
    for (const batch of chunks(recordIds)) {
      const query = new URLSearchParams();
      batch.forEach((recordId) => query.append('records[]', recordId));
      const response = await this.request<AirtableWriteResponse>('delete', table, `?${query.toString()}`, {method: 'DELETE'});
      deleted.push(...response.records);
    }
    return deleted;
  }

  private async write(operation: 'create' | 'update', table: AirtableTable, records: AirtableWriteRecord[]): Promise<AirtableRecord[]> {
    const written: AirtableRecord[] = [];
    for (const batch of chunks(records)) {
      const response = await this.request<AirtableWriteResponse>(operation, table, '', {method: operation === 'create' ? 'POST' : 'PATCH', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({records: batch})});
      written.push(...response.records);
    }
    return written;
  }

  private async request<T>(operation: 'list' | 'create' | 'update' | 'delete', table: AirtableTable, suffix: string, init: RequestInit): Promise<T> {
    const url = `${this.endpoint}/v0/${encodeURIComponent(this.options.baseId)}/${encodeURIComponent(table)}${suffix}`;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.fetchImpl(url, {...init, headers: {...init.headers, Authorization: `Bearer ${this.options.apiToken}`}, signal: controller.signal});
        if (response.ok) return await response.json() as T;
        if (response.status === 429 && attempt < this.maxAttempts) {
          const retryAfter = retryAfterMilliseconds(response.headers.get('Retry-After'));
          const exponential = Math.min(5_000, 100 * 2 ** (attempt - 1));
          await this.sleep(Math.max(retryAfter ?? 0, exponential) + Math.floor(this.jitter() * 100));
          continue;
        }
        throw new AirtableClientError(operation, table, response.status);
      } catch (error) {
        if (error instanceof AirtableClientError) throw error;
        throw new AirtableClientError(operation, table);
      } finally {
        clearTimeout(timeout);
      }
    }
    throw new AirtableClientError(operation, table, 429);
  }
}
