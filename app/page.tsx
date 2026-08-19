import {AppShell} from '@/components/shared/AppShell';
import {LandscapeScreen} from '@/components/landscape/LandscapeScreen';
import {getLandscapeResponse} from '@/lib/api/dashboard-service';

export default async function HomePage({searchParams}: {searchParams: Promise<Record<string, string | string[] | undefined>>}) {
  const [data, params] = await Promise.all([getLandscapeResponse(), searchParams]);
  const search = new URLSearchParams(Object.entries(params).flatMap(([key, value]) => typeof value === 'string' ? [[key, value]] : Array.isArray(value) ? value.map((entry) => [key, entry]) : [])).toString();
  return <AppShell status={data.status} freshness={data.freshness}><LandscapeScreen initialData={data} initialSearch={search ? `?${search}` : ''} /></AppShell>;
}
