import type {DashboardValue} from '@/lib/domain/dashboard';

type ValueFormat = 'number' | 'percent' | 'text';

export type KpiMetric = {
  label: string;
  value: DashboardValue;
  format?: ValueFormat;
  movement?: {value: DashboardValue; format?: ValueFormat; text?: string};
};

function formatValue(value: DashboardValue['value'], format: ValueFormat = 'number'): string {
  if (value === null || value === undefined) return 'Not available';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string' || format === 'text') return String(value);
  if (format === 'percent') return new Intl.NumberFormat('en-US', {style: 'percent', maximumFractionDigits: 1}).format(value);
  return new Intl.NumberFormat('en-US', {maximumFractionDigits: 1}).format(value);
}

function movementCopy(movement: NonNullable<KpiMetric['movement']>): {text: string; direction: 'positive' | 'negative' | 'neutral'} {
  if (movement.text) return {text: movement.text, direction: 'neutral'};
  const {value} = movement.value;
  if (typeof value !== 'number') return {text: 'Movement not available', direction: 'neutral'};
  const formatted = formatValue(Math.abs(value), movement.format ?? 'percent');
  if (value > 0) return {text: `Increased ${formatted}`, direction: 'positive'};
  if (value < 0) return {text: `Decreased ${formatted}`, direction: 'negative'};
  return {text: 'No change', direction: 'neutral'};
}

export function KpiLedger({metrics}: {metrics: readonly KpiMetric[]}) {
  return <ul className="kpi-ledger" aria-label="Key metrics">
    {metrics.slice(0, 5).map((metric) => {
      const movement = metric.movement ? movementCopy(metric.movement) : null;
      return <li className="kpi-ledger__item" key={metric.label}>
        <span className="kpi-ledger__label">{metric.label}</span>
        <strong className="kpi-ledger__value">{formatValue(metric.value.value, metric.format)}</strong>
        <span className="kpi-ledger__classification" data-classification={metric.value.classification}>{metric.value.classification}</span>
        {movement ? <span className="kpi-ledger__movement" data-direction={movement.direction}>{movement.text}</span> : null}
      </li>;
    })}
  </ul>;
}
