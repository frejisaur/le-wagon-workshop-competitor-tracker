import {readFileSync} from 'node:fs';
import {z} from 'zod';

const SegmentSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  startMinute: z.number().int().min(0),
  endMinute: z.number().int().positive(),
  liveDependency: z.boolean(),
  fallbackArtifact: z.string().startsWith('workshop/').optional(),
});

export const WorkshopManifestSchema = z.object({
  version: z.literal(1),
  audience: z.literal('marketers-learning-claude-code'),
  segments: z.array(SegmentSchema).min(1),
  contextPackets: z.array(z.string().startsWith('workshop/context/')).length(4),
  canonicalSkills: z.array(z.string().startsWith('.agents/skills/')).length(4),
});

export type WorkshopManifest = z.infer<typeof WorkshopManifestSchema>;

export function loadWorkshopManifest(path: string): WorkshopManifest {
  return WorkshopManifestSchema.parse(JSON.parse(readFileSync(path, 'utf8')));
}

export function validateWorkshopTimeline(manifest: WorkshopManifest): {minutes: number; contiguous: boolean} {
  const contiguous = manifest.segments.every((segment, index) => (
    index === 0
      ? segment.startMinute === 0
      : segment.startMinute === manifest.segments[index - 1].endMinute
  )) && manifest.segments.every((segment) => segment.endMinute > segment.startMinute);
  return {minutes: manifest.segments.at(-1)?.endMinute ?? 0, contiguous};
}
