import {pathToFileURL} from 'node:url';
import {parseRunIds} from '@/lib/apify/completed-runs';
import {getRefreshDispatchEnv} from '@/lib/config/server-env';
import {parseAnnotationMessage, REFRESH_REPORT_ANNOTATION_TITLE, type RefreshReportSummary} from '@/lib/refresh/report';

/**
 * Triggers `.github/workflows/refresh.yml` and waits for its verdict. This is
 * what a scheduled Claude routine runs: the workflow stays the only Airtable writer for weekly runs, so
 * its concurrency group, timeout and Actions secrets still apply, and the caller
 * needs nothing more than a token that can dispatch workflows on one repository.
 */

const WORKFLOW = 'refresh.yml';
const API = 'https://api.github.com';
/** Allow one 20-minute job to finish ahead of this 20-minute job. */
const DEFAULT_DEADLINE_MS = 45 * 60 * 1_000;
const DEFAULT_POLL_MS = 15_000;

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
  /** A pilot may use a branch with the new workflow before production cutover. */
  ref?: string;
  fetch?: typeof globalThis.fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  pollIntervalMs?: number;
  deadlineMs?: number;
  runIds: string;
  target: 'pilot' | 'production';
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
          'x-github-api-version': '2026-03-10',
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

  let run: WorkflowRun | undefined;
  try {
    const runIds = parseRunIds(options.runIds);
    const ref = options.ref ?? (await github<{default_branch?: string}>(''))?.default_branch;
    if (!ref) throw new DispatchError('default_branch_unknown');
    const dispatched = await github<{workflow_run_id: number; html_url: string}>(`/actions/workflows/${WORKFLOW}/dispatches`, {
      method: 'POST', body: JSON.stringify({ref, inputs: {run_ids: runIds.join(','), target: options.target}}),
    });
    if (!dispatched || !Number.isSafeInteger(dispatched.workflow_run_id)) throw new DispatchError('run_id_missing');
    run = {id: dispatched.workflow_run_id, html_url: dispatched.html_url, status: 'queued', conclusion: null};

    const deadline = started + (options.deadlineMs ?? DEFAULT_DEADLINE_MS);
    while (run.status !== 'completed') {
      if (now() > deadline) return result('timed_out', 'run_still_active', run);
      await sleep(pollMs);
      run = (await github<WorkflowRun>(`/actions/runs/${run.id}`)) ?? run;
    }

    const report = await readReport(run.id);
    if (!report) return result('failed', 'report_missing', run);
    if (report.runId !== 'apify-' + runIds.join(',')) return result('failed', 'report_run_mismatch', run, report);
    if (report.status === 'succeeded' && run.conclusion !== 'success') return result('failed', 'workflow_failed_after_refresh', run, report);
    return result(report.status, null, run, report);
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

export async function runDispatchRefreshCli(env: NodeJS.Dict<string> = process.env, args: string[] = process.argv.slice(2)): Promise<{exitCode: number; stdout: string}> {
  let config;
  try {
    config = getRefreshDispatchEnv(env);
  } catch (error) {
    // The env error lists variable names only, never values.
    const message = error instanceof Error ? error.message : 'invalid_environment';
    return {exitCode: 1, stdout: JSON.stringify({status: 'dispatch_failed', error: message})};
  }
  const [target, runIds] = args;
  if (!runIds || (target !== 'pilot' && target !== 'production') || args.length !== 2) {
    return {exitCode: 1, stdout: JSON.stringify({status: 'dispatch_failed', error: 'expected_target_and_run_ids'})};
  }
  const outcome = await dispatchRefresh({runIds, target, token: config.GITHUB_DISPATCH_TOKEN, repository: config.GITHUB_REPOSITORY, ref: config.REFRESH_REF});
  // No retries: a failed or partial run is left for an operator, like a scheduled one.
  return {exitCode: outcome.status === 'succeeded' ? 0 : 1, stdout: JSON.stringify(outcome)};
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  void runDispatchRefreshCli().then(({exitCode, stdout}) => {
    process.stdout.write(`${stdout}\n`);
    process.exitCode = exitCode;
  });
}
