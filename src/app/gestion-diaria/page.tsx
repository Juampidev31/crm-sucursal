import GestionDiariaClient from './GestionDiariaClient';

type SearchParams = Promise<{ analista?: string }>;

export default async function GestionDiariaPage({ searchParams }: { searchParams: SearchParams }) {
  const { analista } = await searchParams;
  return <GestionDiariaClient analistaInicial={analista ?? ''} />;
}
