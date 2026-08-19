export type RecordBudgetCounts = {companies: number; keywords: number; paidAds: number; insights: number; reviews: number; system: number};

/** Airtable's Free-plan constraint is strict: exactly 1,000 records is not acceptable. */
export function estimateRecordBudget(counts: RecordBudgetCounts): {total: number; withinFreeLimit: boolean} {
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  return {total, withinFreeLimit: total < 1_000};
}
