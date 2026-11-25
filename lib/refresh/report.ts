import {z} from 'zod';

/** Title of the check-run annotation that carries the summary from the refresh workflow to its dispatcher. */
export const REFRESH_REPORT_ANNOTATION_TITLE = 'refresh-report';

const ReportSchema = z.object({
  runId: z.string().optional(),
  status: z.enum(['succeeded', 'partial', 'failed']),
  processed: z.number().int().nonnegative().optional(),
  succeeded: z.number().int().nonnegative().optional(),
  failed: z.number().int().nonnegative().optional(),
  cacheInvalidated: z.boolean().optional(),
  errors: z.array(z.object({stage: z.string(), code: z.string()}).passthrough()).optional(),
  error: z.string().optional(),
});

/**
 * Counts and error codes only. Company identifiers stay in the job log, so the
 * summary is safe to show in a public run page or an agent's reply.
 */
export type RefreshReportSummary = {
  runId: string | null;
  status: 'succeeded' | 'partial' | 'failed';
  processed: number | null;
  succeeded: number | null;
  failed: number | null;
  cacheInvalidated: boolean | null;
  errorCodes: Record<string, number>;
};

export const RefreshReportSummarySchema: z.ZodType<RefreshReportSummary> = z.object({
  runId: z.string().nullable(),
  status: z.enum(['succeeded', 'partial', 'failed']),
  processed: z.number().int().nonnegative().nullable(),
  succeeded: z.number().int().nonnegative().nullable(),
  failed: z.number().int().nonnegative().nullable(),
  cacheInvalidated: z.boolean().nullable(),
  errorCodes: z.record(z.string(), z.number().int().positive()),
});

/** Reads the last non-empty line of `npm run enrich` output. Returns null when there is no valid report. */
export function summarizeEnrichOutput(output: string): RefreshReportSummary | null {
  const last = output.split('\n').map((line) => line.trim()).filter(Boolean).at(-1);
  if (!last) return null;
  let candidate: unknown;
  try {
    candidate = JSON.parse(last);
  } catch {
    return null;
  }
  const parsed = ReportSchema.safeParse(candidate);
  if (!parsed.success) return null;
  const report = parsed.data;
  const errorCodes: Record<string, number> = {};
  for (const {stage, code} of report.errors ?? []) errorCodes[`${stage}:${code}`] = (errorCodes[`${stage}:${code}`] ?? 0) + 1;
  if (report.error) errorCodes[`job:${report.error}`] = (errorCodes[`job:${report.error}`] ?? 0) + 1;
  return {
    runId: report.runId ?? null,
    status: report.status,
    processed: report.processed ?? null,
    succeeded: report.succeeded ?? null,
    failed: report.failed ?? null,
    cacheInvalidated: report.cacheInvalidated ?? null,
    errorCodes,
  };
}

const display = (value: string | number | boolean | null) => (value === null ? 'unknown' : String(value));

export function formatStepSummary(summary: RefreshReportSummary | null): string {
  if (!summary) return '## Refresh report\n\nNo report was produced. Read the `npm run enrich` step log.\n';
  const rows: Array<[string, string | number | boolean | null]> = [
    ['Run ID', summary.runId],
    ['Status', summary.status],
    ['Processed', summary.processed],
    ['Succeeded', summary.succeeded],
    ['Failed', summary.failed],
    ['Cache invalidated', summary.cacheInvalidated],
  ];
  const errors = Object.entries(summary.errorCodes).map(([code, count]) => `| \`${code}\` | ${count} |`);
  return [
    '## Refresh report',
    '',
    '| Field | Value |',
    '|-|-|',
    ...rows.map(([label, value]) => `| ${label} | ${display(value)} |`),
    ...(errors.length ? ['', '| Error | Count |', '|-|-|', ...errors] : []),
    '',
  ].join('\n');
}

/** GitHub workflow command; `%`, CR and LF must be escaped in the message. */
export function formatAnnotation(summary: RefreshReportSummary | null): string {
  const level = summary?.status === 'succeeded' ? 'notice' : 'error';
  const message = JSON.stringify(summary ?? {status: 'failed', missingReport: true})
    .replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
  return `::${level} title=${REFRESH_REPORT_ANNOTATION_TITLE}::${message}`;
}

/** Parses the annotation message back on the dispatcher side. GitHub returns it unescaped. */
export function parseAnnotationMessage(message: string): RefreshReportSummary | null {
  try {
    const parsed = RefreshReportSummarySchema.safeParse(JSON.parse(message));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
