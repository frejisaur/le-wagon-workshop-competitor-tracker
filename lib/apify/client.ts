export type ApifyRunStatus = 'READY' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'ABORTED' | 'TIMED-OUT';
export type ApifyRun = {id: string; status: ApifyRunStatus; datasetId: string | null};

export class ApifyClientError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'ApifyClientError';
  }
}

export type ApifyOperationOptions = {signal?: AbortSignal; timeoutMs?: number};
export type ApifyClientOptions = {
  token: string;
  endpoint?: string;
  fetch?: typeof globalThis.fetch;
  sleep?: (milliseconds: number) => Promise<void>;
  pollDelayMs?: number;
  maxPollAttempts?: number;
  defaultTimeoutMs?: number;
};

const RUNNING = new Set<ApifyRunStatus>(['READY', 'RUNNING']);
const TERMINAL = new Set<ApifyRunStatus>(['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT']);
const VALID_RUN_STATUSES = new Set<ApifyRunStatus>([...RUNNING, ...TERMINAL]);

function safeEndpoint(value: string): URL {
  let endpoint: URL;
  try {
    endpoint = new URL(value);
  } catch {
    throw new TypeError('Apify endpoint must be a valid HTTPS URL');
  }
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
    throw new TypeError('Apify endpoint must be a valid HTTPS URL');
  }
  endpoint.pathname = endpoint.pathname.replace(/\/$/, '');
  return endpoint;
}

function operationSignal(options: ApifyOperationOptions, defaultTimeoutMs: number): {signal: AbortSignal; cleanup: () => void} {
  const timeoutMs = options.timeoutMs ?? defaultTimeoutMs;
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) throw new TypeError('timeoutMs must be a positive integer');
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort(options.signal?.reason ?? new Error('caller aborted'));
  if (options.signal?.aborted) abortFromCaller();
  else options.signal?.addEventListener('abort', abortFromCaller, {once: true});
  const timer = setTimeout(() => controller.abort(new ApifyClientError('Apify operation timed out')), timeoutMs);
  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', abortFromCaller);
    },
  };
}

function runFromUnknown(value: unknown): ApifyRun {
  if (!value || typeof value !== 'object') throw new ApifyClientError('Apify response is invalid');
  const envelope = value as Record<string, unknown>;
  const data = envelope.data && typeof envelope.data === 'object' ? envelope.data as Record<string, unknown> : envelope;
  const id = data.id;
  const status = data.status;
  const datasetId = data.defaultDatasetId;
  if (typeof id !== 'string' || !id || typeof status !== 'string' || !VALID_RUN_STATUSES.has(status as ApifyRunStatus)) {
    throw new ApifyClientError('Apify response is invalid');
  }
  if (datasetId !== undefined && datasetId !== null && typeof datasetId !== 'string') throw new ApifyClientError('Apify response is invalid');
  return {id, status: status as ApifyRunStatus, datasetId: typeof datasetId === 'string' ? datasetId : null};
}

/** Server-only Apify boundary. Authentication and raw response details never leave this module. */
export class ApifyClient {
  private readonly endpoint: URL;
  private readonly fetch: typeof globalThis.fetch;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly pollDelayMs: number;
  private readonly maxPollAttempts: number;
  private readonly defaultTimeoutMs: number;

  constructor(private readonly options: ApifyClientOptions) {
    if (!options.token.trim()) throw new TypeError('Apify token is required');
    this.endpoint = safeEndpoint(options.endpoint ?? 'https://api.apify.com/v2');
    this.fetch = options.fetch ?? globalThis.fetch;
    this.sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
    this.pollDelayMs = options.pollDelayMs ?? 1_000;
    this.maxPollAttempts = options.maxPollAttempts ?? 60;
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 60_000;
    if (!Number.isInteger(this.pollDelayMs) || this.pollDelayMs < 0) throw new TypeError('pollDelayMs must be a non-negative integer');
    if (!Number.isInteger(this.maxPollAttempts) || this.maxPollAttempts < 1) throw new TypeError('maxPollAttempts must be a positive integer');
  }

  async startRun(actorId: string, input: Record<string, unknown>, options: ApifyOperationOptions = {}): Promise<ApifyRun> {
    if (!actorId.trim() || actorId.includes('..')) throw new TypeError('actorId is invalid');
    const signal = operationSignal(options, this.defaultTimeoutMs);
    try {
      const actorPath = actorId.split('/').map(encodeURIComponent).join('~');
      const response = await this.request(`acts/${actorPath}/runs`, {method: 'POST', body: JSON.stringify(input)}, signal.signal);
      return runFromUnknown(response);
    } finally {
      signal.cleanup();
    }
  }

