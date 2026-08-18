import Papa from 'papaparse';
import {z} from 'zod';

/** Observed Apollo roster fields retained for source provenance. */
export const ApolloRowSchema = z.object({
  'Company Name': z.string(),
  Website: z.string(),
  'Apollo Account Id': z.string(),
  'Apollo Record Id': z.string(),
}).passthrough();

export type ApolloRow = z.infer<typeof ApolloRowSchema>;

/** Parses the provider CSV before it can enter join or persistence code. */
export function parseApolloCsv(text: string): ApolloRow[] {
  const parsed = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: 'greedy',
  });

  if (parsed.errors.length > 0) {
    throw new Error(`Apollo CSV parse failed: ${parsed.errors[0].message}`);
  }

  return parsed.data.map((row, index) => {
    const result = ApolloRowSchema.safeParse(row);
    if (!result.success) {
      throw new Error(`Apollo CSV row ${index + 2} is invalid: ${result.error.message}`);
    }
    return result.data;
  });
}
