'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  ArrowLeft,
  BarChart3,
  CalendarDays,
  Gauge,
  Layers3,
  ListChecks,
  ShieldCheck,
  Tags,
  UsersRound,
} from 'lucide-react';
import Link from 'next/link';
import SelectReporte from '@/components/SelectReporte';
import { CorporateDateRangePicker } from '@/components/CorporateDateRangePicker';
import { useAuth } from '@/context/AuthContext';
import { useGestionDiaria } from '@/features/gestion-diaria/GestionDiariaProvider';
import { useAnalistas } from '@/features/settings/SettingsProvider';
import {
  buildIncomeRows,
  databaseRowToIncomeRow,
  GESTION_SHEETS,
  GESTION_SHEET_TABS,
  incomeRowIdentity,
  loadGoogleSheet,
  normalizeGestionValue,
  readPersistedSheetChanges,
  type GestionSheetAnalyst,
  type IncomeSheetRow,
} from '@/lib/gestion-diaria-sheets';
import styles from './GestionDiariaReport.module.css';

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const INITIAL_DATE = new Date();
const INITIAL_MONTH = INITIAL_DATE.getMonth() + 1;
const INITIAL_YEAR = INITIAL_DATE.getFullYear();
const DAILY_DATE_FORMAT = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long' });

function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function parseIsoDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

const SCORE_BUCKETS = [
  { key: 'sin-score', label: 'Sin score', test: (score: number | null) => score === null },
  { key: 'bajo', label: 'Menos de 550', test: (score: number | null) => score !== null && score < 550 },
  { key: 'medio', label: '550 a 699', test: (score: number | null) => score !== null && score >= 550 && score < 700 },
  { key: 'alto', label: '700 a 799', test: (score: number | null) => score !== null && score >= 700 && score < 800 },
  { key: 'premium', label: '800 o más', test: (score: number | null) => score !== null && score >= 800 },
] as const;

interface DistributionItem {
  key: string;
  label: string;
  count: number;
  percentage: number;
}

function normalizedKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('es');
}

function displayValue(value: string): string {
  return value.trim().replace(/\s+/g, ' ') || 'Sin datos';
}

function groupBy(rows: IncomeSheetRow[], field: 'tipoCliente' | 'actividad' | 'estado'): DistributionItem[] {
  const groups = new Map<string, { label: string; count: number }>();
  rows.forEach(row => {
    const label = displayValue(row[field]);
    const key = normalizedKey(label);
    const current = groups.get(key);
    groups.set(key, { label: current?.label ?? label, count: (current?.count ?? 0) + 1 });
  });
  return Array.from(groups.entries())
    .map(([key, value]) => ({
      key,
      label: value.label,
      count: value.count,
      percentage: rows.length ? (value.count / rows.length) * 100 : 0,
    }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, 'es'));
}

