import {mkdtempSync, readFileSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {publishRefreshReport} from '@/jobs/publish-refresh-report';
import {formatAnnotation, formatStepSummary, parseAnnotationMessage, summarizeEnrichOutput} from '@/lib/refresh/report';

const partial = JSON.stringify({
  runId: 'refresh-2026-11-23T15-00-00Z',
  status: 'partial',
  processed: 10,
  succeeded: 9,
  failed: 1,
  cacheInvalidated: true,
  errors: [{companyId: 'rec1', canonicalDomain: 'acme.example', stage: 'provider', code: 'missing_metrics'}],
});

describe('refresh report summary', () => {
  it('keeps counts and error codes and drops company identifiers', () => {
    const summary = summarizeEnrichOutput(`npm noise\n${partial}\n`);
    expect(summary).toEqual({
      runId: 'refresh-2026-11-23T15-00-00Z', status: 'partial', processed: 10, succeeded: 9, failed: 1,
      cacheInvalidated: true, errorCodes: {'provider:missing_metrics': 1},
    });
    expect(JSON.stringify(summary)).not.toMatch(/acme|rec1/);
  });

  it('reads the job-level safe failure report', () => {
    expect(summarizeEnrichOutput('{"status":"failed","error":"enrichment_failed"}')).toMatchObject({status: 'failed', errorCodes: {'job:enrichment_failed': 1}});
  });

  it('returns null for missing or malformed output instead of guessing', () => {
    expect(summarizeEnrichOutput('')).toBeNull();
    expect(summarizeEnrichOutput('Error: boom')).toBeNull();
    expect(summarizeEnrichOutput('{"status":"maybe"}')).toBeNull();
    expect(formatStepSummary(null)).toContain('No report was produced');
  });

  it('renders a minimal markdown table for the run page', () => {
    const markdown = formatStepSummary(summarizeEnrichOutput(partial));
    expect(markdown).toContain('|-|-|');
    expect(markdown).toContain('| Status | partial |');
    expect(markdown).toContain('| `provider:missing_metrics` | 1 |');
  });

  it('round-trips through an escaped annotation, raising an error level unless the refresh succeeded', () => {
    const summary = summarizeEnrichOutput(partial);
    const annotation = formatAnnotation({...summary!, runId: 'refresh-100%'});
    expect(annotation).toMatch(/^::error title=refresh-report::/);
    expect(annotation).toContain('100%25');
    const message = annotation.replace(/^::error title=refresh-report::/, '').replaceAll('%25', '%');
    expect(parseAnnotationMessage(message)).toMatchObject({runId: 'refresh-100%', status: 'partial'});
    expect(formatAnnotation({...summary!, status: 'succeeded'})).toMatch(/^::notice /);
    expect(parseAnnotationMessage('not json')).toBeNull();
  });

  it('publishes the step summary even when enrich produced no file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'refresh-report-'));
    const stepSummary = join(dir, 'summary.md');
    writeFileSync(stepSummary, '');
    expect(publishRefreshReport(join(dir, 'missing.json'), {GITHUB_STEP_SUMMARY: stepSummary})).toMatch(/^::error /);
    expect(readFileSync(stepSummary, 'utf8')).toContain('No report was produced');
  });
});
