import type {AirtableFields, AirtableRecord, SystemRecord, SystemWireInput} from './types';

const SYSTEM_STATUSES = new Set<string>(['running', 'partial', 'succeeded', 'failed']);

export function toAirtableSystemFields(system: SystemWireInput): AirtableFields {
  return {'Identity • System ID': system.systemId, 'Workflow • Last Run Started At': system.lastRunStartedAt, 'Workflow • Last Run Finished At': system.lastRunFinishedAt, ...(system.lastSuccessfulRunAt === undefined ? {} : {'Workflow • Last Successful Run At': system.lastSuccessfulRunAt}), 'Workflow • Status': system.status, 'Workflow • Processed Companies': system.processedCompanies, 'Workflow • Succeeded Companies': system.succeededCompanies, 'Workflow • Failed Companies': system.failedCompanies, 'Workflow • Error Summary': system.errorSummary, 'Workflow • Cache Version': system.cacheVersion, 'Refresh • Workflow Version': system.refreshWorkflowVersion, 'Refresh • Run ID': system.refreshRunId, 'Agent • Last Run At': system.lastAgentRunAt, 'Agent • Skill Version': system.agentSkillVersion, 'Agent • Processed Companies': system.agentProcessedCompanies, 'Agent • Review Count': system.agentReviewCount, 'Agent • Error Summary': system.agentErrorSummary};
}

/** Parses the System row; malformed values read as absent, never as a default. */
export function parseSystemRecord(record: AirtableRecord): SystemRecord {
  const text = (name: string) => { const value = record.fields[name]; return typeof value === 'string' && value ? value : undefined; };
  const status = text('Workflow • Status');
  return {recordId: record.id, ...(text('Identity • System ID') ? {systemId: text('Identity • System ID')} : {}), ...(status && SYSTEM_STATUSES.has(status) ? {status: status as SystemRecord['status']} : {}), ...(text('Workflow • Last Successful Run At') ? {lastSuccessfulRunAt: text('Workflow • Last Successful Run At')} : {})};
}

/** The singleton System row: the one with the canonical ID, else the first. */
export function selectSystemRecord(records: AirtableRecord[]): SystemRecord | null {
  const record = records.find((candidate) => candidate.fields['Identity • System ID'] === 'system') ?? records[0];
  return record ? parseSystemRecord(record) : null;
}
