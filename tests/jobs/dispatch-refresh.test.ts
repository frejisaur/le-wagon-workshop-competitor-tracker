import {describe, expect, it} from 'vitest';
import {dispatchRefresh, runDispatchRefreshCli} from '@/jobs/dispatch-refresh';
import type {RefreshReportSummary} from '@/lib/refresh/report';

const TOKEN = 'sentinel-dispatch-token';
const report: RefreshReportSummary = {
  runId: 'refresh-1', status: 'succeeded', processed: 10, succeeded: 10, failed: 0, cacheInvalidated: true, errorCodes: {},
};

type Call = {method: string; path: string; body?: string; auth?: string};
type Route = (call: Call) => {status: number; body?: unknown} | undefined;

function fakeGitHub(routes: Route[]) {
  const calls: Call[] = [];
  const fetch = (async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const call: Call = {
      method: init?.method ?? 'GET',
      path: `${url.pathname.replace('/repos/owner/repo', '')}${url.search}`,
      body: init?.body as string | undefined,
      auth: (init?.headers as Record<string, string>)?.authorization,
    };
    calls.push(call);
    for (const route of routes) {
      const response = route(call);
      if (response) return new Response(response.status === 204 ? null : JSON.stringify(response.body), {status: response.status});
    }
    return new Response('{"message":"unexpected"}', {status: 404});
  }) as typeof globalThis.fetch;
  return {fetch, calls};
}

function clock() {
  let time = 0;
  return {now: () => time, sleep: async (ms: number) => { time += ms; }};
}

const runsList = (runs: unknown[]): Route => (call) => (call.path.startsWith('/actions/workflows/refresh.yml/runs') ? {status: 200, body: {workflow_runs: runs}} : undefined);