  async waitForRun(runId: string, options: ApifyOperationOptions = {}): Promise<ApifyRun> {
    if (!runId.trim()) throw new TypeError('runId is required');
    const operation = operationSignal(options, this.defaultTimeoutMs);
    try {
      for (let attempt = 0; attempt < this.maxPollAttempts; attempt += 1) {
        this.throwIfAborted(operation.signal);
        const raw = await this.request(`actor-runs/${encodeURIComponent(runId)}`, {method: 'GET'}, operation.signal);
        const run = runFromUnknown(raw);
        if (TERMINAL.has(run.status)) {
          if (run.status !== 'SUCCEEDED') throw new ApifyClientError(`Apify run ended (${run.status})`);
          if (!run.datasetId) throw new ApifyClientError('Apify run has no dataset');
          return run;
        }
        if (!RUNNING.has(run.status)) throw new ApifyClientError('Apify run status is invalid');
        if (attempt + 1 < this.maxPollAttempts) await this.wait(this.pollDelayMs, operation.signal);
      }
      throw new ApifyClientError('Apify polling exceeded maximum attempts');
    } finally {
      operation.cleanup();
    }
  }

  async getDatasetItems(datasetId: string, options: ApifyOperationOptions = {}): Promise<unknown[]> {
    if (!datasetId.trim()) throw new TypeError('datasetId is required');
    const operation = operationSignal(options, this.defaultTimeoutMs);
    try {
      const all: unknown[] = [];
      let offset = 0;
      let pages = 0;
      while (true) {
        if (pages >= this.maxPollAttempts) throw new ApifyClientError('Apify dataset pagination exceeded maximum attempts');
        const query = new URLSearchParams({offset: String(offset), limit: '1000'});
        const raw = await this.request(`datasets/${encodeURIComponent(datasetId)}/items?${query.toString()}`, {method: 'GET'}, operation.signal);
        if (!raw || typeof raw !== 'object') throw new ApifyClientError('Apify dataset response is invalid');
        const data = (raw as {data?: unknown}).data;
        if (!data || typeof data !== 'object') throw new ApifyClientError('Apify dataset response is invalid');
        const page = data as {items?: unknown; offset?: unknown; count?: unknown; total?: unknown};
        const pageOffset = page.offset;
        const pageCount = page.count;
        const pageTotal = page.total;
        if (!Array.isArray(page.items) || typeof pageOffset !== 'number' || !Number.isInteger(pageOffset) || typeof pageCount !== 'number' || !Number.isInteger(pageCount) || typeof pageTotal !== 'number' || !Number.isInteger(pageTotal) || pageOffset !== offset || pageCount !== page.items.length || pageTotal < offset + pageCount) {
          throw new ApifyClientError('Apify dataset response is invalid');
        }
        all.push(...page.items);
        pages += 1;
        if (offset + pageCount >= pageTotal) return all;
        if (pageCount === 0) throw new ApifyClientError('Apify dataset pagination made no progress');
        offset += pageCount;
      }
    } finally {
      operation.cleanup();
    }
  }

  private async request(path: string, init: RequestInit, signal: AbortSignal): Promise<unknown> {
    this.throwIfAborted(signal);
    const url = new URL(path, `${this.endpoint.toString()}/`);
    try {
      const response = await this.fetch(url, {
        ...init,
        signal,
        headers: {authorization: `Bearer ${this.options.token}`, accept: 'application/json', ...(init.body ? {'content-type': 'application/json'} : {})},
      });
      if (!response.ok) throw new ApifyClientError(`Apify request failed (${response.status})`, response.status);
      try {
        return await response.json();
      } catch {
        throw new ApifyClientError('Apify response is invalid');
      }
    } catch (error) {
      if (signal.aborted) {
        if (signal.reason instanceof ApifyClientError) throw signal.reason;
        throw new ApifyClientError('Apify operation aborted');
      }
      if (error instanceof ApifyClientError) throw error;
      throw new ApifyClientError('Apify request failed');
    }
  }

  private async wait(milliseconds: number, signal: AbortSignal): Promise<void> {
    this.throwIfAborted(signal);
    await Promise.race([
      this.sleep(milliseconds),
      new Promise<void>((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), {once: true})),
    ]).catch(() => { this.throwIfAborted(signal); });
  }

  private throwIfAborted(signal: AbortSignal): void {
    if (!signal.aborted) return;
    if (signal.reason instanceof ApifyClientError) throw signal.reason;
    throw new ApifyClientError('Apify operation aborted');
  }
}
