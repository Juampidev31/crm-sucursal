'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useGestionDiaria } from '@/features/gestion-diaria/GestionDiariaProvider';
import { useAnalistas } from '@/features/settings/SettingsProvider';
import { GestionDiaria, GESTION_DIARIA_OPCIONES } from '@/types';
import { formatDate, formatearCuil, sanitizarCuil } from '@/lib/utils';
import { normalizePersonName } from '@/lib/normalize-person-name';
import { NameNormalizationAction } from '@/components/NameNormalizationAction';
import { PremiumSelect } from '@/components/PremiumSelect';
import MultiSelect from '@/components/MultiSelect';
import { CorporateDatePicker } from '@/components/CorporateDatePicker';
import { CorporateDateRangePicker } from '@/components/CorporateDateRangePicker';
import CustomSelect from '@/components/CustomSelect';
import ModalPortal from '@/components/ModalPortal';
import { BarChart3, ClipboardList, Mail, Megaphone, MessageSquare, MoreHorizontal, Pencil, Plus, RefreshCw, Rows3, Search, SlidersHorizontal, TableProperties, Trash2, X } from 'lucide-react';
import {
  buildIncomeRows,
  databaseRowToIncomeRow,
  GESTION_SHEETS as SHEETS,
  GESTION_SHEET_TABS as SHEET_TABS,
  incomeRowIdentity,
  loadGoogleSheet,
  normalizeGestionValue as normalizeLookupValue,
  readPersistedSheetChanges,
  sheetChangesStorageKey,
  type GestionSheetAnalyst as SheetAnalyst,
  type IncomeSheetRow,
  type PersistedSheetChanges,
  type SheetTableData,
} from '@/lib/gestion-diaria-sheets';

type GestionTab = 'ingresos' | 'flyers' | 'emails';

interface MonthlySummaryItem {
  label: string;
  count: number;
  percentage: number;
  tone?: 'low' | 'medium' | 'high' | 'empty';
}

