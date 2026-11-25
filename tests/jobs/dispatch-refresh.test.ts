import {describe, expect, it} from 'vitest';
import {dispatchRefresh, runDispatchRefreshCli} from '@/jobs/dispatch-refresh';

describe('completed-run dispatch', () => {
  const report = {runId: 'apify-A,B', status: 'succeeded', processed: 2, succeeded: 2, failed: 0, cacheInvalidated: true, errorCodes: {}};
  async function dispatch(conclusion: string, annotation: unknown, queued = false) {
    const calls: string[] = [];
    let time = 0;
    const fetch: typeof globalThis.fetch = async (input, options) => {
      const path = new URL(String(input)).pathname;
      calls.push(path);
      if (path.endsWith('/repo')) return Response.json({default_branch: 'main'});
      if (path.endsWith('/dispatches')) {
        expect(JSON.parse(String(options?.body))).toEqual({ref: 'main', inputs: {run_ids: 'A,B', target: 'pilot'}});
        return Response.json({workflow_run_id: 123, html_url: 'run-link'});
      }
      if (path.endsWith('/runs/123')) return Response.json({id: 123, html_url: 'run-link', status: queued ? 'queued' : 'completed', conclusion});
      if (path.endsWith('/123/jobs')) return Response.json({jobs: [{id: 9}]});
      if (path.endsWith('/9/annotations')) return Response.json([{title: 'refresh-report', message: JSON.stringify(annotation)}]);
      throw new Error('unexpected path');
    };
    return dispatchRefresh({fetch, repository: 'owner/repo', token: 'fixture', runIds: 'B,A', target: 'pilot',
      now: () => time, sleep: async ms => { time += ms; }, deadlineMs: 35_000});
  }
  it('waits for the exact dispatched job and confirms its matching annotation', async () => {
    expect(await dispatch('success', report)).toMatchObject({status: 'succeeded', runUrl: 'run-link', report});
    expect(await dispatch('failure', {...report, status: 'partial'})).toMatchObject({status: 'partial'});
  });
  it('surfaces export failure, missing or stale reports and timeouts', async () => {
    expect(await dispatch('failure', report)).toMatchObject({status: 'failed', error: 'workflow_failed_after_refresh'});
    expect(await dispatch('success', {})).toMatchObject({status: 'failed', error: 'report_missing'});
    expect(await dispatch('success', {...report, runId: 'old'})).toMatchObject({error: 'report_run_mismatch'});
    expect(await dispatch('success', report, true)).toMatchObject({status: 'timed_out'});
  });
  it('rejects missing target, IDs or credentials without exposing credentials', async () => {
    expect((await runDispatchRefreshCli({GITHUB_DISPATCH_TOKEN:'private'}, [])).stdout).not.toContain('private');
    expect((await runDispatchRefreshCli({GITHUB_DISPATCH_TOKEN:'private', GITHUB_REPOSITORY:'owner/repo'}, [])).exitCode).toBe(1);
  });
});
