import {pathToFileURL} from 'node:url';
import {getRefreshDispatchEnv} from '@/lib/config/server-env';
import {parseAnnotationMessage, REFRESH_REPORT_ANNOTATION_TITLE, type RefreshReportSummary} from '@/lib/refresh/report';

/**
 * Triggers `.github/workflows/refresh.yml` and waits for its verdict. This is
 * what a scheduled Claude routine runs: the workflow stays the only executor, so
 * its concurrency group, timeout and Actions secrets still apply, and the caller
 * needs nothing more than a token that can dispatch workflows on one repository.
 */

const WORKFLOW = 'refresh.yml';
const API = 'https://api.github.com';
/** A dispatched run may queue behind an active one (15 min) before running (15 min). */
const DEFAULT_DEADLINE_MS = 35 * 60 * 1_000;
const DEFAULT_POLL_MS = 15_000;
const DEFAULT_FIND_RUN_MS = 2 * 60 * 1_000;

export type DispatchStatus = 'succeeded' | 'partial' | 'failed' | 'timed_out' | 'dispatch_failed';
export type DispatchResult = {
  status: DispatchStatus;
  error: string | null;
  runUrl: string | null;
  conclusion: string | null;
  report: RefreshReportSummary | null;
};

export type DispatchOptions = {
  token: string;
  repository: string;
  ref: string;
  fetch?: typeof globalThis.fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  pollIntervalMs?: number;
  deadlineMs?: number;
  findRunTimeoutMs?: number;
};

type WorkflowRun = {id: number; html_url: string; status: string; conclusion: string | null};

class DispatchError extends Error {}

export async function dispatchRefresh(options: DispatchOptions): Promise<DispatchResult> {
  const fetcher = options.fetch ?? globalThis.fetch;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const now = options.now ?? Date.now;
  const pollMs = options.pollIntervalMs ?? DEFAULT_POLL_MS;
  const started = now();
  const repo = `${API}/repos/${options.repository}`;

  async function github<T>(path: string, init: RequestInit = {}): Promise<T | null> {
    let response: Response;
    try {
      response = await fetcher(`${repo}${path}`, {
        ...init,
        redirect: 'error',
        headers: {
          accept: 'application/vnd.github+json',
          authorization: `Bearer ${options.token}`,
          'x-github-api-version': '2022-11-28',
          'user-agent': 'competitor-intelligence-refresh-dispatch',
          ...(init.body ? {'content-type': 'application/json'} : {}),
        },
      });
    } catch {
      throw new DispatchError('github_unreachable');
    }
    // Status codes only: response bodies and headers never reach the caller.
    if (!response.ok) throw new DispatchError(`github_http_${response.status}`);
    return response.status === 204 ? null : ((await response.json()) as T);
  }

  const listRuns = async () => (await github<{workflow_runs: WorkflowRun[]}>(
    `/actions/workflows/${WORKFLOW}/runs?event=workflow_dispatch&branch=${encodeURIComponent(options.ref)}&per_page=20`,
  ))?.workflow_runs ?? [];

  let run: WorkflowRun | undefined;
  try {
    // Runs that existed before this dispatch are ignored, so clock skew cannot match an old run.
    const before = new Set((await listRuns()).map(({id}) => id));
    await github(`/actions/workflows/${WORKFLOW}/dispatches`, {method: 'POST', body: JSON.stringify({ref: options.ref})});

    const findDeadline = now() + (options.findRunTimeoutMs ?? DEFAULT_FIND_RUN_MS);
    while (!run) {
      if (now() > findDeadline) return result('dispatch_failed', 'run_not_found');
      await sleep(Math.min(pollMs, 5_000));
      run = (await listRuns()).filter(({id}) => !before.has(id)).sort((left, right) => left.id - right.id)[0];
    }

    const deadline = started + (options.deadlineMs ?? DEFAULT_DEADLINE_MS);
    while (run.status !== 'completed') {
      if (now() > deadline) return result('timed_out', 'run_still_active', run);
      await sleep(pollMs);
      run = (await github<WorkflowRun>(`/actions/runs/${run.id}`)) ?? run;
    }

    const report = await readReport(run.id);
    const status: DispatchStatus = report?.status ?? (run.conclusion === 'success' ? 'succeeded' : 'failed');
    return result(status, report ? null : 'report_missing', run, report);
  } catch (error) {
    return result('dispatch_failed', error instanceof DispatchError ? error.message : 'dispatch_error', run);
  }

  async function readReport(runId: number): Promise<RefreshReportSummary | null> {
    const jobs = (await github<{jobs: Array<{id: number}>}>(`/actions/runs/${runId}/jobs`))?.jobs ?? [];
    for (const job of jobs) {
      // A job ID is also its check-run ID, which is where workflow annotations live.
      const annotations = (await github<Array<{title?: string; message?: string}>>(`/check-runs/${job.id}/annotations`)) ?? [];
      const annotation = annotations.find(({title}) => title === REFRESH_REPORT_ANNOTATION_TITLE);
      if (annotation?.message) return parseAnnotationMessage(annotation.message);
    }
    return null;
  }

  function result(status: DispatchStatus, error: string | null, found?: WorkflowRun, report: RefreshReportSummary | null = null): DispatchResult {
    return {status, error, runUrl: found?.html_url ?? null, conclusion: found?.conclusion ?? null, report};
  }
}

export async function runDispatchRefreshCli(env: NodeJS.Dict<string> = process.env): Promise<{exitCode: number; stdout: string}> {
  let config;
  try {
    config = getRefreshDispatchEnv(env);
  } catch (error) {
    // The env error lists variable names only, never values.
    const message = error instanceof Error ? error.message : 'invalid_environment';
    return {exitCode: 1, stdout: JSON.stringify({status: 'dispatch_failed', error: message})};
  }
  const outcome = await dispatchRefresh({token: config.GITHUB_DISPATCH_TOKEN, repository: config.GITHUB_REPOSITORY, ref: config.REFRESH_REF});
  // No retries: a failed or partial run is left for an operator, like a scheduled one.
  return {exitCode: outcome.status === 'succeeded' ? 0 : 1, stdout: JSON.stringify(outcome)};
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  void runDispatchRefreshCli().then(({exitCode, stdout}) => {
    process.stdout.write(`${stdout}\n`);
    process.exitCode = exitCode;
  });
}
