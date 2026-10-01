export const RESUMEN_SNAPSHOT_VERSION = 2 as const;

export type StoredResumenSnapshot<TDatos = unknown> = {
  text?: string;
  html?: string;
  datos?: TDatos;
  snapshotVersion?: number;
};

export function wrapResumenSnapshot(innerHtml: string): string {
  return `<div class="report-snapshot" data-snapshot-version="${RESUMEN_SNAPSHOT_VERSION}">${innerHtml}</div>`;
}

export function detectResumenSnapshotVersion(html: string): number | undefined {
  const match = html.match(/data-snapshot-version=["'](\d+)["']/i);
  return match ? Number.parseInt(match[1], 10) : undefined;
}

export function parseStoredResumenSnapshot<TDatos = unknown>(raw: string): StoredResumenSnapshot<TDatos> {
  if (!raw) return {};
  if (raw.trimStart().startsWith('{')) {
    try {
      const parsed = JSON.parse(raw) as StoredResumenSnapshot<TDatos>;
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return { html: raw };
    }
  }
  return raw.length > 200 || raw.trimStart().startsWith('<') ? { html: raw } : { text: raw };
}
