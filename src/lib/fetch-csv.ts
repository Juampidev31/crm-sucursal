import 'server-only';

import { parseCSV } from '@/lib/csv-utils';

export async function fetchCsv(
  url: string,
  init?: RequestInit,
): Promise<string[][]> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`La fuente CSV respondió con estado ${response.status}.`);
  }

  return parseCSV(await response.text());
}
