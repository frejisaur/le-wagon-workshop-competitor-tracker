import type {DashboardValue} from '@/lib/domain/dashboard';

type ValueFormat = 'number' | 'percent' | 'points' | 'text';
export type MovementTrend = 'beneficial' | 'adverse' | 'neutral';

export type KpiMetric = {
  label: string;
  value: DashboardValue;
  format?: ValueFormat;
  movement?: {value: DashboardValue; trend: MovementTrend; format?: ValueFormat};
};

function formatValue(value: DashboardValue['value'], format: ValueFormat = 'number'): string {
  if (value === null || value === undefined) return 'Not available';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string' || format === 'text') return String(value);
  if (format === 'percent') return new Intl.NumberFormat('en-US', {style: 'percent', maximumFractionDigits: 1}).format(value);
  const formatted = new Intl.NumberFormat('en-US', {maximumFractionDigits: 1}).format(value).replace(/^-/, '−');
  return format === 'points' ? `${formatted} pts` : formatted;
}

function movementCopy(movement: NonNullable<KpiMetric['movement']>): string {
  const {value} = movement.value;
  if (typeof value !== 'number') return 'Movement not available';
  const formatted = formatValue(Math.abs(value), movement.format ?? 'percent');
  if (value > 0) return `Increased ${formatted}`;
  if (value < 0) return `Decreased ${formatted}`;
  return 'No change';
}

export function KpiLedger({metrics}: {metrics: readonly KpiMetric[]}) {
  return <ul className="kpi-ledger" aria-label="Key metrics">
    {metrics.slice(0, 5).map((metric) => {
      const movement = metric.movement ? movementCopy(metric.movement) : null;
      return <li className="kpi-ledger__item" key={metric.label}>
        <span className="kpi-ledger__label">{metric.label}</span>
        <strong className="kpi-ledger__value">{formatValue(metric.value.value, metric.format)}</strong>
        <span className="kpi-ledger__classification" data-classification={metric.value.classification}>{metric.value.classification}</span>
        {movement ? <><span className="kpi-ledger__classification kpi-ledger__movement-classification" data-classification={metric.movement!.value.classification}>{metric.movement!.value.classification} movement</span><span className="kpi-ledger__movement" data-trend={metric.movement!.trend}>{movement}</span></> : null}
      </li>;
    })}
  </ul>;
}