function validScore(value: string | number | null): number | null {
  const parsed = typeof value === 'string'
    ? Number(value.replace(/[^\d,-]/g, '').replace(',', '.'))
    : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function DistributionPanel({
  title,
  description,
  items,
  icon: Icon,
  tone,
}: {
  title: string;
  description: string;
  items: DistributionItem[];
  icon: typeof Tags;
  tone: 'blue' | 'slate' | 'violet' | 'amber';
}) {
  const max = Math.max(1, ...items.map(item => item.count));
  return (
    <section className={styles.breakdownCard} data-tone={tone}>
      <header className={styles.panelHeader}>
        <span className={styles.panelIcon}><Icon size={17} /></span>
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </header>
      <div className={styles.breakdownList}>
        {items.length === 0 ? (
          <div className={styles.emptyBreakdown}>Sin datos para el período seleccionado.</div>
        ) : items.map(item => (
          <div className={styles.breakdownRow} key={item.key}>
            <div className={styles.breakdownCopy}>
              <span title={item.label}>{item.label}</span>
              <strong>{item.count}<small>{item.percentage.toFixed(1)}%</small></strong>
            </div>
            <div className={styles.barTrack} aria-hidden="true">
              <span style={{ width: `${Math.max(2, (item.count / max) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function GestionDiariaReportClient() {
  const router = useRouter();
  const { loading: authLoading, isAdmin } = useAuth();
  const { registros, loading } = useGestionDiaria();
  const { nombres: analystNames } = useAnalistas();
  const [month, setMonth] = useState(INITIAL_MONTH);
  const [year, setYear] = useState(INITIAL_YEAR);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [analyst, setAnalyst] = useState('todos');
  const [sheetRows, setSheetRows] = useState<Partial<Record<GestionSheetAnalyst, IncomeSheetRow[]>>>({});
  const [sheetsLoading, setSheetsLoading] = useState(true);
  const [sheetError, setSheetError] = useState('');

  useEffect(() => {
    if (!authLoading && !isAdmin) router.replace('/reportes');
  }, [authLoading, isAdmin, router]);

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    Promise.allSettled(Object.entries(GESTION_SHEETS).map(async ([name, sheetId]) => {
      const data = await loadGoogleSheet(sheetId, GESTION_SHEET_TABS.ingresos.gid);
      return [name as GestionSheetAnalyst, buildIncomeRows(data, name)] as const;
    })).then(results => {
      if (!active) return;
      const next: Partial<Record<GestionSheetAnalyst, IncomeSheetRow[]>> = {};
      let failures = 0;
      results.forEach(result => {
        if (result.status === 'fulfilled') next[result.value[0]] = result.value[1];
        else failures++;
      });
      setSheetRows(next);
      setSheetError(failures ? `No se pudieron sincronizar ${failures} hoja${failures === 1 ? '' : 's'}.` : '');
      setSheetsLoading(false);
    });
    return () => { active = false; };
  }, [isAdmin]);

  const combinedRows = useMemo(() => {
    const configured = new Set(Object.keys(GESTION_SHEETS).map(normalizeGestionValue));
    const result: IncomeSheetRow[] = [];

    Object.keys(GESTION_SHEETS).forEach(name => {
      const analystName = name as GestionSheetAnalyst;
      const persisted = readPersistedSheetChanges(analystName);
      const effectiveSheetRows = (sheetRows[analystName] ?? [])
        .filter(row => !persisted.deletedIds.includes(row.id))
        .map(row => ({ ...(persisted.overrides[row.id] ?? row), analista: analystName }));
      const sheetIdentities = new Set(effectiveSheetRows.map(incomeRowIdentity));
      const databaseRows = registros.filter(row => normalizeGestionValue(row.analista) === normalizeGestionValue(analystName));
      const createdAtCounts = new Map<string, number>();
      databaseRows.forEach(row => {
        if (row.created_at) createdAtCounts.set(row.created_at, (createdAtCounts.get(row.created_at) ?? 0) + 1);
      });
      const applicationRows = databaseRows
        .filter(row => !row.created_at || (createdAtCounts.get(row.created_at) ?? 0) < 10)
        .map(databaseRowToIncomeRow)
        .filter(row => !sheetIdentities.has(incomeRowIdentity(row)));
      result.push(...applicationRows, ...effectiveSheetRows);
    });

    registros
      .filter(row => !configured.has(normalizeGestionValue(row.analista)))
      .forEach(row => result.push(databaseRowToIncomeRow(row)));
    return result;
  }, [registros, sheetRows]);

  const availableYears = useMemo(() => {
    const years = new Set<number>([INITIAL_YEAR]);
    combinedRows.forEach(row => {
      const match = row.fecha?.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) years.add(Number(match[1]));
    });
    return Array.from(years).sort((left, right) => right - left);
  }, [combinedRows]);

  const rows = useMemo(() => combinedRows.filter(row => {
    if (dateFrom || dateTo) {
      const rangeStart = dateFrom || dateTo;
      const rangeEnd = dateTo || dateFrom;
      if (!row.fecha || row.fecha < rangeStart || row.fecha > rangeEnd) return false;
    } else if (!row.fecha?.startsWith(`${year}-${String(month).padStart(2, '0')}`)) return false;
    return analyst === 'todos' || normalizedKey(row.analista ?? '') === normalizedKey(analyst);
  }), [analyst, combinedRows, dateFrom, dateTo, month, year]);

  const metrics = useMemo(() => {
    const scores = rows.map(row => validScore(row.score)).filter((score): score is number => score !== null);
    const uniqueClients = new Set(rows.map(row => {
      const cuil = row.cuil.replace(/\D/g, '');
      return cuil || normalizedKey(row.nombre);
    }).filter(Boolean)).size;
    const activeDays = new Set(rows.map(row => row.fecha).filter(Boolean)).size;
    return {
      total: rows.length,
      uniqueClients,
      activeDays,
      scored: scores.length,
      scoreCoverage: rows.length ? (scores.length / rows.length) * 100 : 0,
      averageScore: scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null,
    };
  }, [rows]);

  const typeDistribution = useMemo(() => groupBy(rows, 'tipoCliente'), [rows]);
  const activityDistribution = useMemo(() => groupBy(rows, 'actividad'), [rows]);
  const stateDistribution = useMemo(() => groupBy(rows, 'estado'), [rows]);
  const scoreDistribution = useMemo<DistributionItem[]>(() => SCORE_BUCKETS.map(bucket => {
    const count = rows.filter(row => bucket.test(validScore(row.score))).length;
    return {
      key: bucket.key,
      label: bucket.label,
      count,
      percentage: rows.length ? (count / rows.length) * 100 : 0,
    };
  }), [rows]);

  const dailyVolume = useMemo(() => {
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
    const startIso = dateFrom || dateTo || monthStart;
    const endIso = dateTo || dateFrom || monthEnd;
    const counts = new Map<string, number>();
    rows.forEach(row => {
      if (row.fecha) counts.set(row.fecha, (counts.get(row.fecha) ?? 0) + 1);
    });
    const dates: { iso: string; day: number; label: string; count: number }[] = [];
    const cursor = parseIsoDate(startIso);
    const end = parseIsoDate(endIso);
    while (cursor <= end) {
      const iso = toIsoDate(cursor);
      dates.push({ iso, day: cursor.getDate(), label: DAILY_DATE_FORMAT.format(cursor), count: counts.get(iso) ?? 0 });
      cursor.setDate(cursor.getDate() + 1);
    }
    return dates;
  }, [dateFrom, dateTo, month, rows, year]);
  const maxDaily = Math.max(1, ...dailyVolume.map(day => day.count));

  if (authLoading || !isAdmin) {
    return <div className={styles.accessState}><ShieldCheck size={22} /><span>Validando acceso administrativo…</span></div>;
  }

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <Link href="/reportes" className={styles.backLink}><ArrowLeft size={14} /> Reportes</Link>
          <div className={styles.titleRow}>
            <span className={styles.titleIcon}><BarChart3 size={22} /></span>
            <div>
              <h1>Gestión diaria · Reporte mensual</h1>
              <p>Análisis operativo por tipo de cliente, actividad, estado y calidad del score.</p>
            </div>
          </div>
        </div>
        <div className={styles.filters}>
          <SelectReporte
            value={analyst}
            onChange={value => setAnalyst(String(value))}
            options={[{ label: 'Todos los analistas', value: 'todos' }, ...Array.from(new Set([...analystNames, ...Object.keys(GESTION_SHEETS)])).map(name => ({ label: name, value: name }))]}
            icon="user"
            width="190px"
          />
          <CorporateDateRangePicker
            fromValue={dateFrom}
            toValue={dateTo}
            onChange={({ from, to }) => {
              setDateFrom(from);
              setDateTo(to);
            }}
            compact
          />
          <div className={styles.monthFilter}>
            <SelectReporte
              value={month}
              onChange={value => {
                setMonth(Number(value));
                setDateFrom('');
                setDateTo('');
              }}
              options={MONTHS.map((label, index) => ({ label, value: index + 1 }))}
              icon="calendar"
              width="150px"
            />
          </div>
          <SelectReporte
            value={year}
            onChange={value => {
              setYear(Number(value));
              setDateFrom('');
              setDateTo('');
            }}
            options={availableYears.map(value => ({ label: String(value), value }))}
            width="105px"
          />
        </div>
      </header>

      {loading || sheetsLoading ? (
        <div className={styles.loadingState}><span className="spinner" /> Preparando métricas mensuales…</div>
      ) : (
        <>
          {sheetError && <div className={styles.dataWarning}>{sheetError} El reporte muestra los datos disponibles.</div>}
          <section className={styles.kpiGrid} aria-label="Indicadores principales">
            <article className={styles.kpiCard}>
              <span className={styles.kpiIcon}><ListChecks size={18} /></span>
              <div><small>Gestiones del período</small><strong>{metrics.total.toLocaleString('es-AR')}</strong><p>{metrics.activeDays} días con actividad</p></div>
            </article>
            <article className={styles.kpiCard}>
              <span className={styles.kpiIcon}><UsersRound size={18} /></span>
              <div><small>Clientes únicos</small><strong>{metrics.uniqueClients.toLocaleString('es-AR')}</strong><p>{metrics.total ? (metrics.total / Math.max(1, metrics.uniqueClients)).toFixed(1) : '0'} gestiones por cliente</p></div>
            </article>
            <article className={styles.kpiCard}>
              <span className={styles.kpiIcon}><Gauge size={18} /></span>
              <div><small>Score promedio</small><strong>{metrics.averageScore ?? '—'}</strong><p>{metrics.scored.toLocaleString('es-AR')} registros con score</p></div>
            </article>
            <article className={styles.kpiCard}>
              <span className={styles.kpiIcon}><Layers3 size={18} /></span>
              <div><small>Cobertura de score</small><strong>{metrics.scoreCoverage.toFixed(1)}%</strong><p>{metrics.total - metrics.scored} sin score informado</p></div>
            </article>
          </section>

          <section className={styles.trendCard}>
            <header className={styles.panelHeader}>
              <span className={styles.panelIcon}><CalendarDays size={17} /></span>
              <div><h2>Volumen diario</h2><p>Cantidad de gestiones registradas cada día del período.</p></div>
            </header>
            <div className={styles.dailyChart}>
              {dailyVolume.map(item => (
                <div
                  className={styles.dayColumn}
                  key={item.iso}
                  tabIndex={0}
                  aria-label={`${item.label}: ${item.count} ${item.count === 1 ? 'gestión' : 'gestiones'}`}
                >
                  <span className={styles.dayTooltip} role="tooltip">
                    <strong>{item.label}</strong>
                    <span>{item.count} {item.count === 1 ? 'gestión' : 'gestiones'}</span>
                  </span>
                  <span className={styles.dayCount}>{item.count || ''}</span>
                  <span className={styles.dayBar} style={{ height: `${item.count ? Math.max(8, (item.count / maxDaily) * 100) : 2}%` }} />
                  <small>{item.day}</small>
                </div>
              ))}
            </div>
          </section>

          <div className={styles.breakdownGrid}>
            <DistributionPanel title="Tipo de cliente" description="Origen o segmento declarado en cada gestión." items={typeDistribution} icon={Tags} tone="blue" />
            <DistributionPanel title="Actividad" description="Situación laboral o fuente de ingresos informada." items={activityDistribution} icon={Activity} tone="slate" />
            <DistributionPanel title="Estado" description="Resultado operativo alcanzado en el período." items={stateDistribution} icon={ListChecks} tone="violet" />
            <DistributionPanel title="Score" description="Distribución por bandas de riesgo y cobertura." items={scoreDistribution} icon={Gauge} tone="amber" />
          </div>
        </>
      )}
    </div>
  );
}
