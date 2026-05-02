import { notFound } from 'next/navigation';
import { getCobranzasData, COBRANZAS_YEARS } from './data';
import CobranzasClient from './CobranzasClient';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ year?: string; zoom?: string }>;

export default async function ReporteCobranzasPage({ searchParams }: { searchParams: SearchParams }) {
  const { year: yearParam, zoom: zoomParam } = await searchParams;
  const year = yearParam && COBRANZAS_YEARS.includes(yearParam) ? yearParam : '2026';
  const data = await getCobranzasData(year);
  if (!data) notFound();

  return <CobranzasClient data={data} year={year} years={COBRANZAS_YEARS} />;
}