function monthKeyFromDate(value: string): string | null {
  const cleanValue = value.trim();
  const isoMatch = cleanValue.match(/^(\d{4})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}`;
  const localMatch = cleanValue.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
  if (!localMatch) return null;
  return `${localMatch[3]}-${localMatch[2].padStart(2, '0')}`;
}

function formatMonthKey(value: string): string {
  const [year, month] = value.split('-').map(Number);
  if (!year || !month) return value;
  const label = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function buildMonthlyDistribution(values: string[], total: number): MonthlySummaryItem[] {
  const grouped = new Map<string, { label: string; count: number }>();
  values.forEach(value => {
    const label = value.trim() || 'Sin datos';
    const key = normalizeLookupValue(label) || 'sin datos';
    const current = grouped.get(key);
    grouped.set(key, { label: current?.label ?? label, count: (current?.count ?? 0) + 1 });
  });
  return Array.from(grouped.values())
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, 'es'))
    .map(item => ({ ...item, percentage: total > 0 ? (item.count / total) * 100 : 0 }));
}

function compactMonthlyDistribution(items: MonthlySummaryItem[], limit = 5): MonthlySummaryItem[] {
  if (items.length <= limit + 1) return items;
  const visible = items.slice(0, limit);
  const remainder = items.slice(limit).reduce(
    (total, item) => ({ count: total.count + item.count, percentage: total.percentage + item.percentage }),
    { count: 0, percentage: 0 },
  );
  return [...visible, { label: 'Otros', ...remainder }];
}

function mergeFilterOptions(configured: readonly string[], values: string[]): string[] {
  const unique = new Map<string, string>();
  [...configured, ...values].forEach(value => {
    const cleanValue = value.trim();
    const key = normalizeLookupValue(cleanValue);
    if (key && !unique.has(key)) unique.set(key, cleanValue);
  });
  return Array.from(unique.values()).sort((left, right) => left.localeCompare(right, 'es'));
}

function scoreFromText(value: string): number | null {
  const normalized = value.replace(/[^\d,-]/g, '').replace(',', '.');
  if (!normalized) return null;
  const score = Number(normalized);
  return Number.isFinite(score) ? score : null;
}

interface CommercialEntry {
  id: string;
  createdAt: string;
  values: CommercialEntryForm;
}

interface CommercialEntriesState {
  entries: CommercialEntry[];
  sheetOverrides: Record<string, CommercialEntryForm>;
  deletedSheetRows: string[];
}

interface CommercialRow {
  values: string[];
  entryId?: string;
  sheetKey?: string;
}

interface CommercialEntryForm {
  fecha: string;
  turno: string;
  enMano: string;
  casasEdificios: string;
  autos: string;
  comerciosEntidades: string;
  bancosCajeros: string;
  nombre: string;
  email: string;
}

function commercialEntriesKey(analyst: string, tab: Exclude<GestionTab, 'ingresos'>): string {
  return `gestion_comercial_${normalizeLookupValue(analyst)}_${tab}`;
}

function commercialEntriesLocalKey(analyst: string, tab: Exclude<GestionTab, 'ingresos'>): string {
  return `gestion-comercial-entries:${normalizeLookupValue(analyst)}:${tab}`;
}

function readLocalCommercialEntries(analyst: string, tab: Exclude<GestionTab, 'ingresos'>): CommercialEntriesState {
  try {
    const raw = window.localStorage.getItem(commercialEntriesLocalKey(analyst, tab));
    if (!raw) return { entries: [], sheetOverrides: {}, deletedSheetRows: [] };
    const parsed = JSON.parse(raw) as Partial<CommercialEntriesState>;
    return {
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
      sheetOverrides: parsed.sheetOverrides && typeof parsed.sheetOverrides === 'object' ? parsed.sheetOverrides : {},
      deletedSheetRows: Array.isArray(parsed.deletedSheetRows) ? parsed.deletedSheetRows : [],
    };
  } catch {
    return { entries: [], sheetOverrides: {}, deletedSheetRows: [] };
  }
}

function createCommercialForm(): CommercialEntryForm {
  return {
    fecha: new Date().toISOString().slice(0, 10),
    turno: 'Mañana',
    enMano: '',
    casasEdificios: '',
    autos: '',
    comerciosEntidades: '',
    bancosCajeros: '',
    nombre: '',
    email: '',
  };
}

function commercialEntryRow(entry: CommercialEntry, columns: string[], tab: Exclude<GestionTab, 'ingresos'>): string[] {
  const numericValue = (key: keyof CommercialEntryForm) => Number(entry.values[key] || 0);
  const total = tab === 'flyers'
    ? numericValue('enMano') + numericValue('casasEdificios') + numericValue('autos') + numericValue('comerciosEntidades') + numericValue('bancosCajeros')
    : 0;

  return columns.map(column => {
    const normalized = normalizeLookupValue(column);
    if (normalized === 'fecha' || normalized === 'fechagestion') return entry.values.fecha || '';
    if (normalized === 'turno') return entry.values.turno || '';
    if (normalized === 'enmano') return entry.values.enMano || '0';
    if (normalized === 'casasedificios') return entry.values.casasEdificios || '0';
    if (normalized === 'autos') return entry.values.autos || '0';
    if (normalized === 'comerciosentidades') return entry.values.comerciosEntidades || '0';
    if (normalized === 'bancoscajeros') return entry.values.bancosCajeros || '0';
    if (normalized === 'totaldelturno' || normalized === 'totalturno' || normalized === 'totaldia') return String(total);
    if (normalized === 'apellidoynombre' || normalized === 'nombre') return entry.values.nombre || '';
    if (normalized === 'email' || normalized === 'correo') return entry.values.email || '';
    return '';
  });
}

function commercialSheetRowKey(values: string[]): string {
  return values.map(value => normalizeLookupValue(value)).join('|');
}

function commercialRowToForm(values: string[], columns: string[]): CommercialEntryForm {
  const form = createCommercialForm();
  columns.forEach((column, index) => {
    const value = values[index] ?? '';
    const normalized = normalizeLookupValue(column);
    if (normalized === 'fecha' || normalized === 'fechagestion') form.fecha = value;
    else if (normalized === 'turno') form.turno = value || 'Mañana';
    else if (normalized === 'enmano') form.enMano = value;
    else if (normalized === 'casasedificios') form.casasEdificios = value;
    else if (normalized === 'autos') form.autos = value;
    else if (normalized === 'comerciosentidades') form.comerciosEntidades = value;
    else if (normalized === 'bancoscajeros') form.bancosCajeros = value;
    else if (normalized === 'apellidoynombre' || normalized === 'nombre') form.nombre = value;
    else if (normalized === 'email' || normalized === 'correo') form.email = value;
  });
  return form;
}

function commercialColumnClass(column: string, columnIndex: number): string {
  const normalized = normalizeLookupValue(column);
  const numericColumns = new Set([
    'fecha', 'fechagestion', 'enmano', 'casasedificios', 'autos',
    'comerciosentidades', 'bancoscajeros', 'totaldelturno', 'totalturno',
    'totaldia', 'score',
  ]);
  return [
    columnIndex === 0 ? 'daily-sheet-primary-cell' : '',
    numericColumns.has(normalized) ? 'daily-sheet-number-cell' : 'daily-sheet-text-cell',
    normalized === 'score' ? 'daily-score-cell' : '',
  ].filter(Boolean).join(' ');
}

function DailyScore({ value }: { value: string }) {
  const normalized = value.replace(/[^\d,-]/g, '').replace(',', '.');
  if (!normalized) return <span className="daily-numeric daily-numeric--empty">—</span>;

  const score = Number(normalized);
  if (!Number.isFinite(score)) return <span className="daily-numeric">{value}</span>;

  const tone = score > 700 ? 'alta' : score >= 550 ? 'media' : 'baja';
  return (
    <span className="daily-score">
      <span className={`daily-score-dot is-${tone}`} aria-hidden="true" />
      <strong>{value}</strong>
    </span>
  );
}

function DailyLoadingState({ kind, label }: { kind: GestionTab; label: string }) {
  const Icon = kind === 'emails' ? Mail : kind === 'flyers' ? Megaphone : TableProperties;

  return (
    <div className={`daily-loading daily-loading--${kind}`} role="status" aria-live="polite">
      <div className="daily-loading__content">
        <div className="daily-loading__visual" aria-hidden="true">
          <span className="daily-loading__orbit daily-loading__orbit--outer" />
          <span className="daily-loading__orbit daily-loading__orbit--inner" />
          <span className="daily-loading__icon"><Icon size={22} strokeWidth={1.8} /></span>
          <span className="daily-loading__spark daily-loading__spark--one" />
          <span className="daily-loading__spark daily-loading__spark--two" />
          <span className="daily-loading__spark daily-loading__spark--three" />
        </div>
        <div className="daily-loading__copy">
          <strong>Preparando {label.toLowerCase()}</strong>
          <span>Sincronizando la información más reciente</span>
        </div>
        <div className="daily-loading__progress" aria-hidden="true"><span /></div>
      </div>
      <div className="daily-loading__preview" aria-hidden="true">
        {[0, 1, 2].map(row => (
          <div className="daily-loading__row" key={row}>
            <span /><span /><span /><span />
          </div>
        ))}
      </div>
      <span className="sr-only">Cargando {label.toLowerCase()}.</span>
    </div>
  );
}

const DAILY_PAGE_SIZES = [25, 50, 100, 200] as const;

function DailyPagination({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  itemLabel = 'registros',
}: {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  itemLabel?: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rangeStart = total === 0 ? 0 : ((page - 1) * pageSize) + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  const changePage = (nextPage: number) => {
    onPageChange(Math.min(totalPages, Math.max(1, nextPage)));
  };

  const cyclePageSize = () => {
    const currentIndex = DAILY_PAGE_SIZES.findIndex(size => size === pageSize);
    const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % DAILY_PAGE_SIZES.length;
    onPageSizeChange(DAILY_PAGE_SIZES[nextIndex]);
  };

  return (
    <div className="records-pagination daily-pagination" aria-label={`Paginación de ${itemLabel}`}>
      <div className="daily-pagination__meta">
        <span className="records-pagination__text">
          Mostrando {rangeStart}–{rangeEnd} de {total} {itemLabel}
        </span>
        <button
          type="button"
          className="daily-page-size"
          onClick={cyclePageSize}
          title="Cambiar cantidad de filas por página"
          aria-label={`Mostrar ${pageSize} filas por página. Cambiar cantidad`}
        >
          <Rows3 size={14} /> {pageSize}
        </button>
      </div>
      <div className="records-pagination__controls">
        <button type="button" className="btn-pagination" onClick={() => changePage(1)} disabled={page === 1}>Primera</button>
        <button type="button" className="btn-pagination" onClick={() => changePage(page - 1)} disabled={page === 1}>← Anterior</button>
        <div className="records-pagination__page">
          Página
          <input
            className="pagination-input"
            type="number"
            min={1}
            max={totalPages}
            value={page}
            onChange={event => changePage(Number(event.target.value) || 1)}
            aria-label="Página actual"
          />
          de {totalPages}
        </div>
        <button type="button" className="btn-pagination" onClick={() => changePage(page + 1)} disabled={page === totalPages}>Siguiente →</button>
        <button type="button" className="btn-pagination" onClick={() => changePage(totalPages)} disabled={page === totalPages}>Última</button>
      </div>
    </div>
  );
}

function incomeRowToForm(row: IncomeSheetRow): Partial<GestionDiaria> {
  return {
    tipo_cliente: row.tipoCliente,
    fecha: row.fecha,
    nombre: row.nombre,
    cuil: row.cuil,
    actividad: row.actividad,
    donde_nos_conocio: '',
    estado: row.estado,
    score: scoreFromText(row.score),
    tipo_operacion: row.tipoOperacion,
    comentarios: row.comentarios,
  };
}

const initialForm: Partial<GestionDiaria> = {
  tipo_cliente: '', fecha: '', nombre: '', cuil: '', actividad: '',
  donde_nos_conocio: '', estado: '', score: undefined, tipo_operacion: '',
  comentarios: '',
};

function CompactDailyActions({
  label,
  onEdit,
  onDelete,
  onComments,
}: {
  label: string;
  onEdit: () => void;
  onDelete: () => void;
  onComments?: () => void;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!menuPosition) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) setMenuPosition(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuPosition(null);
    };
    const closeOnViewportChange = () => setMenuPosition(null);

    document.addEventListener('pointerdown', closeOnOutsideClick);
    window.addEventListener('keydown', closeOnEscape);
    window.addEventListener('resize', closeOnViewportChange);
    window.addEventListener('scroll', closeOnViewportChange, true);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      window.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('resize', closeOnViewportChange);
      window.removeEventListener('scroll', closeOnViewportChange, true);
    };
  }, [menuPosition]);

  const toggleMenu = () => {
    if (menuPosition) {
      setMenuPosition(null);
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const menuWidth = 190;
    const menuHeight = (onComments ? 2 : 1) * 36 + 10;
    const gap = 6;
    const left = Math.min(Math.max(8, rect.right - menuWidth), window.innerWidth - menuWidth - 8);
    const top = rect.bottom + menuHeight + gap <= window.innerHeight
      ? rect.bottom + gap
      : Math.max(8, rect.top - menuHeight - gap);
    setMenuPosition({ top, left });
  };

  return (
    <div className="daily-row-actions">
      <button type="button" className="daily-action-edit" onClick={onEdit} aria-label={`Editar ${label}`}>
        <Pencil size={14} /><span>Editar</span>
      </button>
      <button
        ref={triggerRef}
        type="button"
        className={`daily-action-more${menuPosition ? ' is-active' : ''}`}
        onClick={toggleMenu}
        aria-label={`Más acciones para ${label}`}
        aria-haspopup="menu"
        aria-expanded={!!menuPosition}
      >
        <MoreHorizontal size={18} />
      </button>
      {menuPosition && (
        <ModalPortal>
          <div
            ref={menuRef}
            className="daily-action-menu"
            role="menu"
            aria-label={`Acciones para ${label}`}
            style={{ top: menuPosition.top, left: menuPosition.left }}
          >
            {onComments && (
              <button type="button" role="menuitem" onClick={() => { setMenuPosition(null); onComments(); }}>
                <MessageSquare size={15} /><span>Comentarios</span>
              </button>
            )}
            <button type="button" role="menuitem" className="is-danger" onClick={() => { setMenuPosition(null); onDelete(); }}>
              <Trash2 size={15} /><span>Eliminar registro</span>
            </button>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}

export default function GestionDiariaClient({ analistaInicial }: { analistaInicial: string }) {
  const { isAdmin } = useAuth();
  const { registros, applyChange, pushChange, pushBulkRefresh } = useGestionDiaria();
  const { nombres: analistaNombres } = useAnalistas();
  const [analista, setAnalista] = useState(analistaInicial);
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [tiposCliente, setTiposCliente] = useState<string[]>([]);
  const [actividades, setActividades] = useState<string[]>([]);
  const [estados, setEstados] = useState<string[]>([]);
  const [scoreMinimo, setScoreMinimo] = useState('');
  const [scoreMaximo, setScoreMaximo] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryMonth, setSummaryMonth] = useState('');
  const [form, setForm] = useState<Partial<GestionDiaria>>(initialForm);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<GestionTab>('ingresos');
  const [incomePage, setIncomePage] = useState(1);
  const [incomePageSize, setIncomePageSize] = useState(50);
  const selectedAnalista = analista || analistaNombres[0] || '';
  const [incomeRows, setIncomeRows] = useState<IncomeSheetRow[]>([]);
  const [incomeLoading, setIncomeLoading] = useState(true);
  const [incomeError, setIncomeError] = useState('');
  const [sheetOverrides, setSheetOverrides] = useState<Record<string, IncomeSheetRow>>(() => readPersistedSheetChanges(analistaInicial).overrides);
  const [deletedSheetIds, setDeletedSheetIds] = useState<string[]>(() => readPersistedSheetChanges(analistaInicial).deletedIds);
  const [editingSheetTarget, setEditingSheetTarget] = useState<IncomeSheetRow | null>(null);
  const [commentsTarget, setCommentsTarget] = useState<IncomeSheetRow | null>(null);
  const [commentsDraft, setCommentsDraft] = useState('');
  const [commentsSaving, setCommentsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<IncomeSheetRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent('crm:page-zoom-scope', {
        detail: {
          pathname: '/gestion-diaria',
          scope: `analista:${selectedAnalista || 'sin-analista'}:hoja:${activeTab}`,
        },
      }));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeTab, selectedAnalista]);

  useEffect(() => {
    let active = true;
    const sheetId = SHEETS[selectedAnalista as SheetAnalyst];
    if (!sheetId) return () => { active = false; };
    loadGoogleSheet(sheetId, SHEET_TABS.ingresos.gid)
      .then(data => { if (active) setIncomeRows(buildIncomeRows(data)); })
      .catch(reason => {
        if (!active) return;
        setIncomeRows([]);
        setIncomeError(reason instanceof Error ? reason.message : 'No se pudo cargar la hoja.');
      })
      .finally(() => { if (active) setIncomeLoading(false); });
    return () => { active = false; };
  }, [selectedAnalista]);

  const persistSheetChanges = (overrides: Record<string, IncomeSheetRow>, deletedIds: string[]) => {
    window.localStorage.setItem(sheetChangesStorageKey(selectedAnalista), JSON.stringify({ overrides, deletedIds } satisfies PersistedSheetChanges));
  };

  const visibleIncomeRows = useMemo(() => {
    const effectiveSheetRows = incomeRows
      .filter(row => !deletedSheetIds.includes(row.id))
      .map(row => sheetOverrides[row.id] ?? row);
    const sheetIdentities = new Set(effectiveSheetRows.map(incomeRowIdentity));
    const analystRows = registros.filter(row => row.analista === selectedAnalista);
    const createdAtCounts = new Map<string, number>();

    analystRows.forEach(row => {
      if (!row.created_at) return;
      createdAtCounts.set(row.created_at, (createdAtCounts.get(row.created_at) ?? 0) + 1);
    });

    const applicationRows = analystRows
      .filter(row => !row.created_at || (createdAtCounts.get(row.created_at) ?? 0) < 10)
      .map(databaseRowToIncomeRow)
      .filter(row => !sheetIdentities.has(incomeRowIdentity(row)));

    return [...applicationRows, ...effectiveSheetRows].sort((left, right) => right.fecha.localeCompare(left.fecha));
  }, [deletedSheetIds, incomeRows, registros, selectedAnalista, sheetOverrides]);

  const filtrados = useMemo(() => {
    return visibleIncomeRows.filter(r => {
      if (fechaDesde && (!r.fecha || r.fecha < fechaDesde)) return false;
      if (fechaHasta && (!r.fecha || r.fecha > fechaHasta)) return false;
      if (tiposCliente.length > 0 && !tiposCliente.includes(r.tipoCliente)) return false;
      if (actividades.length > 0 && !actividades.includes(r.actividad)) return false;
      if (estados.length > 0 && !estados.includes(r.estado)) return false;
      if (scoreMinimo || scoreMaximo) {
        const score = scoreFromText(r.score);
        if (score === null) return false;
        if (scoreMinimo && score < Number(scoreMinimo)) return false;
        if (scoreMaximo && score > Number(scoreMaximo)) return false;
      }
      if (busqueda) {
        const q = busqueda.toLowerCase();
        if (!r.nombre.toLowerCase().includes(q) && !r.cuil.includes(q)) return false;
      }
      return true;
    });
  }, [visibleIncomeRows, fechaDesde, fechaHasta, tiposCliente, actividades, estados, scoreMinimo, scoreMaximo, busqueda]);

  const incomeTotalPages = Math.max(1, Math.ceil(filtrados.length / incomePageSize));
  const safeIncomePage = Math.min(incomePage, incomeTotalPages);
  const paginatedIncomeRows = useMemo(() => {
    const start = (safeIncomePage - 1) * incomePageSize;
    return filtrados.slice(start, start + incomePageSize);
  }, [filtrados, incomePageSize, safeIncomePage]);

  const tipoClienteOptions = useMemo(
    () => mergeFilterOptions(GESTION_DIARIA_OPCIONES.tipoCliente, visibleIncomeRows.map(row => row.tipoCliente)),
    [visibleIncomeRows],
  );
  const actividadOptions = useMemo(
    () => mergeFilterOptions(GESTION_DIARIA_OPCIONES.actividad, visibleIncomeRows.map(row => row.actividad)),
    [visibleIncomeRows],
  );
  const estadoOptions = useMemo(
    () => mergeFilterOptions(GESTION_DIARIA_OPCIONES.estado, visibleIncomeRows.map(row => row.estado)),
    [visibleIncomeRows],
  );
  const summaryMonths = useMemo(() => Array.from(new Set(
    visibleIncomeRows.map(row => monthKeyFromDate(row.fecha)).filter((value): value is string => Boolean(value)),
  )).sort((left, right) => right.localeCompare(left)), [visibleIncomeRows]);
  const monthlySummaryRows = useMemo(
    () => visibleIncomeRows.filter(row => monthKeyFromDate(row.fecha) === summaryMonth),
    [summaryMonth, visibleIncomeRows],
  );
  const monthlySummary = useMemo(() => {
    const total = monthlySummaryRows.length;
    const scores = new Map<string, MonthlySummaryItem>([
      ['high', { label: 'Premium · 701 o más', count: 0, percentage: 0, tone: 'high' }],
      ['medium', { label: 'Riesgo medio · 550 a 700', count: 0, percentage: 0, tone: 'medium' }],
      ['low', { label: 'Score bajo · hasta 549', count: 0, percentage: 0, tone: 'low' }],
      ['empty', { label: 'Sin datos', count: 0, percentage: 0, tone: 'empty' }],
    ]);
    monthlySummaryRows.forEach(row => {
      const score = scoreFromText(row.score);
      const key = score === null ? 'empty' : score > 700 ? 'high' : score >= 550 ? 'medium' : 'low';
      const item = scores.get(key)!;
      item.count += 1;
    });
    const scoreItems = Array.from(scores.values())
      .filter(item => item.count > 0)
      .map(item => ({ ...item, percentage: total > 0 ? (item.count / total) * 100 : 0 }));
    return {
      total,
      tipoCliente: buildMonthlyDistribution(monthlySummaryRows.map(row => row.tipoCliente), total),
      actividad: buildMonthlyDistribution(monthlySummaryRows.map(row => row.actividad), total),
      estado: buildMonthlyDistribution(monthlySummaryRows.map(row => row.estado), total),
      score: scoreItems,
    };
  }, [monthlySummaryRows]);
  const hasActiveFilters = Boolean(
    busqueda || fechaDesde || fechaHasta || tiposCliente.length || actividades.length || estados.length || scoreMinimo || scoreMaximo,
  );
  const advancedFilterCount = [tiposCliente.length, actividades.length, estados.length, scoreMinimo || scoreMaximo].filter(Boolean).length;

  const clearIncomeFilters = () => {
    setBusqueda('');
    setFechaDesde('');
    setFechaHasta('');
    setTiposCliente([]);
    setActividades([]);
    setEstados([]);
    setScoreMinimo('');
    setScoreMaximo('');
    setIncomePage(1);
    setFiltersExpanded(false);
  };

  const abrirResumenMensual = () => {
    setSummaryMonth(current => current && summaryMonths.includes(current) ? current : (summaryMonths[0] ?? ''));
    setSummaryOpen(true);
  };

  const cambiarAnalista = (value: string) => {
    const persisted = readPersistedSheetChanges(value);
    setIncomeRows([]);
    setIncomeError('');
    setIncomeLoading(true);
    setSheetOverrides(persisted.overrides);
    setDeletedSheetIds(persisted.deletedIds);
    setIncomePage(1);
    setAnalista(value);
  };

  const abrirNuevo = () => {
    setActionError('');
    setEditingSheetTarget(null);
    setForm({ ...initialForm, fecha: new Date().toISOString().slice(0, 10) });
    setModalOpen(true);
  };

  const findDatabaseRow = (row: IncomeSheetRow) => (
    row.databaseId ? registros.find(registro => registro.id === row.databaseId) ?? null : null
  );

  const abrirEdicion = (row: IncomeSheetRow) => {
    const registro = findDatabaseRow(row);
    setActionError('');
    setEditingSheetTarget(registro ? null : row);
    setForm(registro ? { ...registro } : incomeRowToForm(row));
    setModalOpen(true);
  };

  const abrirComentarios = (row: IncomeSheetRow) => {
    const registro = findDatabaseRow(row);
    setActionError('');
    setCommentsTarget(row);
    setCommentsDraft(registro?.comentarios ?? row.comentarios);
  };

  const abrirEliminar = (row: IncomeSheetRow) => {
    setActionError('');
    setDeleteTarget(row);
  };

  const guardar = async () => {
    const faltantes = [
      !form.tipo_cliente && 'Tipo de cliente',
      !form.fecha && 'Fecha',
      !form.nombre?.trim() && 'Apellido y nombre',
      !form.cuil?.trim() && 'CUIL',
    ].filter(Boolean) as string[];
    if (faltantes.length > 0) {
      setActionError(`Completá los campos obligatorios: ${faltantes.join(', ')}.`);
      return;
    }
    setActionError('');
    setSaving(true);
    if (editingSheetTarget) {
      const updated: IncomeSheetRow = {
        ...editingSheetTarget,
        tipoCliente: form.tipo_cliente ?? '',
        fecha: form.fecha ?? '',
        nombre: form.nombre ?? '',
        cuil: form.cuil ?? '',
        actividad: form.actividad ?? '',
        estado: form.estado ?? '',
        score: form.score == null ? '' : String(form.score),
        tipoOperacion: form.tipo_operacion ?? '',
        comentarios: form.comentarios ?? '',
      };
      const overrides = { ...sheetOverrides, [editingSheetTarget.id]: updated };
      setSheetOverrides(overrides);
      persistSheetChanges(overrides, deletedSheetIds);
      setEditingSheetTarget(null);
      setSaving(false);
      setModalOpen(false);
      return;
    }
    const payload = { ...form, analista: selectedAnalista };
    if (form.id) {
      const { data, error } = await supabase.from('gestion_diaria').update(payload).eq('id', form.id).select().single();
      setSaving(false);
      if (error) { setActionError('No se pudo actualizar el registro.'); return; }
      applyChange('UPDATE', data as GestionDiaria);
      pushChange('UPDATE', data as GestionDiaria);
    } else {
      const insertPayload = { ...payload };
      delete insertPayload.id;
      const { data, error } = await supabase.from('gestion_diaria').insert(insertPayload).select().single();
      setSaving(false);
      if (error) { setActionError('No se pudo guardar el registro.'); return; }
      applyChange('INSERT', data as GestionDiaria);
      pushChange('INSERT', data as GestionDiaria);
    }
    setModalOpen(false);
  };

  const guardarComentarios = async () => {
    if (!commentsTarget) return;
    setActionError('');
    setCommentsSaving(true);
    if (!commentsTarget.databaseId) {
      const updated = { ...commentsTarget, comentarios: commentsDraft };
      const overrides = { ...sheetOverrides, [commentsTarget.id]: updated };
      setSheetOverrides(overrides);
      persistSheetChanges(overrides, deletedSheetIds);
      setCommentsSaving(false);
      setCommentsTarget(null);
      return;
    }
    const { data, error } = await supabase
      .from('gestion_diaria')
      .update({ comentarios: commentsDraft })
      .eq('id', commentsTarget.databaseId)
      .select()
      .single();
    setCommentsSaving(false);
    if (error) { setActionError('No se pudieron guardar los comentarios.'); return; }
    applyChange('UPDATE', data as GestionDiaria);
    pushChange('UPDATE', data as GestionDiaria);
    setCommentsTarget(null);
  };

  const eliminarRegistro = async () => {
    if (!deleteTarget) return;
    setActionError('');
    setDeleting(true);
    if (!deleteTarget.databaseId) {
      const deletedIds = Array.from(new Set([...deletedSheetIds, deleteTarget.id]));
      setDeletedSheetIds(deletedIds);
      persistSheetChanges(sheetOverrides, deletedIds);
      setDeleting(false);
      setDeleteTarget(null);
      return;
    }
    const registro = findDatabaseRow(deleteTarget);
    if (!registro) { setDeleting(false); setActionError('No se encontró el registro.'); return; }
    const { error } = await supabase.from('gestion_diaria').delete().eq('id', deleteTarget.databaseId);
    setDeleting(false);
    if (error) { setActionError('No se pudo eliminar el registro.'); return; }
    applyChange('DELETE', registro);
    pushChange('DELETE', registro);
    setDeleteTarget(null);
  };

  return (
    <div className="daily-management-page">
      <section className="daily-management-card">
      <div className="daily-management-header">
        <div className="daily-management-title">
          <span className="daily-management-title__icon"><ClipboardList size={18} /></span>
          <div><h2>Gestión diaria</h2><p>Seguimiento operativo y rendimiento comercial</p></div>
        </div>
        <div className="daily-management-analyst">
          <span>Analista</span>
          <PremiumSelect value={selectedAnalista} onChange={cambiarAnalista} options={analistaNombres} placeholder="Analista" />
        </div>
      </div>

      <div className="daily-tabs" role="tablist" aria-label="Secciones de gestión diaria">
        <button type="button" role="tab" aria-selected={activeTab === 'ingresos'} className={`daily-tab ${activeTab === 'ingresos' ? 'is-active' : ''}`} onClick={() => setActiveTab('ingresos')}>
          <TableProperties size={15} /> Ingreso diario ventas
        </button>
        <button type="button" role="tab" aria-selected={activeTab === 'flyers'} className={`daily-tab ${activeTab === 'flyers' ? 'is-active' : ''}`} onClick={() => setActiveTab('flyers')}>
          <Megaphone size={15} /> Flyers
        </button>
        <button type="button" role="tab" aria-selected={activeTab === 'emails'} className={`daily-tab ${activeTab === 'emails' ? 'is-active' : ''}`} onClick={() => setActiveTab('emails')}>
          <Mail size={15} /> Emails enviados
        </button>
      </div>

      {activeTab === 'ingresos' ? <>
      <div className="daily-toolbar">
        <div className="daily-toolbar-primary">
          <div className="daily-search">
            <Search className="daily-search__icon" size={14} />
            <input value={busqueda} onChange={e => { setBusqueda(e.target.value); setIncomePage(1); }} placeholder="Buscar cliente o CUIL..." className="form-input" />
          </div>
          <CorporateDateRangePicker
            fromValue={fechaDesde}
            toValue={fechaHasta}
            onChange={({ from, to }) => {
              setFechaDesde(from);
              setFechaHasta(to);
              setIncomePage(1);
            }}
            compact
          />
          <button
            type="button"
            className={`daily-filter-toggle${filtersExpanded ? ' is-open' : ''}${advancedFilterCount ? ' has-filters' : ''}`}
            onClick={() => setFiltersExpanded(current => !current)}
            aria-expanded={filtersExpanded}
            aria-controls="daily-advanced-filters"
          >
            <SlidersHorizontal size={14} />
            Filtros
            {advancedFilterCount > 0 && <span>{advancedFilterCount}</span>}
          </button>
          {hasActiveFilters && (
            <button
              type="button"
              className="daily-clear-filters daily-clear-filters--compact"
              onClick={clearIncomeFilters}
              title="Limpiar todos los filtros"
            >
              <X size={13} /> Limpiar
            </button>
          )}
          <NameNormalizationAction
            isAdmin={isAdmin}
            table="gestion_diaria"
            rows={registros.filter(row => row.analista === selectedAnalista)}
            scopeLabel={`Gestión diaria · ${selectedAnalista}`}
            onApplied={(changed) => {
              changed.forEach(row => applyChange('UPDATE', row));
              pushBulkRefresh();
            }}
          />
          <button type="button" className="daily-summary-button" onClick={abrirResumenMensual} disabled={incomeLoading || summaryMonths.length === 0}>
            <BarChart3 size={15} /> Resumen mensual
          </button>
          <button onClick={abrirNuevo} className="btn-primary daily-add-button">
            <Plus size={16} /> Agregar registro
          </button>
        </div>
        {filtersExpanded && <div className="daily-filter-bar" id="daily-advanced-filters">
          <div className="daily-filter-control">
            <span>Tipo de cliente</span>
            <MultiSelect values={tiposCliente} onChange={values => { setTiposCliente(values); setIncomePage(1); }} options={tipoClienteOptions} placeholder="Todos" clearLabel="Todos" searchable />
          </div>
          <div className="daily-filter-control">
            <span>Actividad</span>
            <MultiSelect values={actividades} onChange={values => { setActividades(values); setIncomePage(1); }} options={actividadOptions} placeholder="Todas" clearLabel="Todas" searchable />
          </div>
          <div className="daily-filter-control">
            <span>Estado</span>
            <MultiSelect values={estados} onChange={values => { setEstados(values); setIncomePage(1); }} options={estadoOptions} placeholder="Todos" clearLabel="Todos" />
          </div>
          <div className="daily-filter-control daily-score-control">
            <span>Score</span>
            <div className="daily-score-filter" aria-label="Filtrar por score">
              <input
                type="number"
                min="0"
                max="999"
                inputMode="numeric"
                value={scoreMinimo}
                onChange={event => { setScoreMinimo(event.target.value); setIncomePage(1); }}
                placeholder="Mínimo"
                aria-label="Score mínimo"
              />
              <span aria-hidden="true">—</span>
              <input
                type="number"
                min="0"
                max="999"
                inputMode="numeric"
                value={scoreMaximo}
                onChange={event => { setScoreMaximo(event.target.value); setIncomePage(1); }}
                placeholder="Máximo"
                aria-label="Score máximo"
              />
            </div>
          </div>
        </div>}
      </div>

      {incomeLoading ? <DailyLoadingState kind="ingresos" label="Ingreso diario de ventas" /> : incomeError ? (
        <div className="daily-sheet-state is-error"><strong>No pudimos cargar la hoja.</strong><span>{incomeError}</span></div>
      ) : (
        <div className="daily-table-shell">
          <div className="daily-table-wrap">
            <table className="daily-table">
            <thead>
              <tr>
                <th>Tipo cliente</th>
                <th>Fecha</th>
                <th>Cliente | CUIL</th>
                <th>Actividad</th>
                <th>Estado</th>
                <th>Score</th>
                <th>Comentarios</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {paginatedIncomeRows.map(r => (
                <tr key={r.id}>
                  <td>{r.tipoCliente}</td>
                  <td className="daily-numeric">{r.fecha ? formatDate(r.fecha) : <span className="daily-date-missing">Sin fecha</span>}</td>
                  <td className="daily-client-cell">
                    <div className="records-client">
                      <div className="records-client__identity">
                        <span className="records-client__name">{r.databaseId ? r.nombre : normalizePersonName(r.nombre)}</span>
                        {r.cuil && (
                          <>
                            <span className="records-client__separator">|</span>
                            <span className="cuil-text">{formatearCuil(r.cuil)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>{r.actividad}</td>
                  <td className="daily-state-cell"><span className="status-badge table-calif-badge daily-state-badge">{r.estado}</span></td>
                  <td className="daily-score-cell"><DailyScore value={r.score} /></td>
                  <td>{r.comentarios}</td>
                  <td>
                    <CompactDailyActions
                      label={r.nombre}
                      onEdit={() => abrirEdicion(r)}
                      onComments={() => abrirComentarios(r)}
                      onDelete={() => abrirEliminar(r)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
            {filtrados.length === 0 && (
              <p className="daily-empty-state">Sin registros para los filtros actuales.</p>
            )}
          </div>
          <DailyPagination
            total={filtrados.length}
            page={safeIncomePage}
            pageSize={incomePageSize}
            onPageChange={setIncomePage}
            onPageSizeChange={value => { setIncomePageSize(value); setIncomePage(1); }}
          />
        </div>
      )}
      </> : (
        <SheetTabTable key={`${selectedAnalista}-${activeTab}`} analyst={selectedAnalista} tab={activeTab} />
      )}

      {modalOpen && (
        <GestionDiariaModal
          form={form}
          setForm={setForm}
          onCancel={() => setModalOpen(false)}
          onSave={guardar}
          saving={saving}
          error={actionError}
        />
      )}
      {summaryOpen && (
        <MonthlySummaryModal
          analyst={selectedAnalista}
          month={summaryMonth}
          months={summaryMonths}
          summary={monthlySummary}
          onMonthChange={setSummaryMonth}
          onCancel={() => setSummaryOpen(false)}
        />
      )}
      {commentsTarget && (
        <DailyCommentsModal
          registro={commentsTarget}
          value={commentsDraft}
          onChange={setCommentsDraft}
          onCancel={() => { setCommentsTarget(null); setActionError(''); }}
          onSave={guardarComentarios}
          saving={commentsSaving}
          error={actionError}
        />
      )}
      {deleteTarget && (
        <DailyDeleteModal
          label={deleteTarget.nombre}
          onCancel={() => { setDeleteTarget(null); setActionError(''); }}
          onConfirm={eliminarRegistro}
          deleting={deleting}
          error={actionError}
        />
      )}
      </section>
    </div>
  );
}

function SheetTabTable({ analyst, tab }: { analyst: string; tab: Exclude<GestionTab, 'ingresos'> }) {
  const [data, setData] = useState<SheetTableData | null>(null);
  const [entries, setEntries] = useState<CommercialEntry[]>([]);
  const [sheetOverrides, setSheetOverrides] = useState<Record<string, CommercialEntryForm>>({});
  const [deletedSheetRows, setDeletedSheetRows] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [entryModalOpen, setEntryModalOpen] = useState(false);
  const [entryForm, setEntryForm] = useState<CommercialEntryForm>(createCommercialForm);
  const [entrySaving, setEntrySaving] = useState(false);
  const [entryError, setEntryError] = useState('');
  const [editingTarget, setEditingTarget] = useState<{ kind: 'entry'; id: string } | { kind: 'sheet'; key: string } | null>(null);
  const [deleteRowTarget, setDeleteRowTarget] = useState<CommercialRow | null>(null);
  const [rowDeleting, setRowDeleting] = useState(false);
  const sheetId = SHEETS[analyst as SheetAnalyst];
  const config = SHEET_TABS[tab];

  useEffect(() => {
    let active = true;
    if (!sheetId) return () => { active = false; };
    loadGoogleSheet(sheetId, config.gid)
      .then(result => { if (active) setData(result); })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'No se pudo cargar la hoja.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [analyst, config.gid, reloadKey, sheetId]);

  useEffect(() => {
    let active = true;
    supabase
      .from('configuracion')
      .select('valor_json')
      .eq('clave', commercialEntriesKey(analyst, tab))
      .maybeSingle()
      .then(({ data: stored, error: storageError }) => {
        if (!active) return;
        const payload = stored?.valor_json as Partial<CommercialEntriesState> | null;
        if (!storageError && Array.isArray(payload?.entries)) {
          setEntries(payload.entries);
          setSheetOverrides(payload.sheetOverrides && typeof payload.sheetOverrides === 'object' ? payload.sheetOverrides : {});
          setDeletedSheetRows(Array.isArray(payload.deletedSheetRows) ? payload.deletedSheetRows : []);
          window.localStorage.setItem(commercialEntriesLocalKey(analyst, tab), JSON.stringify({
            entries: payload.entries,
            sheetOverrides: payload.sheetOverrides ?? {},
            deletedSheetRows: payload.deletedSheetRows ?? [],
          }));
          return;
        }
        const localState = readLocalCommercialEntries(analyst, tab);
        setEntries(localState.entries);
        setSheetOverrides(localState.sheetOverrides);
        setDeletedSheetRows(localState.deletedSheetRows);
      });
    return () => { active = false; };
  }, [analyst, tab]);

  const reload = () => {
    setLoading(true);
    setError('');
    setReloadKey(key => key + 1);
  };

  const visibleRows = useMemo(() => {
    if (!data) return [] as CommercialRow[];
    const sheetRowOccurrences = new Map<string, number>();
    const rows: CommercialRow[] = [
      ...entries.map(entry => ({ values: commercialEntryRow(entry, data.columns, tab), entryId: entry.id })),
      ...data.rows.flatMap(values => {
        const baseKey = commercialSheetRowKey(values);
        const occurrence = sheetRowOccurrences.get(baseKey) ?? 0;
        sheetRowOccurrences.set(baseKey, occurrence + 1);
        const sheetKey = `${baseKey}::${occurrence}`;
        if (deletedSheetRows.includes(sheetKey)) return [];
        const override = sheetOverrides[sheetKey];
        const displayedValues = override
          ? commercialEntryRow({ id: sheetKey, createdAt: '', values: override }, data.columns, tab)
          : values;
        return [{ values: displayedValues, sheetKey }];
      }),
    ];
    const normalized = query.trim().toLocaleLowerCase('es');
    if (!normalized) return rows;
    return rows.filter(row => row.values.some(cell => cell.toLocaleLowerCase('es').includes(normalized)));
  }, [data, deletedSheetRows, entries, query, sheetOverrides, tab]);

  const totalPages = Math.max(1, Math.ceil(visibleRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return visibleRows.slice(start, start + pageSize);
  }, [pageSize, safePage, visibleRows]);

  const persistEntries = async (
    nextEntries: CommercialEntry[],
    nextOverrides = sheetOverrides,
    nextDeletedSheetRows = deletedSheetRows,
  ) => {
    const payload: CommercialEntriesState = {
      entries: nextEntries,
      sheetOverrides: nextOverrides,
      deletedSheetRows: nextDeletedSheetRows,
    };
    const { error: persistError } = await supabase
      .from('configuracion')
      .upsert({ clave: commercialEntriesKey(analyst, tab), valor_json: payload }, { onConflict: 'clave' });
    if (persistError) throw new Error(persistError.message);
    window.localStorage.setItem(commercialEntriesLocalKey(analyst, tab), JSON.stringify(payload));
    setEntries(nextEntries);
    setSheetOverrides(nextOverrides);
    setDeletedSheetRows(nextDeletedSheetRows);
  };

  const saveEntry = async () => {
    setEntryError('');
    if (!entryForm.fecha) {
      setEntryError('Ingresá una fecha.');
      return;
    }
    if (tab === 'emails' && (!entryForm.nombre.trim() || !/^\S+@\S+\.\S+$/.test(entryForm.email.trim()))) {
      setEntryError('Ingresá nombre y un email válido.');
      return;
    }
    setEntrySaving(true);
    try {
      if (editingTarget?.kind === 'entry') {
        await persistEntries(entries.map(entry => entry.id === editingTarget.id ? { ...entry, values: { ...entryForm } } : entry));
      } else if (editingTarget?.kind === 'sheet') {
        await persistEntries(entries, { ...sheetOverrides, [editingTarget.key]: { ...entryForm } });
      } else {
        const entry: CommercialEntry = {
          id: window.crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          values: { ...entryForm },
        };
        await persistEntries([entry, ...entries]);
      }
      setEntryModalOpen(false);
      setEditingTarget(null);
      setEntryForm(createCommercialForm());
    } catch (reason) {
      setEntryError(reason instanceof Error ? reason.message : 'No se pudo guardar el registro.');
    } finally {
      setEntrySaving(false);
    }
  };

  const deleteEntry = async (entryId: string) => {
    setEntryError('');
    try {
      await persistEntries(entries.filter(entry => entry.id !== entryId));
    } catch (reason) {
      setEntryError(reason instanceof Error ? reason.message : 'No se pudo eliminar el registro.');
    }
  };

  const editRow = (row: CommercialRow) => {
    if (!data) return;
    setEntryForm(commercialRowToForm(row.values, data.columns));
    setEditingTarget(row.entryId
      ? { kind: 'entry', id: row.entryId }
      : { kind: 'sheet', key: row.sheetKey! });
    setEntryError('');
    setEntryModalOpen(true);
  };

  const deleteRow = async () => {
    if (!deleteRowTarget) return;
    const row = deleteRowTarget;
    setRowDeleting(true);
    if (row.entryId) {
      await deleteEntry(row.entryId);
      setRowDeleting(false);
      setDeleteRowTarget(null);
      return;
    }
    if (!row.sheetKey) {
      setRowDeleting(false);
      return;
    }
    setEntryError('');
    try {
      const nextOverrides = { ...sheetOverrides };
      delete nextOverrides[row.sheetKey];
      await persistEntries(entries, nextOverrides, [...deletedSheetRows, row.sheetKey]);
      setDeleteRowTarget(null);
    } catch (reason) {
      setEntryError(reason instanceof Error ? reason.message : 'No se pudo eliminar el registro.');
    } finally {
      setRowDeleting(false);
    }
  };

  const deleteRowLabel = (row: CommercialRow) => {
    if (!data) return 'la fila seleccionada';
    const nameIndex = data.columns.findIndex(column => ['apellidoynombre', 'nombre'].includes(normalizeLookupValue(column)));
    const dateIndex = data.columns.findIndex(column => ['fecha', 'fechagestion'].includes(normalizeLookupValue(column)));
    const name = nameIndex >= 0 ? row.values[nameIndex] : '';
    const date = dateIndex >= 0 ? row.values[dateIndex] : '';
    return name || (date ? `${config.label.toLowerCase()} del ${formatDate(date)}` : 'la fila seleccionada');
  };

  if (!sheetId) return (
    <div className="daily-sheet-state is-error" role="tabpanel">
      <strong>Sheet no configurado</strong>
      <span>Todavía no hay un Sheet configurado para {analyst || 'este analista'}.</span>
    </div>
  );

  return (
    <div className="daily-sheet-section" role="tabpanel">
      <div className="daily-sheet-toolbar">
        <div>
          <strong>Listado de {config.label.toLowerCase()}</strong>
          <span>{data ? `${visibleRows.length} visibles de ${data.rows.length}` : `Sincronizando datos de ${analyst}`}</span>
        </div>
        <div className="daily-sheet-actions">
          <label className="daily-sheet-search">
            <Search size={14} />
            <input value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} placeholder={`Buscar en ${config.label.toLowerCase()}...`} />
          </label>
          <button type="button" className="daily-sheet-add" onClick={() => { setEditingTarget(null); setEntryForm(createCommercialForm()); setEntryError(''); setEntryModalOpen(true); }}>
            <Plus size={14} /> Cargar {tab === 'flyers' ? 'flyers' : 'email'}
          </button>
          <button type="button" className="daily-sheet-refresh" onClick={reload} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'is-spinning' : ''} /> Actualizar
          </button>
        </div>
      </div>

      {loading && <DailyLoadingState kind={tab} label={config.label} />}
      {!loading && error && (
        <div className="daily-sheet-state is-error">
          <strong>No pudimos cargar esta pestaña.</strong>
          <span>{error}</span>
          <button type="button" onClick={reload}>Reintentar</button>
        </div>
      )}
      {!loading && !error && data && (
        <div className="daily-table-shell">
          <div className="daily-table-wrap daily-sheet-table-wrap">
            <table className="daily-table daily-sheet-table">
            <thead><tr>{data.columns.map((column, index) => <th key={`${column}-${index}`}>{column}</th>)}<th>Acciones</th></tr></thead>
            <tbody>
              {paginatedRows.map((row, rowIndex) => (
                <tr key={row.entryId ?? row.sheetKey ?? `sheet-${rowIndex}`}>
                  {data.columns.map((column, columnIndex) => {
                    const normalizedColumn = normalizeLookupValue(column);
                    const value = row.values[columnIndex];
                    return (
                      <td className={commercialColumnClass(column, columnIndex)} key={columnIndex}>
                        {normalizedColumn === 'score'
                          ? <DailyScore value={value} />
                          : normalizedColumn.startsWith('fecha')
                            ? <span>{value ? formatDate(value) : '—'}</span>
                            : <span>{value}</span>}
                      </td>
                    );
                  })}
                  <td>
                    <CompactDailyActions
                      label={deleteRowLabel(row)}
                      onEdit={() => editRow(row)}
                      onDelete={() => { setEntryError(''); setDeleteRowTarget(row); }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
            {visibleRows.length === 0 && <div className="daily-sheet-state"><span>Sin resultados para la búsqueda actual.</span></div>}
          </div>
          <DailyPagination
            total={visibleRows.length}
            page={safePage}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={value => { setPageSize(value); setPage(1); }}
            itemLabel={tab === 'flyers' ? 'flyers' : 'emails'}
          />
        </div>
      )}
      {entryError && !entryModalOpen && <div className="daily-action-error">{entryError}</div>}
      {entryModalOpen && (
        <CommercialEntryModal
          tab={tab}
          editing={editingTarget !== null}
          form={entryForm}
          setForm={setEntryForm}
          onCancel={() => setEntryModalOpen(false)}
          onSave={saveEntry}
          saving={entrySaving}
          error={entryError}
        />
      )}
      {deleteRowTarget && (
        <DailyDeleteModal
          label={deleteRowLabel(deleteRowTarget)}
          onCancel={() => { setDeleteRowTarget(null); setEntryError(''); }}
          onConfirm={deleteRow}
          deleting={rowDeleting}
          error={entryError}
        />
      )}
    </div>
  );
}

function MonthlySummaryModal({ analyst, month, months, summary, onMonthChange, onCancel }: {
  analyst: string;
  month: string;
  months: string[];
  summary: {
    total: number;
    tipoCliente: MonthlySummaryItem[];
    actividad: MonthlySummaryItem[];
    estado: MonthlySummaryItem[];
    score: MonthlySummaryItem[];
  };
  onMonthChange: (value: string) => void;
  onCancel: () => void;
}) {
  const sections = [
    { key: 'tipoCliente', title: 'Tipo de cliente', items: compactMonthlyDistribution(summary.tipoCliente) },
    { key: 'actividad', title: 'Actividad', items: compactMonthlyDistribution(summary.actividad) },
    { key: 'estado', title: 'Estado', items: compactMonthlyDistribution(summary.estado) },
    { key: 'score', title: 'Score', items: summary.score },
  ] as const;

  return (
    <ModalPortal>
      <div className="modal-overlay" onClick={onCancel}>
        <section className="modal-content daily-modal daily-summary-modal" role="dialog" aria-modal="true" aria-labelledby="daily-summary-title" onClick={event => event.stopPropagation()}>
          <div className="modal-header daily-modal__header daily-summary-header">
            <div className="daily-summary-heading">
              <span className="daily-summary-heading__icon"><BarChart3 size={19} /></span>
              <div>
                <h3 id="daily-summary-title">Resumen mensual</h3>
                <p>{analyst} · Ingreso diario de ventas</p>
              </div>
            </div>
            <button type="button" className="btn-icon" onClick={onCancel} aria-label="Cerrar"><X size={17} /></button>
          </div>
          <div className="modal-body daily-modal__body daily-summary-body">
            <div className="daily-summary-overview">
              <div className="daily-summary-period">
                <span>Período</span>
                <CustomSelect
                  value={month}
                  onChange={value => onMonthChange(String(value))}
                  options={months.map(value => ({ value, label: formatMonthKey(value) }))}
                  width="100%"
                  menuMaxHeight="280px"
                />
              </div>
              <div className="daily-summary-total">
                <span>Registros del mes</span>
                <strong>{summary.total.toLocaleString('es-AR')}</strong>
              </div>
            </div>

            {summary.total === 0 ? (
              <div className="daily-summary-empty"><BarChart3 size={24} /><strong>Sin registros para este período</strong><span>Seleccioná otro mes para consultar su resumen.</span></div>
            ) : (
              <div className="daily-summary-grid">
                {sections.map(section => (
                  <article className="daily-summary-card" key={section.key}>
                    <header><h4>{section.title}</h4><span>{section.items.length} categorías</span></header>
                    <div className="daily-summary-list">
                      {section.items.map(item => (
                        <div className={`daily-summary-row${item.tone ? ` is-${item.tone}` : ''}`} key={item.label}>
                          <div className="daily-summary-row__label"><span>{item.label}</span><strong>{item.count.toLocaleString('es-AR')} <small>{item.percentage.toFixed(1)}%</small></strong></div>
                          <div className="daily-summary-bar" aria-hidden="true"><span style={{ width: `${item.percentage}%` }} /></div>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
          <div className="modal-footer daily-modal__footer">
            <button type="button" className="btn-primary" onClick={onCancel}>Cerrar</button>
          </div>
        </section>
      </div>
    </ModalPortal>
  );
}

function CommercialEntryModal({ tab, editing, form, setForm, onCancel, onSave, saving, error }: {
  tab: Exclude<GestionTab, 'ingresos'>;
  editing: boolean;
  form: CommercialEntryForm;
  setForm: React.Dispatch<React.SetStateAction<CommercialEntryForm>>;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  error: string;
}) {
  const set = (field: keyof CommercialEntryForm, value: string) => setForm(current => ({ ...current, [field]: value }));
  const flyerFields: Array<{ field: keyof CommercialEntryForm; label: string }> = [
    { field: 'enMano', label: 'En mano' },
    { field: 'casasEdificios', label: 'Casas / edificios' },
    { field: 'autos', label: 'Autos' },
    { field: 'comerciosEntidades', label: 'Comercios / entidades' },
    { field: 'bancosCajeros', label: 'Bancos / cajeros' },
  ];
  const total = flyerFields.reduce((sum, item) => sum + Number(form[item.field] || 0), 0);

  return (
    <ModalPortal>
      <div className="modal-overlay" onClick={onCancel}>
        <form className="modal-content daily-modal commercial-entry-modal" onSubmit={event => { event.preventDefault(); onSave(); }} onClick={event => event.stopPropagation()}>
          <div className="modal-header daily-modal__header">
            <div>
              <h3>{editing ? `Editar ${tab === 'flyers' ? 'flyers' : 'email enviado'}` : (tab === 'flyers' ? 'Cargar flyers' : 'Registrar email enviado')}</h3>
              <p>{editing ? 'Actualizá los datos del registro seleccionado.' : 'El registro queda guardado y aparece inmediatamente en el listado.'}</p>
            </div>
            <button type="button" className="btn-icon" onClick={onCancel} aria-label="Cerrar">×</button>
          </div>
          <div className="modal-body daily-modal__body">
            <div className="daily-modal__grid">
              <div>
                <label className="form-label" htmlFor="commercial-date">Fecha *</label>
                <input id="commercial-date" className="form-input" type="date" value={form.fecha} onChange={event => set('fecha', event.target.value)} required />
              </div>
              {tab === 'flyers' ? (
                <>
                  <div>
                    <label className="form-label" htmlFor="commercial-shift">Turno *</label>
                    <select id="commercial-shift" className="form-input" value={form.turno} onChange={event => set('turno', event.target.value)}>
                      <option>Mañana</option>
                      <option>Tarde</option>
                    </select>
                  </div>
                  {flyerFields.map(item => (
                    <div key={item.field}>
                      <label className="form-label" htmlFor={`commercial-${item.field}`}>{item.label}</label>
                      <input id={`commercial-${item.field}`} className="form-input" type="number" min="0" step="1" value={form[item.field]} onChange={event => set(item.field, event.target.value)} placeholder="0" />
                    </div>
                  ))}
                  <div className="commercial-entry-total"><span>Total del turno</span><strong>{total}</strong></div>
                </>
              ) : (
                <>
                  <div>
                    <label className="form-label" htmlFor="commercial-name">Apellido y nombre *</label>
                    <input id="commercial-name" className="form-input" value={form.nombre} onChange={event => set('nombre', event.target.value)} required />
                  </div>
                  <div>
                    <label className="form-label" htmlFor="commercial-email">Email *</label>
                    <input id="commercial-email" className="form-input" type="email" value={form.email} onChange={event => set('email', event.target.value)} required />
                  </div>
                </>
              )}
            </div>
            {error && <div className="daily-action-error">{error}</div>}
          </div>
          <div className="modal-footer daily-modal__footer">
            <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
          </div>
        </form>
      </div>
    </ModalPortal>
  );
}

function GestionDiariaModal({ form, setForm, onCancel, onSave, saving, error }: {
  form: Partial<GestionDiaria>;
  setForm: React.Dispatch<React.SetStateAction<Partial<GestionDiaria>>>;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  error: string;
}) {
  const set = <K extends keyof GestionDiaria>(field: K, value: GestionDiaria[K]) => setForm(prev => ({ ...prev, [field]: value }));
  return (
    <ModalPortal>
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content daily-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header daily-modal__header">
          <div><h3>{form.id || form.nombre ? 'Editar registro' : 'Agregar registro'}</h3><p>Completá la información de la gestión comercial</p></div>
          <button type="button" className="btn-icon" onClick={onCancel} aria-label="Cerrar">×</button>
        </div>
        <div className="modal-body daily-modal__body">
        <div className="daily-modal__grid">
          <div>
            <label className="form-label">Tipo de cliente *</label>
            <PremiumSelect value={form.tipo_cliente || ''} onChange={v => set('tipo_cliente', v)} options={[...GESTION_DIARIA_OPCIONES.tipoCliente]} isSearchable />
          </div>
          <div>
            <label className="form-label">Fecha *</label>
            <CorporateDatePicker value={form.fecha || ''} onChange={v => set('fecha', v)} />
          </div>
          <div>
            <label className="form-label">Apellido y nombre *</label>
            <input className="form-input" value={form.nombre || ''} onChange={e => set('nombre', e.target.value)} />
          </div>
          <div>
            <label className="form-label">CUIL *</label>
            <input className="form-input" value={form.cuil || ''} onChange={e => set('cuil', sanitizarCuil(e.target.value))} />
          </div>
          <div>
            <label className="form-label">Actividad</label>
            <PremiumSelect value={form.actividad || ''} onChange={v => set('actividad', v)} options={[...GESTION_DIARIA_OPCIONES.actividad]} isSearchable />
          </div>
          <div>
            <label className="form-label">Dónde nos conoció</label>
            <PremiumSelect value={form.donde_nos_conocio || ''} onChange={v => set('donde_nos_conocio', v)} options={[...GESTION_DIARIA_OPCIONES.dondeNosConocio]} isSearchable />
          </div>
          <div>
            <label className="form-label">Estado *</label>
            <PremiumSelect value={form.estado || ''} onChange={v => set('estado', v)} options={[...GESTION_DIARIA_OPCIONES.estado]} />
          </div>
          <div>
            <label className="form-label">Score</label>
            <input type="number" className="form-input" value={form.score ?? ''} onChange={e => set('score', e.target.value ? Number(e.target.value) : null)} />
          </div>
          <div>
            <label className="form-label">Apertura/Renovación</label>
            <PremiumSelect value={form.tipo_operacion || ''} onChange={v => set('tipo_operacion', v)} options={[...GESTION_DIARIA_OPCIONES.tipoOperacion]} />
          </div>
          <div className="daily-modal__full">
            <label className="form-label">Comentarios</label>
            <textarea className="form-input" value={form.comentarios || ''} onChange={e => set('comentarios', e.target.value)} rows={3} />
          </div>
        </div>
        </div>
        {error && <p className="daily-action-error" role="alert">{error}</p>}
        <div className="modal-footer daily-modal__footer">
          <button className="btn-secondary" onClick={onCancel}>Cancelar</button>
          <button className="btn-primary" onClick={onSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}

function DailyCommentsModal({ registro, value, onChange, onCancel, onSave, saving, error }: {
  registro: IncomeSheetRow;
  value: string;
  onChange: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  error: string;
}) {
  return (
    <ModalPortal>
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content daily-action-modal" onClick={event => event.stopPropagation()}>
        <div className="modal-header daily-modal__header">
          <div><h3>Comentarios</h3><p>{registro.nombre}</p></div>
          <button type="button" className="btn-icon" onClick={onCancel} aria-label="Cerrar">×</button>
        </div>
        <div className="modal-body">
          <label className="form-label" htmlFor="daily-comments">Seguimiento y observaciones</label>
          <textarea id="daily-comments" className="form-input daily-comments-input" value={value} onChange={event => onChange(event.target.value)} rows={7} autoFocus placeholder="Sin comentarios..." />
          {error && <p className="daily-action-error" role="alert">{error}</p>}
        </div>
        <div className="modal-footer daily-modal__footer">
          <button type="button" className="btn-secondary" onClick={onCancel}>Cancelar</button>
          <button type="button" className="btn-primary" onClick={onSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar comentarios'}</button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}

function DailyDeleteModal({ label, onCancel, onConfirm, deleting, error }: {
  label: string;
  onCancel: () => void;
  onConfirm: () => void;
  deleting: boolean;
  error: string;
}) {
  return (
    <ModalPortal>
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content daily-action-modal" onClick={event => event.stopPropagation()}>
        <div className="modal-header daily-modal__header">
          <div><h3>Eliminar registro</h3><p>Esta acción no se puede deshacer</p></div>
          <button type="button" className="btn-icon" onClick={onCancel} aria-label="Cerrar">×</button>
        </div>
        <div className="modal-body daily-delete-copy">
          <p>¿Querés eliminar el registro de <strong>{label}</strong>?</p>
          {error && <p className="daily-action-error" role="alert">{error}</p>}
        </div>
        <div className="modal-footer daily-modal__footer">
          <button type="button" className="btn-secondary" onClick={onCancel}>Cancelar</button>
          <button type="button" className="btn-danger" onClick={onConfirm} disabled={deleting}>{deleting ? 'Eliminando...' : 'Eliminar'}</button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}
