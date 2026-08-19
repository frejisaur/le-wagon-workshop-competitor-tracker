import {parseApolloCsv} from '@/lib/schemas/apollo';
import {parseSemrushPayload} from '@/lib/schemas/semrush';
import {joinRoster} from '@/lib/transforms/join-roster';

export type ProviderSummary = {
  sourceLabel: string;
  generatedAt: string;
  apollo: {rows: number; validWebsiteRows: number; missingWebsiteRows: number};
  semrush: {records: number; malformedSections: Record<string, number>};
  join: {accepted: number; unmatchedApollo: number; apifyOnly: number; rejected: number};
};

export type ExpectedCounts = {
  apolloRows: number;
  semrushRecords: number;
  acceptedCompanies: number;
  rejectedRows: number;
  rejectionCodes: Record<string, number>;
};

export type WorkshopContext = {providerSummary: ProviderSummary; expectedCounts: ExpectedCounts};

function increment(target: Record<string, number>, key: string): void {
  target[key] = (target[key] ?? 0) + 1;
}

export function buildWorkshopContext(input: {
  apolloCsv: string;
  semrushJson: string;
  sourceLabel: string;
  generatedAt: string;
}): WorkshopContext {
  const apolloRows = parseApolloCsv(input.apolloCsv);
  const parsedSemrush = parseSemrushPayload(JSON.parse(input.semrushJson));
  const join = joinRoster(apolloRows, parsedSemrush.records, {observedAt: 'workshop-context'});
  const malformedSections: Record<string, number> = {};
  const rejectionCodes: Record<string, number> = {};
  parsedSemrush.issues.forEach((issue) => increment(malformedSections, issue.section));
  join.rejections.forEach((rejection) => increment(rejectionCodes, rejection.code));
  const missingWebsiteRows = apolloRows.filter((row) => !row.Website.trim()).length;

  return {
    providerSummary: {
      sourceLabel: input.sourceLabel,
      generatedAt: input.generatedAt,
      apollo: {rows: apolloRows.length, validWebsiteRows: apolloRows.length - missingWebsiteRows, missingWebsiteRows},
      semrush: {records: parsedSemrush.records.length, malformedSections},
      join: {accepted: join.accepted.length, unmatchedApollo: join.unmatchedApollo.length, apifyOnly: join.apifyOnly.length, rejected: join.rejections.length},
    },
    expectedCounts: {
      apolloRows: apolloRows.length,
      semrushRecords: parsedSemrush.records.length,
      acceptedCompanies: join.accepted.length,
      rejectedRows: join.rejections.length,
      rejectionCodes,
    },
  };
}