describe('refresh dispatch', () => {
  it('dispatches the workflow, waits for the new run, and returns its sanitized report', async () => {
    let listed = 0;
    let polled = 0;
    const {fetch, calls} = fakeGitHub([
      (call) => (call.path.startsWith('/actions/workflows/refresh.yml/runs')
        ? {status: 200, body: {workflow_runs: listed++ === 0 ? [{id: 7, status: 'completed', conclusion: 'success', html_url: 'old'}] : [{id: 9, status: 'queued', conclusion: null, html_url: 'https://github.com/owner/repo/actions/runs/9'}, {id: 7, status: 'completed', conclusion: 'success', html_url: 'old'}]}}
        : undefined),
      (call) => (call.method === 'POST' && call.path === '/actions/workflows/refresh.yml/dispatches' ? {status: 204} : undefined),
      (call) => (call.path === '/actions/runs/9' ? {status: 200, body: {id: 9, status: polled++ ? 'completed' : 'in_progress', conclusion: polled > 1 ? 'success' : null, html_url: 'https://github.com/owner/repo/actions/runs/9'}} : undefined),
      (call) => (call.path === '/actions/runs/9/jobs' ? {status: 200, body: {jobs: [{id: 42}]}} : undefined),
      (call) => (call.path === '/check-runs/42/annotations' ? {status: 200, body: [{title: 'other', message: 'x'}, {title: 'refresh-report', message: JSON.stringify(report)}]} : undefined),
    ]);

    const result = await dispatchRefresh({token: TOKEN, repository: 'owner/repo', ref: 'main', fetch, ...clock()});

    expect(result).toEqual({status: 'succeeded', error: null, runUrl: 'https://github.com/owner/repo/actions/runs/9', conclusion: 'success', report});
    expect(calls.find((call) => call.method === 'POST')?.body).toBe('{"ref":"main"}');
    expect(calls.every((call) => call.auth === `Bearer ${TOKEN}`)).toBe(true);
  });

  it('reports the refresh verdict from the annotation, so a partial run is not called a success', async () => {
    let listed = 0;
    const {fetch} = fakeGitHub([
      (call) => (call.path.startsWith('/actions/workflows/refresh.yml/runs') ? {status: 200, body: {workflow_runs: listed++ ? [{id: 3, status: 'completed', conclusion: 'failure', html_url: 'u'}] : []}} : undefined),
      (call) => (call.method === 'POST' ? {status: 204} : undefined),
      (call) => (call.path === '/actions/runs/3/jobs' ? {status: 200, body: {jobs: [{id: 4}]}} : undefined),
      (call) => (call.path === '/check-runs/4/annotations' ? {status: 200, body: [{title: 'refresh-report', message: JSON.stringify({...report, status: 'partial', failed: 1})}]} : undefined),
    ]);
    expect(await dispatchRefresh({token: TOKEN, repository: 'owner/repo', ref: 'main', fetch, ...clock()})).toMatchObject({status: 'partial', conclusion: 'failure'});
  });

  it('targets the repository default branch when no ref is given', async () => {
    let listed = 0;
    const {fetch, calls} = fakeGitHub([
      (call) => (call.path === '' ? {status: 200, body: {default_branch: 'live-demo'}} : undefined),
      (call) => (call.path.startsWith('/actions/workflows/refresh.yml/runs') ? {status: 200, body: {workflow_runs: listed++ ? [{id: 2, status: 'completed', conclusion: 'success', html_url: 'u'}] : []}} : undefined),
      (call) => (call.method === 'POST' ? {status: 204} : undefined),
      (call) => (call.path === '/actions/runs/2/jobs' ? {status: 200, body: {jobs: [{id: 3}]}} : undefined),
      (call) => (call.path === '/check-runs/3/annotations' ? {status: 200, body: [{title: 'refresh-report', message: JSON.stringify(report)}]} : undefined),
    ]);
    expect(await dispatchRefresh({token: TOKEN, repository: 'owner/repo', fetch, ...clock()})).toMatchObject({status: 'succeeded'});
    expect(calls.find((call) => call.method === 'POST')?.body).toBe('{"ref":"live-demo"}');
    expect(calls.find((call) => call.path.startsWith('/actions/workflows/refresh.yml/runs'))?.path).toContain('branch=live-demo');
  });

  it('fails closed with a status code only when GitHub rejects the dispatch', async () => {
    const {fetch} = fakeGitHub([runsList([]), (call) => (call.method === 'POST' ? {status: 403, body: {message: `bad credentials ${TOKEN}`}} : undefined)]);
    const result = await dispatchRefresh({token: TOKEN, repository: 'owner/repo', ref: 'main', fetch, ...clock()});
    expect(result).toEqual({status: 'dispatch_failed', error: 'github_http_403', runUrl: null, conclusion: null, report: null});
    expect(JSON.stringify(result)).not.toContain(TOKEN);
  });

  it('gives up when the dispatched run never appears', async () => {
    const {fetch} = fakeGitHub([runsList([]), (call) => (call.method === 'POST' ? {status: 204} : undefined)]);
    expect(await dispatchRefresh({token: TOKEN, repository: 'owner/repo', ref: 'main', fetch, ...clock()})).toMatchObject({status: 'dispatch_failed', error: 'run_not_found'});
  });

  it('stops waiting at its deadline and returns the run link for an operator', async () => {
    let listed = 0;
    const {fetch} = fakeGitHub([
      (call) => (call.path.startsWith('/actions/workflows/refresh.yml/runs') ? {status: 200, body: {workflow_runs: listed++ ? [{id: 5, status: 'queued', conclusion: null, html_url: 'run-5'}] : []}} : undefined),
      (call) => (call.method === 'POST' ? {status: 204} : undefined),
      (call) => (call.path === '/actions/runs/5' ? {status: 200, body: {id: 5, status: 'in_progress', conclusion: null, html_url: 'run-5'}} : undefined),
    ]);
    expect(await dispatchRefresh({token: TOKEN, repository: 'owner/repo', ref: 'main', fetch, ...clock(), deadlineMs: 60_000})).toMatchObject({status: 'timed_out', runUrl: 'run-5'});
  });

  it('marks a completed run without a report as missing rather than inventing one', async () => {
    let listed = 0;
    const {fetch} = fakeGitHub([
      (call) => (call.path.startsWith('/actions/workflows/refresh.yml/runs') ? {status: 200, body: {workflow_runs: listed++ ? [{id: 6, status: 'completed', conclusion: 'cancelled', html_url: 'run-6'}] : []}} : undefined),
      (call) => (call.method === 'POST' ? {status: 204} : undefined),
      (call) => (call.path === '/actions/runs/6/jobs' ? {status: 200, body: {jobs: [{id: 8}]}} : undefined),
      (call) => (call.path === '/check-runs/8/annotations' ? {status: 200, body: []} : undefined),
    ]);
    expect(await dispatchRefresh({token: TOKEN, repository: 'owner/repo', ref: 'main', fetch, ...clock()})).toMatchObject({status: 'failed', error: 'report_missing', conclusion: 'cancelled'});
  });

  it('exits nonzero with variable names only when its environment is incomplete', async () => {
    const result = await runDispatchRefreshCli({GITHUB_DISPATCH_TOKEN: TOKEN});
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain('GITHUB_REPOSITORY');
    expect(result.stdout).not.toContain(TOKEN);
  });
});
