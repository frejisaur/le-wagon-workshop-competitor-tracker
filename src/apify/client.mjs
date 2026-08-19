const API_ORIGIN = 'https://api.apify.com/v2';
const defaultSleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function throwIfAborted(signal) {
  if (signal?.aborted) throw signal.reason || new Error('Apify request aborted');
}

function actorPath(actorId) {
  if (typeof actorId !== 'string' || !/^[^/]+\/[^/]+$/.test(actorId)) {
    throw new Error('Apify actor ID must be an owner/name pair');
  }
  return actorId.replace('/', '~');
}

export class ApifyClient {
  constructor({token, fetchFn = globalThis.fetch, sleep = defaultSleep, apiOrigin = API_ORIGIN}) {
    if (!token) throw new Error('Apify token is required');
    this.token = token;
    this.fetchFn = fetchFn;
    this.sleep = sleep;
    this.apiOrigin = apiOrigin;
  }

  async request(path, {method = 'GET', body, signal} = {}) {
    throwIfAborted(signal);
    const response = await this.fetchFn(`${this.apiOrigin}${path}`, {
      method,
      signal,
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      ...(body === undefined ? {} : {body: JSON.stringify(body)}),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`Apify API ${response.status}`);
    return payload.data ?? payload;
  }

  startRun({actorId, input, signal}) {
    return this.request(`/acts/${actorPath(actorId)}/runs`, {method: 'POST', body: input, signal});
  }

  async waitForRun(runId, {signal, pollMs = 1_000, maxPollMs = 10_000} = {}) {
    let delay = pollMs;
    while (true) {
      throwIfAborted(signal);
      const run = await this.request(`/actor-runs/${encodeURIComponent(runId)}`, {signal});
      if (run.status === 'SUCCEEDED') return run;
      if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(run.status)) {
        throw new Error(`Apify run ended with ${run.status}`);
      }
      await this.sleep(delay);
      delay = Math.min(maxPollMs, delay * 2);
    }
  }

  async getDatasetItems(datasetId, {signal} = {}) {
    return this.request(`/datasets/${encodeURIComponent(datasetId)}/items`, {signal});
  }
}
