'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect, useDeferredValue } from 'react';
import { supabase } from '@/lib/supabase';
import { STATUS_LABEL } from '@/lib/utils';
import { ESTADOS } from '@/context/FilterContext';
import { Registro } from '@/types';
import { useRegistros } from '@/features/registros/RegistrosProvider';
import { useAnalistas } from '@/features/settings/SettingsProvider';
import CustomSelect from '@/components/CustomSelect';
import ModalPortal from '@/components/ModalPortal';
import { getSession } from '@/lib/auth';
import {
  Users, AlertTriangle, Save, X, Filter, CheckCircle,
  Search, ChevronDown, ChevronUp, Loader2, Trash2, ShieldCheck, Download, Pencil,
  Copy, Check, FileSpreadsheet
} from 'lucide-react';
import { parsePastedText, normalizeCuil, ParsedRow } from '@/lib/verificador-utils';
import styles from './BulkModifyTab.module.css';

// Combo editable buscable: al hacer foco muestra TODAS las opciones; filtra al tipear
// y permite ingresar un valor nuevo (texto libre).
function ComboEditable({ value, onChange, options, placeholder, accent }: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  accent: string;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const norm = (s: string) => s.normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '').toLowerCase();
  const q = typed ? norm(value.trim()) : '';
  const filtered = (q ? options.filter(o => norm(o).includes(q)) : options).slice(0, 200);

  return (
    <div ref={ref} className={styles.comboEditable} style={{ '--combo-accent': accent } as React.CSSProperties}>
      <input
        value={value}
        onChange={e => { onChange(e.target.value); setTyped(true); setOpen(true); }}
        onFocus={() => { setOpen(true); setTyped(false); }}
        onKeyDown={e => { if (e.key === 'Escape') setOpen(false); }}
        placeholder={placeholder}
        autoComplete="off"
        className={styles.comboEditableInput}
      />
      {open && filtered.length > 0 && (
        <div className={styles.comboEditableMenu}>
          {filtered.map(o => (
            <div
              key={o}
              onMouseDown={e => { e.preventDefault(); onChange(o); setOpen(false); }}
              className={`${styles.comboEditableOption}${norm(o) === norm(value) ? ` ${styles.isSelected}` : ''}`}
            >
              {o}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const EMPLEADORES_MAESTROS: Record<string, { tipo: string, categoria: string }> = {
  "ENERGÍA DE ENTRE RÍOS S.A": { "tipo": "S.A", "categoria": "Privada" },
  "INC S.A": { "tipo": "S.A", "categoria": "Privada" },
  "PETROPACK S.A": { "tipo": "S.A", "categoria": "Privada" },
  "SELPLAST S.A": { "tipo": "S.A", "categoria": "Privada" },
  "NUEVA TORNERÍA AVENIDA S.A": { "tipo": "S.A", "categoria": "Privada" },
  "CORRER S.A": { "tipo": "S.A", "categoria": "Privada" },
  "FRIGORÍFICO ALBERDI S.A": { "tipo": "S.A", "categoria": "Privada" },
  "RAPILIM S.A": { "tipo": "S.A", "categoria": "Privada" },
  "EMPRESA HOTELERA YAÑEZ MARTIN S.A": { "tipo": "S.A", "categoria": "Privada" },
  "ITA S.A": { "tipo": "S.A", "categoria": "Privada" },
  "SZCZECH S.A": { "tipo": "S.A", "categoria": "Privada" },
  "LUIS LOSI S.A": { "tipo": "S.A", "categoria": "Privada" },
  "LABORATORIOS FABRA S.A": { "tipo": "S.A", "categoria": "Privada" },
  "ELIOVAC S.A": { "tipo": "S.A", "categoria": "Privada" },
  "MERCADO DE SOLUCIONES S.A": { "tipo": "S.A", "categoria": "Privada" },
  "ESTACIÓN DE SERVICIO YPF 25 DE JUNIO S.A": { "tipo": "S.A", "categoria": "Privada" },
  "DIA S.A": { "tipo": "S.A", "categoria": "Privada" },
  "LADISLAO POPELKA Y CIA S.A": { "tipo": "S.A", "categoria": "Privada" },
  "AGUA NUESTRA S.A": { "tipo": "S.A", "categoria": "Privada" },
  "INSTITUTO PRIVADO DE PEDIATRÍA S.A": { "tipo": "S.A", "categoria": "Privada" },
  "IMADEX S.A": { "tipo": "S.A", "categoria": "Privada" },
  "DISTRIBUIDORA GUADALUPE S.A": { "tipo": "S.A", "categoria": "Privada" },
  "RESIDENCIA GERONTOLÓGICA PRIVADA S.R.L": { "tipo": "S.R.L", "categoria": "Privada" },
  "ZENIT TRANSPORTE S.R.L": { "tipo": "S.R.L", "categoria": "Privada" },
  "DROGUERÍA D'EM S.R.L": { "tipo": "S.R.L", "categoria": "Privada" },
  "PAULINA CASTRO DEMARTIN E HIJOS S.R.L": { "tipo": "S.R.L", "categoria": "Privada" },
  "CEMYC S.R.L": { "tipo": "S.R.L", "categoria": "Privada" },
  "AFFIDARE S.R.L": { "tipo": "S.R.L", "categoria": "Privada" },
  "FLOR DE LIS S.R.L": { "tipo": "S.R.L", "categoria": "Privada" },
  "SANTIAGO EICHHORN E HIJOS S.R.L": { "tipo": "S.R.L", "categoria": "Privada" },
  "FELLER S.R.L": { "tipo": "S.R.L", "categoria": "Privada" },
  "CLÍNICA DE PSICOPATOLOGÍA S.R.L": { "tipo": "S.R.L", "categoria": "Privada" },
  "CIANCROK S.R.L": { "tipo": "S.R.L", "categoria": "Privada" },
  "INSTITUTO RAWSON DE DIAGNÓSTICO Y TRATAMIENTO S.R.L": { "tipo": "S.R.L", "categoria": "Privada" },
  "COCINOVA MUEBLES S.R.L": { "tipo": "S.R.L", "categoria": "Privada" },
  "ORO NEGRO S.R.L": { "tipo": "S.R.L", "categoria": "Privada" },
  "ELECTRO BOVRIL S.R.L": { "tipo": "S.R.L", "categoria": "Privada" },
  "ECOPLAST S.R.L": { "tipo": "S.R.L", "categoria": "Privada" },
  "J Y H DISTRIBUCIONES S.R.L": { "tipo": "S.R.L", "categoria": "Privada" },
  "DORINKA S.R.L": { "tipo": "S.R.L", "categoria": "Privada" },
  "CLÍNICA GERONTOLÓGICA ALMAFUERTE S.R.L": { "tipo": "S.R.L", "categoria": "Privada" },
  "MENGHI S.R.L": { "tipo": "S.R.L", "categoria": "Privada" },
  "BAZURCO FACILITY SERVICES S.R.L": { "tipo": "S.R.L", "categoria": "Privada" },
  "LA PICADA HNOS S.R.L": { "tipo": "S.R.L", "categoria": "Privada" },
  "PATRYLAN S.R.L": { "tipo": "S.R.L", "categoria": "Privada" },
  "PROMO BURGUER S.R.L": { "tipo": "S.R.L", "categoria": "Privada" },
  "TRIMAR S.R.L": { "tipo": "S.R.L", "categoria": "Privada" },
  "CASA QUINTA S.R.L": { "tipo": "S.R.L", "categoria": "Privada" },
  "MCO NEXO LABORAL S.R.L": { "tipo": "S.R.L", "categoria": "Privada" },
  "SUSTENTA S.R.L": { "tipo": "S.R.L", "categoria": "Privada" },
  "JUBILADO": { "tipo": "Persona Física", "categoria": "Otros" },
  "MUNICIPALIDAD DE PARANÁ": { "tipo": "Público", "categoria": "Estado" },
  "CONSEJO GENERAL DE EDUCACIÓN": { "tipo": "Público", "categoria": "Estado" },
  "MINISTERIO DE SALUD DE ENTRE RÍOS": { "tipo": "Público", "categoria": "Estado" },
  "GOBIERNO DE LA PROVINCIA DE ENTRE RÍOS": { "tipo": "Público", "categoria": "Estado" },
  "JEFATURA DE POLICÍA DE LA PROVINCIA DE ENTRE RÍOS": { "tipo": "Público", "categoria": "Estado" },
  "PENSIÓN POR VIUDEZ": { "tipo": "Persona Física", "categoria": "Otros" },
  "DIRECCIÓN PROVINCIAL DE VIALIDAD": { "tipo": "Público", "categoria": "Estado" },
  "INSTITUTO DE AYUDA FINANCIERA A LA ACCIÓN SOCIAL": { "tipo": "Público", "categoria": "Estado" },
  "CONTADURÍA GENERAL DEL EJÉRCITO": { "tipo": "Público", "categoria": "Estado" },
  "MINISTERIO DE EDUCACIÓN": { "tipo": "Público", "categoria": "Estado" },
  "UNIVERSIDAD AUTÓNOMA DE ENTRE RÍOS": { "tipo": "Público", "categoria": "Estado" },
  "CLUB ATLÉTICO ESTUDIANTES": { "tipo": "Asociación", "categoria": "Otros" },
  "SERVICIO PENITENCIARIO DE ENTRE RÍOS": { "tipo": "Público", "categoria": "Estado" },
  "COTO CICSA": { "tipo": "S.A", "categoria": "Privada" },
  "SINDICATO DE EMPLEADOS DE COMERCIO DE PARANÁ": { "tipo": "Asociación", "categoria": "Otros" },
  "MINISTERIO DE DESARROLLO HUMANO": { "tipo": "Público", "categoria": "Estado" },
  "CORREO OFICIAL DE LA REPÚBLICA ARGENTINA": { "tipo": "Público", "categoria": "Estado" },
  "INSTITUTO EDUCATIVO SIGLO XXI": { "tipo": "Privada", "categoria": "Otros" },
  "RAVERA, ROSA VIVIANA": { "tipo": "Persona Física", "categoria": "Otros" },
  "FAMEA, HÉCTOR EMANUEL": { "tipo": "Persona Física", "categoria": "Otros" },
  "FRIGORÍFICO SANTA ISABEL": { "tipo": "Privada", "categoria": "Otros" },
  "AGENCIA DE RECAUDACIÓN Y CONTROL ADUANERO": { "tipo": "Público", "categoria": "Estado" },
  "DIRECCIÓN GENERAL ADMINISTRATIVO CONTABLE": { "tipo": "Público", "categoria": "Estado" },
  "MARIZZA, MIRIAM MARIELA": { "tipo": "Persona Física", "categoria": "Otros" },
  "CONSEJO PROVINCIAL DEL NIÑO, EL ADOLESCENTE Y LA FAMILIA": { "tipo": "Público", "categoria": "Estado" },
  "HETZER, RAÚL": { "tipo": "Persona Física", "categoria": "Otros" },
  "ARRIAS, ALEJANDRO EDUARDO": { "tipo": "Persona Física", "categoria": "Otros" },
  "CANCIO, EDUARDO HÉCTOR": { "tipo": "Persona Física", "categoria": "Otros" },
  "ASOCIACIÓN MUTUAL MÉDICA DE ENTRE RÍOS": { "tipo": "Asociación", "categoria": "Otros" },
  "MUNICIPALIDAD DE VILLA URQUIZA": { "tipo": "Público", "categoria": "Estado" },
  "WAGNER, RICARDO FABIÁN": { "tipo": "Persona Física", "categoria": "Otros" },
  "GODOY, HUMBERTO DANIEL": { "tipo": "Persona Física", "categoria": "Otros" },
  "INSTITUTO AUTARQUICO DE PLANEAMIENTO Y VIVIENDA": { "tipo": "Público", "categoria": "Estado" },
  "UNIVERSIDAD NACIONAL DE ENTRE RÍOS": { "tipo": "Público", "categoria": "Estado" },
  "EMPRESA PROVINCIAL DE LA ENERGÍA DE SANTA FE": { "tipo": "Público", "categoria": "Estado" },
  "ÁLVAREZ, ANTONIO ALBERTO": { "tipo": "Persona Física", "categoria": "Otros" },
  "SARLI SCESA, GERARDO DANIEL": { "tipo": "Persona Física", "categoria": "Otros" },
  "CAJA DE RETIROS JUBILACIONES Y PENSIONES DE LA POLICIA FEDERAL": { "tipo": "Público", "categoria": "Estado" },
  "JACOB, JUAN CARLOS": { "tipo": "Persona Física", "categoria": "Otros" },
  "SERVICIO ADMINISTRATIVO CONTABLE": { "tipo": "Público", "categoria": "Estado" },
  "CENCI, MARGARITA DEL CARMEN": { "tipo": "Persona Física", "categoria": "Otros" },
  "CENTRO DE GINECOLOGÍA Y OBSTETRICIA S.R.L": { "tipo": "S.R.L", "categoria": "Privada" },
  "HONORABLE CÁMARA DE SENADORES DE ENTRE RÍOS": { "tipo": "Público", "categoria": "Estado" },
  "CLUB ATLÉTICO PARACAO": { "tipo": "Asociación", "categoria": "Otros" },
  "SPAHN, JORGE ANTONIO": { "tipo": "Persona Física", "categoria": "Otros" },
  "GENDARMERÍA NACIONAL": { "tipo": "Público", "categoria": "Estado" }
};

// Interface para registro con variantes
interface RegistroVariante {
  id: string;
  nombre: string;
  cuil: string;
  empleador: string;
  estado: string;
  puntaje: number;
  analista: string;
}

const ACUERDOS_OPCIONES = ['Riesgo Bajo', 'Riesgo Medio', 'Premium', 'No califica'];
function esGobiernoProvincialBulk(s?: string) {
  if (!s) return false;
  const u = s.toUpperCase();
  return u.includes('GOBIERNO') && (u.includes('ENTRE RÍOS') || u.includes('ENTRE RIOS'));
}
function esConsejoEducacionBulk(s?: string) {
  if (!s) return false;
  const u = s.toUpperCase();
  return u.includes('CONSEJO') && u.includes('EDUCACI');
}
function esMunicipalidadParanaBulk(s?: string) {
  if (!s) return false;
  const u = s.toUpperCase();
  return u.includes('MUNICIPALIDAD') && (u.includes('PARANÁ') || u.includes('PARANA'));
}
function esMinisterioSaludBulk(s?: string) {
  if (!s) return false;
  const u = s.toUpperCase();
  return u.includes('MINISTERIO') && u.includes('SALUD');
}

const TIPO_CLIENTE_OPCIONES = ['Apertura', 'Renovacion'];
const RANGOS_ETARIOS = ['18-25', '26-35', '36-45', '46-55', '56-65', '65+'];
const SEXOS = ['Masculino', 'Femenino', 'Otro'];

interface VarianteEmpleador {
  normalizado: string;
  variantes: string[];
  cantidad: number;
}

// Referencias vacías estables: los modes 'excel' y 'bulk' no consumen la lógica
// del Corrector, y devolver siempre el MISMO array evita invalidar los memos
// que dependen de estos valores.
const EMPTY_STRINGS: string[] = [];
const EMPTY_VARIANTES: VarianteEmpleador[] = [];
const DEPENDENCIAS_OFICIALES = [
  'Ministerio de Salud de Entre Rios',
  'Consejo General de Educación de Entre Rios',
  'Jefatura de Policía de la Provincia de Entre Ríos',
  'Ministerio de Desarrollo Humano de Entre Rios',
  'Direccion Provincial de Vialidad de Entre Ríos',
  'Direccion General Servicio Penitenciario de Entre Ríos',
  'Universidad Nacional de Entre Ríos',
  'Consejo Provincial del Niño, el Adolescente y la Familia COPNAF',
  'Honorable Cámara de Senadores de Entre Ríos',
  'Instituto de Ayuda Financiera a la Acción Social',
  'Caja de Retiros Jubilaciones y Pensiones de la Policía Federal',
  'Ministerio de Seguridad y Justicia de Entre Ríos',
  'Honorable Camara de Diputados de Entre Ríos',
  'Ministerio de Desarrollo Social de Entre Ríos',
  'Instituto Autárquico de Planeamiento y Vivienda',
  'Ministerio de Planeamiento e Infraestructura de Entre Ríos',
  'Universidad Autonoma de Entre Ríos',
  'Ministerio Público de la Defensa de Entre Ríos',
  'Pami INSSJP',
  'Secretaria de modernizacion del estado',
].sort();

interface Filtros {
  // Filtros de selección
  estados: string[];
  analistas: string[];
  scoreMin: string;
  scoreMax: string;
  acuerdoPrecios: string[];
  tipoCliente: string[];
  rangoEtario: string[];
  sexo: string[];
  localidad: string[];
  empleador: string[];
  esRe: string; // '' = todos, 'si' = solo RE, 'no' = solo no RE
  montoMin: string;
  montoMax: string;
  fechaDesde: string;
  fechaHasta: string;
  search: string;
}

interface CamposAModificar {
  estado: string;
  analista: string;
  acuerdo_precios: string;
  tipo_cliente: string;
  cuotas: string;
  rango_etario: string;
  sexo: string;
  empleador: string;
  localidad: string;
  es_re: string; // '' = no cambiar, 'si' = true, 'no' = false
  comentarios: string;
}

const EMPTY_FILTROS: Filtros = {
  estados: [], analistas: [], scoreMin: '', scoreMax: '',
  acuerdoPrecios: [], tipoCliente: [], rangoEtario: [], sexo: [],
  localidad: [], empleador: [], esRe: '', montoMin: '', montoMax: '',
  fechaDesde: '', fechaHasta: '', search: '',
};

const SIN_ESPECIFICAR = '__sin_especificar__';

// Aplica filtro de chips con soporte para "Sin especificar" (null o vacío en la DB)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyChipFilter(query: any, column: string, values: string[]): any {
  if (values.length === 0) return query;
  const hasSin = values.includes(SIN_ESPECIFICAR);
  const real = values.filter(v => v !== SIN_ESPECIFICAR);
  if (hasSin && real.length === 0) return query.or(`${column}.is.null,${column}.eq.`);
  if (hasSin) return query.or(`${column}.in.(${real.join(',')}),${column}.is.null,${column}.eq.`);
  return query.in(column, real);
}

const EMPTY_CAMPOS: CamposAModificar = {
  estado: '', analista: '', acuerdo_precios: '', tipo_cliente: '',
  cuotas: '', rango_etario: '', sexo: '', empleador: '', localidad: '',
  es_re: '', comentarios: '',
};

// ── Estilos compartidos ──────────────────────────────────────────────────────

/* LABEL_STYLE, DARK_INPUT_STYLE, DARK_INPUT_FLEX_STYLE y MODAL_OVERLAY_STYLE
   viven ahora en BulkModifyTab.module.css como .label, .darkInput,
   .darkInputFlex y .modalOverlay. */

const stepBadge = (n: number) => (
  <span className={styles.stepBadge}>{n}</span>
);

// Helper para simplificar nombres y detectar variantes duplicadas (sin tildes, mayúsculas, puntuación ni sufijos societarios)
function simplificarParaDuplicados(nombre: string): string {
  if (!nombre) return '';
  return nombre
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(s\.?r\.?l\.?|s\.?a\.?|s\.?a\.?s\.?|ltda\.?|cia\.?|inc\.?)\b/gi, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Chip seleccionable de variante (compartido por los correctores)
function VarianteChip({
  label,
  selected,
  onToggle,
  isDuplicate = false,
  title,
  onCopy,
}: {
  label: string;
  selected: boolean;
  onToggle: () => void;
  isDuplicate?: boolean;
  title?: string;
  onCopy?: (text: string) => void;
}) {
  const [copiado, setCopiado] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      navigator.clipboard.writeText(label);
      setCopiado(true);
      if (onCopy) onCopy(label);
      setTimeout(() => setCopiado(false), 1800);
    } catch (err) {
      console.error('Error al copiar:', err);
    }
  };

  return (
    <span
      onClick={onToggle}
      title={title || (isDuplicate ? 'Variante duplicada detectada' : undefined)}
      className={`${styles.variantChip}${selected ? ` ${styles.isSelected}` : ''}${isDuplicate ? ` ${styles.isDuplicate}` : ''}`}
    >
      {isDuplicate && (
        <span className={styles.variantChipDot} />
      )}
      <span>{label}</span>
      {selected && (
        <span
          onClick={handleCopy}
          title={copiado ? '¡Copiado!' : 'Copiar nombre'}
          className={`${styles.variantChipCopy}${copiado ? ` ${styles.isCopied}` : ''}`}
        >
          {copiado ? <Check size={11} /> : <Copy size={11} />}
        </span>
      )}
    </span>
  );
}

interface AsignarEmpleadorSectionProps {
  registros: Registro[];
  allEmpleadores: string[];
  mutateRegistros: (fn: (prev: Registro[]) => Registro[]) => void;
  pushBulkUpdateIds: (ids: string[], patch: Partial<Registro>) => void;
  standalone?: boolean;
}

function AsignarEmpleadorSection({ registros, allEmpleadores, mutateRegistros, pushBulkUpdateIds, standalone = false }: AsignarEmpleadorSectionProps) {
  const { nombres: ANALISTAS } = useAnalistas();
  const [expanded, setExpanded] = useState(standalone);
  const [pastedText, setPastedText] = useState('');
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [cuilCol, setCuilCol] = useState<number | null>(null);
  const [searched, setSearched] = useState(false);
  const EMPTY_CAMPOS_EXCEL = {
    empleador: '', dependencia: '', analista: '', estado: '',
    tipo_cliente: '', acuerdo_precios: '', cuotas: '', rango_etario: '',
    sexo: '', localidad: '', es_re: '', comentarios: '',
    puntaje: '', monto: '', fecha: '',
  } as const;
  type CamposExcel = { -readonly [K in keyof typeof EMPTY_CAMPOS_EXCEL]: string };
  const [camposExcel, setCamposExcel] = useState<CamposExcel>({ ...EMPTY_CAMPOS_EXCEL });
  const [confirming, setConfirming] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [assignResult, setAssignResult] = useState<{ updated: number } | null>(null);
  // Campos que el usuario marcó como "Sin especificar" por registro (no se cuentan como faltantes)
  const [clearedByReg, setClearedByReg] = useState<Record<string, Set<string>>>({});
  // Filtro de fecha sobre la tabla de matched
  const [fechaDesde, setFechaDesde] = useState<string>('');
  const [fechaHasta, setFechaHasta] = useState<string>('');
  const [assignError, setAssignError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [step, setStep] = useState<'paste' | 'match' | 'assign'>('paste');

  const colCount = rows[0]?.cells.length ?? 0;

  // Indexar registros por CUIL normalizado una sola vez (evita O(rows × registros))
  const registrosByCuil = useMemo(() => {
    const map = new Map<string, Registro[]>();
    for (const reg of registros) {
      const k = normalizeCuil(reg.cuil);
      if (!k) continue;
      const arr = map.get(k);
      if (arr) arr.push(reg); else map.set(k, [reg]);
    }
    return map;
  }, [registros]);

  const matchedRows = useMemo(() => {
    if (!searched || cuilCol === null || rows.length === 0) return [];
    const inRange = (f: string | null | undefined): boolean => {
      if (!fechaDesde && !fechaHasta) return true;
      const fecha = (f ?? '').slice(0, 10);
      if (!fecha) return false;
      if (fechaDesde && fecha < fechaDesde) return false;
      if (fechaHasta && fecha > fechaHasta) return false;
      return true;
    };
    return rows
      .map(r => {
        const cuil = normalizeCuil(r.cells[cuilCol] ?? '');
        const candidates = registrosByCuil.get(cuil) ?? [];
        const found = (fechaDesde || fechaHasta) ? candidates.filter(reg => inRange(reg.fecha)) : candidates;
        return { cuil, registros: found };
      })
      .filter(r => r.cuil !== '');
  }, [searched, rows, cuilCol, registrosByCuil, fechaDesde, fechaHasta]);

  const allMatchedIds = useMemo(
    () => matchedRows.flatMap(r => r.registros.map(reg => reg.id)),
    [matchedRows]
  );

  // Filtro de completitud: todos | completos | faltantes
  type FiltroCompletitud = 'todos' | 'completos' | 'faltantes';
  const [filtroCompletitud, setFiltroCompletitud] = useState<FiltroCompletitud>('todos');

  // Devuelve los campos obligatorios que faltan en un registro (según validarForm del modal).
  // Un campo asignado en camposExcel (incluido SIN_ESPECIFICAR) se considera atendido.
  const getMissingFields = useCallback((r: Registro): string[] => {
    const cleared = clearedByReg[r.id];
    const addressed = (key: keyof CamposExcel) => {
      if (cleared?.has(key)) return true;
      const v = camposExcel[key];
      return typeof v === 'string' && v.trim() !== '';
    };
    const missing: string[] = [];
    if (!r.nombre?.trim()) missing.push('nombre');
    if (!r.cuil?.trim() || r.cuil.length !== 11) missing.push('cuil');
    if (!addressed('estado') && !r.estado) missing.push('estado');
    const requiereTyA = r.estado === 'venta' || r.estado === 'derivado / aprobado cc';
    if (requiereTyA) {
      if (!addressed('tipo_cliente') && !r.tipo_cliente) missing.push('tipo_cliente');
      if (!addressed('acuerdo_precios') && !r.acuerdo_precios) missing.push('acuerdo_precios');
      if (!addressed('cuotas') && !r.cuotas?.trim()) missing.push('cuotas');
      if (!addressed('rango_etario') && !r.rango_etario) missing.push('rango_etario');
      if (!addressed('sexo') && !r.sexo) missing.push('sexo');
      if (!addressed('empleador') && !r.empleador?.trim()) missing.push('empleador');
      if (!addressed('localidad') && !r.localidad?.trim()) missing.push('localidad');
    }
    if ((esGobiernoProvincialBulk(r.empleador) || esMunicipalidadParanaBulk(r.empleador) || esConsejoEducacionBulk(r.empleador) || esMinisterioSaludBulk(r.empleador)) && !addressed('dependencia') && !r.dependencia?.trim()) {
      missing.push('dependencia');
    }
    if (r.estado === 'derivado / rechazado cc' && !addressed('comentarios') && !r.comentarios?.trim()) {
      missing.push('comentarios');
    }
    return missing;
  }, [camposExcel, clearedByReg]);

  const isRegistroCompleto = useCallback((r: Registro): boolean => getMissingFields(r).length === 0, [getMissingFields]);

  const visibleMatchedRows = useMemo(() => {
    if (filtroCompletitud === 'todos') return matchedRows;
    return matchedRows
      .map(mr => ({
        ...mr,
        registros: mr.registros.filter(r => filtroCompletitud === 'completos' ? isRegistroCompleto(r) : !isRegistroCompleto(r)),
      }))
      .filter(mr => mr.registros.length > 0);
  }, [matchedRows, filtroCompletitud, isRegistroCompleto]);

  const visibleAllIds = useMemo(
    () => visibleMatchedRows.flatMap(r => r.registros.map(reg => reg.id)),
    [visibleMatchedRows]
  );

  const totalClientes = matchedRows.length;
  const totalRegistros = allMatchedIds.length;
  const totalSeleccionados = selectedIds.size;
  const { totalCompletos, totalConFaltantes } = useMemo(() => {
    let completos = 0, faltantes = 0;
    matchedRows.forEach(mr => mr.registros.forEach(r => {
      if (getMissingFields(r).length === 0) completos++; else faltantes++;
    }));
    return { totalCompletos: completos, totalConFaltantes: faltantes };
  }, [matchedRows, getMissingFields]);
  const { allSelected, someSelected } = useMemo(() => {
    if (visibleAllIds.length === 0) return { allSelected: false, someSelected: false };
    let hits = 0;
    for (const id of visibleAllIds) if (selectedIds.has(id)) hits++;
    return {
      allSelected: hits === visibleAllIds.length,
      someSelected: hits > 0 && hits < visibleAllIds.length,
    };
  }, [visibleAllIds, selectedIds]);

  // Preserva el scroll de la ventana al togglear checkboxes
  const preservedScrollRef = useRef<number | null>(null);
  const preserveScroll = () => { preservedScrollRef.current = window.scrollY; };
  useLayoutEffect(() => {
    if (preservedScrollRef.current !== null) {
      window.scrollTo({ top: preservedScrollRef.current });
      preservedScrollRef.current = null;
    }
  }, [selectedIds]);

  const toggleAll = () => {
    preserveScroll();
    if (allSelected) {
      // Deseleccionar solo los visibles
      setSelectedIds(prev => {
        const next = new Set(prev);
        for (const id of visibleAllIds) next.delete(id);
        return next;
      });
    } else {
      // Agregar todos los visibles a la seleccion existente
      setSelectedIds(prev => {
        const next = new Set(prev);
        for (const id of visibleAllIds) next.add(id);
        return next;
      });
    }
  };

  const toggleClient = (ids: string[]) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      const allOn = ids.every(id => next.has(id));
      if (allOn) ids.forEach(id => next.delete(id));
      else ids.forEach(id => next.add(id));
      return next;
    });
  };

  const handleParse = () => {
    const parsed = parsePastedText(pastedText);
    setRows(parsed);
    setCuilCol(null);
    setSearched(false);
    setAssignResult(null);
    setAssignError(null);
    setConfirming(false);
    setCamposExcel({ ...EMPTY_CAMPOS_EXCEL });
    setSelectedIds(new Set());
    setClearedByReg({});
    if (parsed.length > 0) setStep('match');
  };

  const handleSearch = () => {
    setSearched(true);
    setAssignResult(null);
    setAssignError(null);
    setConfirming(false);
    setStep('assign');
  };

  // Dedupe case-insensitive, prefiriendo una forma canónica si existe en la lista de referencia
  const dedupCI = (values: (string | null | undefined)[], canonical: readonly string[] = []): string[] => {
    const canonMap = new Map(canonical.map(c => [c.toLowerCase(), c]));
    const seen = new Map<string, string>();
    for (const v of values) {
      if (!v) continue;
      const key = v.toLowerCase().trim();
      if (!key) continue;
      if (!seen.has(key)) seen.set(key, canonMap.get(key) ?? v);
      else if (canonMap.has(key)) seen.set(key, canonMap.get(key)!);
    }
    return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
  };

  // Listas derivadas (case-insensitive dedupe)
  const allLocalidadesExcel = useMemo(() => dedupCI(registros.map(r => r.localidad)), [registros]);
  const allDependenciasExcel = useMemo(() => dedupCI(registros.map(r => r.dependencia)), [registros]);
  const allCuotasExcel = useMemo(() => dedupCI(registros.map(r => r.cuotas)), [registros]);

  // Construye payload solo con campos llenos. SIN_ESPECIFICAR → null (borra el valor)
  const buildPayload = (): Record<string, unknown> => {
    const p: Record<string, unknown> = {};
    const setF = (key: keyof CamposExcel, dbKey: string) => {
      const v = camposExcel[key];
      if (typeof v !== 'string' || !v.trim()) return;
      p[dbKey] = v === SIN_ESPECIFICAR ? null : v.trim();
    };
    setF('empleador', 'empleador');
    setF('dependencia', 'dependencia');
    setF('analista', 'analista');
    setF('estado', 'estado');
    setF('tipo_cliente', 'tipo_cliente');
    setF('acuerdo_precios', 'acuerdo_precios');
    setF('cuotas', 'cuotas');
    setF('rango_etario', 'rango_etario');
    setF('sexo', 'sexo');
    setF('localidad', 'localidad');
    setF('comentarios', 'comentarios');
    if (camposExcel.es_re === 'si') p.es_re = true;
    else if (camposExcel.es_re === 'no') p.es_re = false;
    if (camposExcel.puntaje.trim()) p.puntaje = Number(camposExcel.puntaje);
    if (camposExcel.monto.trim()) p.monto = Number(camposExcel.monto);
    if (camposExcel.fecha.trim()) p.fecha = camposExcel.fecha;
    return p;
  };
  const payloadPreview = buildPayload();
  const hayCampos = Object.keys(payloadPreview).length > 0;

  const handleAssign = async () => {
    const idsToUpdate = Array.from(selectedIds);
    const payload = buildPayload();
    if (Object.keys(payload).length === 0 || idsToUpdate.length === 0) return;
    setAssigning(true);
    setAssignError(null);
    const { error } = await supabase
      .from('registros')
      .update(payload)
      .in('id', idsToUpdate);
    setAssigning(false);
    setConfirming(false);
    if (!error) {
      setAssignResult({ updated: idsToUpdate.length });
      const idsSet = new Set(idsToUpdate);
      // Registrar campos puestos a null (Sin especificar) para no flaggearlos luego
      const nulledFields = Object.entries(payload).filter(([, v]) => v === null).map(([k]) => k);
      if (nulledFields.length > 0) {
        setClearedByReg(prev => {
          const next = { ...prev };
          for (const id of idsToUpdate) {
            const set = new Set(next[id] ?? []);
            nulledFields.forEach(f => set.add(f));
            next[id] = set;
          }
          return next;
        });
      }
      // Update local state en un solo setState (O(N) sobre 6k registros, no O(N*M))
      mutateRegistros(prev =>
        prev.map(r => idsSet.has(r.id) ? { ...r, ...payload } : r)
      );
      // Broadcast incremental: receivers aplican el mismo patch sin refresh completo → sin flicker
      pushBulkUpdateIds(idsToUpdate, payload);
    } else {
      setAssignError(error.message);
    }
  };

  return (
    <div className={`${styles.excelSection}${standalone ? ` ${styles.isStandalone}` : ''}`}>
      {!standalone && (
        <div
          onClick={() => setExpanded(v => !v)}
          className={`${styles.excelSectionHeader}${expanded ? ` ${styles.isExpanded}` : ''}`}
        >
          <Users size={18} />
          <h4 className={styles.excelSectionTitle}>
            Asignar Campos desde Excel
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </h4>
        </div>
      )}

      {expanded && (() => {
        const stepBtn = (n: number, label: string, isActive: boolean, isDone: boolean, isDisabled: boolean, onClick: () => void, isLast: boolean): React.ReactNode => {
          return (
            <button
              key={n}
              onClick={onClick}
              disabled={isDisabled}
              className={`${styles.excelStepButton}${isActive ? ` ${styles.isActive}` : ''}${isDone ? ` ${styles.isDone}` : ''}${isLast ? ` ${styles.isLast}` : ''}`}
            >
              <span className={styles.excelStepBadge}>
                {n}
              </span>
              <span>{label}</span>
              {isActive && <span className={styles.excelStepIndicator} />}
            </button>
          );
        };
        return (
        <>
          <div className={styles.excelSteps}>
            <div className={styles.excelStepList}>
              {stepBtn(1, 'Pegar Excel', step === 'paste', rows.length > 0, false, () => setStep('paste'), false)}
              {stepBtn(2, rows.length > 0 ? `Columnas (${rows.length})` : 'Columnas', step === 'match', searched, rows.length === 0, () => { if (rows.length > 0) setStep('match'); }, false)}
              {stepBtn(3, 'Asignar', step === 'assign', false, !searched, () => { if (searched) setStep('assign'); }, true)}
            </div>

            {step === 'assign' && searched && (
              <div className={styles.excelToolbar}>
                {/* Fechas */}
                <div className={styles.excelDateFilter}>
                  <span className={styles.excelDateLabel}>FECHA:</span>
                  <input
                    type="date"
                    value={fechaDesde}
                    onChange={e => setFechaDesde(e.target.value)}
                    className={styles.excelDateInput}
                  />
                  <span className={styles.excelDateSeparator}>–</span>
                  <input
                    type="date"
                    value={fechaHasta}
                    onChange={e => setFechaHasta(e.target.value)}
                    className={styles.excelDateInput}
                  />
                  {(fechaDesde || fechaHasta) && (
                    <button
                      onClick={() => { setFechaDesde(''); setFechaHasta(''); }}
                      className={styles.inlineClear}
                    >Limpiar</button>
                  )}
                </div>

                {/* Separador */}
                <div className={styles.toolbarDivider} />

                {/* Filtros de completitud */}
                <div className={styles.completionFilters}>
                  {([
                    { key: 'todos' as const, label: 'Todos', count: totalRegistros },
                    { key: 'completos' as const, label: 'Completos', count: totalCompletos },
                    { key: 'faltantes' as const, label: 'Faltantes', count: totalConFaltantes },
                  ]).map(({ key, label, count }) => {
                    const activo = filtroCompletitud === key;
                    return (
                      <button
                        key={key}
                        onClick={() => setFiltroCompletitud(key)}
                        className={`${styles.completionFilter} ${styles[`completion_${key}`]}${activo ? ` ${styles.isActive}` : ''}`}
                      >
                        <span>{label}</span>
                        <span className={styles.completionCount}>{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {step === 'paste' && (
          <div className={`${styles.excelStepPanel}${standalone ? ` ${styles.isStandalone}` : ''}`}>
            <label className={styles.excelFieldLabel}>
              Pegar celdas de Excel (CUIL + Apellido/Nombre)
            </label>
            <textarea
              rows={18}
              placeholder="Pegá acá las celdas copiadas de Excel..."
              value={pastedText}
              onChange={e => setPastedText(e.target.value)}
              className={`form-input ${styles.excelTextarea}${standalone ? ` ${styles.isStandalone}` : ''}`}
            />
            <div className={styles.excelActions}>
              <button
                onClick={handleParse}
                disabled={!pastedText.trim()}
                className={styles.excelPrimaryButton}
              >
                Cargar
              </button>
              {pastedText && (
                <button
                  onClick={() => setPastedText('')}
                  className={styles.excelSecondaryButton}
                >
                  <X size={12} /> Limpiar
                </button>
              )}
            </div>
          </div>
          )}

          {step === 'match' && rows.length > 0 && (
            <div className={`${styles.excelStepPanel}${standalone ? ` ${styles.isStandalone}` : ''}`}>
              <div className={styles.excelDetectedRows}>
                {rows.length} fila{rows.length !== 1 ? 's' : ''} detectada{rows.length !== 1 ? 's' : ''}. Asigná las columnas:
              </div>
              <div className={styles.excelMappingFields}>
                <div>
                  <label className={styles.excelFieldLabel}>
                    Columna CUIL *
                  </label>
                  <select
                    value={cuilCol ?? ''}
                    onChange={e => { setCuilCol(e.target.value === '' ? null : Number(e.target.value)); setSearched(false); setSelectedIds(new Set()); }}
                    className={styles.excelSelect}
                  >
                    <option value="">— seleccionar —</option>
                    {Array.from({ length: colCount }, (_, i) => (
                      <option key={i} value={i}>Col {i + 1}: {rows[0]?.cells[i] ?? ''}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={`${styles.excelPreviewScroll}${standalone ? ` ${styles.isStandalone}` : ''}`}>
                <table className={styles.excelPreviewTable}>
                  <thead>
                    <tr>
                      {Array.from({ length: colCount }, (_, i) => (
                        <th key={i} className={styles.excelTableHead}>
                          Col {i + 1}{i === cuilCol ? ' (CUIL)' : ''}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, ri) => (
                      <tr key={ri}>
                        {row.cells.map((cell, ci) => (
                          <td key={ci} className={`${styles.excelTableCell}${ci === cuilCol ? ` ${styles.isMapped}` : ''}`}>
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className={styles.excelActionsCompact}>
                <button
                  onClick={handleSearch}
                  disabled={cuilCol === null}
                  className={styles.excelPrimaryButton}
                >
                  <Search size={12} />
                  Buscar en registros
                </button>
                <button
                  onClick={() => { setPastedText(''); setRows([]); setCuilCol(null); setSearched(false); setStep('paste'); setSelectedIds(new Set()); setCamposExcel({ ...EMPTY_CAMPOS_EXCEL }); setClearedByReg({}); }}
                  className={styles.excelSecondaryButton}
                >
                  <X size={12} /> Limpiar
                </button>
              </div>
            </div>
          )}

          {step === 'assign' && searched && (
            <div className={`${styles.excelStepPanel}${standalone ? ` ${styles.isStandalone}` : ''}`}>
              <div className={styles.excelSelectionSummary}>
                <div className={`${styles.excelSelectionCount}${totalSeleccionados > 0 ? ` ${styles.hasSelection}` : ''}`}>
                  <span>{totalSeleccionados} seleccionados</span>
                </div>
                <span>•</span>
                <span>{totalClientes} clientes en lista</span>
              </div>
              <div className={`${styles.excelDataScroll}${standalone ? ` ${styles.isStandalone}` : ''}`}>
                <table className={styles.excelDataTable}>
                  <thead className={styles.excelDataHead}>
                    <tr>
                      <th className={`${styles.excelTableHead} ${styles.checkboxCell}`}>
                        <input
                          type="checkbox"
                          checked={allSelected}
                          ref={el => { if (el) el.indeterminate = someSelected; }}
                          onChange={toggleAll}
                          className={styles.excelCheckbox}
                          title="Seleccionar todos"
                        />
                      </th>
                      <th className={styles.excelTableHead}>CUIL</th>
                      <th className={styles.excelTableHead}>APELLIDO Y NOMBRE</th>
                      <th className={styles.excelTableHead}>FECHA</th>
                      <th className={styles.excelTableHead}>CANTIDAD DE REGISTROS</th>
                      <th className={styles.excelTableHead}>ANALISTA ACTUAL</th>
                      <th className={styles.excelTableHead}>EMPLEADOR ACTUAL</th>
                      <th className={styles.excelTableHead}>DEPENDENCIA ACTUAL</th>
                      <th className={styles.excelTableHead}>FALTANTES</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const fmtFecha = (r: Registro): string => {
                        const f = r.fecha || (r.created_at ? r.created_at.split('T')[0] : '');
                        if (!f) return '—';
                        const partes = f.split('-');
                        if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
                        return f;
                      };
                      const willFill = (f: string): boolean => {
                        if (!(f in camposExcel)) return false;
                        const v = camposExcel[f as keyof CamposExcel];
                        return typeof v === 'string' && v.trim() !== '';
                      };
                      const renderFaltantes = (missing: string[], isSelected: boolean) => {
                        if (missing.length === 0) {
                          return <span className={styles.excelComplete}>✓ Completo</span>;
                        }
                        const fixed = isSelected ? missing.filter(willFill) : [];
                        const stillMissing = isSelected ? missing.filter(f => !willFill(f)) : missing;
                        return (
                          <div className={styles.missingFields}>
                            {fixed.map(f => (
                              <span key={f} className={`${styles.missingField} ${styles.willComplete}`} title="Se completará al aplicar">✓ {f}</span>
                            ))}
                            {stillMissing.map(f => (
                              <span key={f} className={`${styles.missingField} ${styles.stillMissing}`}>{f}</span>
                            ))}
                          </div>
                        );
                      };

                      return visibleMatchedRows.flatMap((mr, i) => {
                        const nombresDB = [...new Set(mr.registros.map(r => r.nombre).filter(Boolean))].join(' | ');
                        const nombreMostrar = nombresDB || '—';

                        // Sin registros
                        if (mr.registros.length === 0) {
                          return [(
                            <tr key={`${i}-empty`} className={`${styles.excelDataRow} ${styles.isEmpty}`}>
                              <td className={`${styles.excelTableCell} ${styles.checkboxCell}`} />
                              <td className={styles.excelTableCell}>{mr.cuil}</td>
                              <td className={styles.excelTableCell}>{nombreMostrar}</td>
                              <td className={styles.excelTableCell}>—</td>
                              <td className={`${styles.excelTableCell} ${styles.mutedCell}`}>Sin registros</td>
                              <td className={styles.excelTableCell}>—</td>
                              <td className={styles.excelTableCell}>—</td>
                              <td className={styles.excelTableCell}>—</td>
                              <td className={styles.excelTableCell}>—</td>
                            </tr>
                          )];
                        }

                        const rowIds = mr.registros.map(r => r.id);
                        const groupAllSelected = rowIds.every(id => selectedIds.has(id));
                        const groupSomeSelected = !groupAllSelected && rowIds.some(id => selectedIds.has(id));
                        const isMulti = mr.registros.length > 1;

                        // Header de grupo (sólo cuando hay múltiples registros)
                        const elements: React.JSX.Element[] = [];
                        if (isMulti) {
                          elements.push(
                            <tr key={`${i}-group`} className={`${styles.excelDataRow} ${styles.groupRow}`}>
                              <td className={`${styles.excelTableCell} ${styles.checkboxCell}`}>
                                <input
                                  type="checkbox"
                                  checked={groupAllSelected}
                                  ref={el => { if (el) el.indeterminate = groupSomeSelected; }}
                                  onChange={() => toggleClient(rowIds)}
                                  className={styles.excelCheckbox}
                                  title="Seleccionar/deseleccionar todos del cliente"
                                />
                              </td>
                              <td className={`${styles.excelTableCell} ${styles.strongCell}`}>{mr.cuil}</td>
                              <td className={`${styles.excelTableCell} ${styles.strongCell}`}>{nombreMostrar}</td>
                              <td className={styles.excelTableCell} colSpan={6}>
                                <span className={styles.groupHint}>{mr.registros.length} registros — elegí cuáles modificar</span>
                              </td>
                            </tr>
                          );
                        }

                        // Una fila por registro
                        mr.registros.forEach((reg, ri) => {
                          const checked = selectedIds.has(reg.id);
                          const missing = getMissingFields(reg);
                          elements.push(
                            <tr
                              key={`${i}-${reg.id}`}
                              className={`${styles.excelDataRow}${checked ? ` ${styles.isSelected}` : ''}`}
                              onClick={(e) => {
                                if ((e.target as HTMLElement).closest('input')) return;
                                toggleClient([reg.id]);
                              }}
                            >
                              <td className={`${styles.excelTableCell} ${styles.checkboxCell}${isMulti ? ` ${styles.isNested}` : ''}`}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleClient([reg.id])}
                                  className={styles.excelCheckbox}
                                />
                              </td>
                              <td className={styles.excelTableCell}>{isMulti ? <span className={styles.nestedRowLabel}>↳ #{ri + 1}</span> : mr.cuil}</td>
                              <td className={styles.excelTableCell}>{isMulti ? '' : nombreMostrar}</td>
                              <td className={styles.excelTableCell}>{fmtFecha(reg)}</td>
                              <td className={styles.excelTableCell}>{isMulti ? '' : 1}</td>
                              <td className={styles.excelTableCell}>{reg.analista || '—'}</td>
                              <td className={styles.excelTableCell}>{reg.empleador || '—'}</td>
                              <td className={styles.excelTableCell}>{reg.dependencia || '—'}</td>
                              <td className={styles.excelTableCell}>{renderFaltantes(missing, checked)}</td>
                            </tr>
                          );
                        });

                        return elements;
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {step === 'assign' && searched && totalRegistros > 0 && !assignResult && (
            <div className={styles.excelAssignmentForm}>
              <div className={styles.excelFormHint}>
                Llená sólo los campos que querés modificar. Los vacíos no se tocan.
              </div>
              <div className={styles.excelFieldsGrid}>
                {(() => {
                  const setField = (key: keyof CamposExcel) => (v: string) => { setCamposExcel(p => ({ ...p, [key]: v })); setConfirming(false); };
                  const selects: Array<{ key: keyof CamposExcel; label: string; opts: readonly string[] }> = [
                    { key: 'analista', label: 'Analista', opts: ANALISTAS },
                    { key: 'estado', label: 'Estado', opts: ESTADOS },
                    { key: 'tipo_cliente', label: 'Tipo Cliente', opts: TIPO_CLIENTE_OPCIONES },
                    { key: 'acuerdo_precios', label: 'Acuerdo Precios', opts: ACUERDOS_OPCIONES },
                    { key: 'rango_etario', label: 'Rango Etario', opts: RANGOS_ETARIOS },
                    { key: 'sexo', label: 'Sexo', opts: SEXOS },
                  ];
                  const inputs: Array<{ key: keyof CamposExcel; label: string; list: string[] }> = [
                    { key: 'empleador', label: 'Empleador', list: allEmpleadores },
                    { key: 'dependencia', label: 'Dependencia', list: allDependenciasExcel },
                    { key: 'cuotas', label: 'Cuotas', list: allCuotasExcel },
                    { key: 'localidad', label: 'Localidad', list: allLocalidadesExcel },
                  ];
                  return (
                    <>
                      {selects.map(f => (
                        <div key={f.key}>
                          <label className={styles.excelFieldLabel}>{f.label}</label>
                          <select value={camposExcel[f.key]} onChange={e => setField(f.key)(e.target.value)} className={styles.excelFieldControl}>
                            <option value="">— no cambiar —</option>
                            <option value={SIN_ESPECIFICAR}>Sin especificar (borrar)</option>
                            {f.opts.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        </div>
                      ))}
                      {inputs.map(f => (
                        <div key={f.key}>
                          <label className={styles.excelFieldLabel}>{f.label}</label>
                          <input
                            className={`form-input ${styles.excelFieldControl}`}
                            list={`excel-dl-${f.key}`}
                            value={camposExcel[f.key]}
                            onChange={e => setField(f.key)(e.target.value)}
                          />
                          <datalist id={`excel-dl-${f.key}`}>
                            {f.list.map(v => <option key={v} value={v} />)}
                          </datalist>
                        </div>
                      ))}
                      <div>
                        <label className={styles.excelFieldLabel}>Fecha</label>
                        <input type="date" className={`form-input ${styles.excelFieldControl}`} value={camposExcel.fecha} onChange={e => setField('fecha')(e.target.value)} />
                      </div>
                    </>
                  );
                })()}
              </div>


              <div className={styles.excelAssignmentActions}>
                <div className={styles.excelAssignmentSummary}>
                  <span className={styles.excelSummaryText}>
                    <span className={styles.excelSelectedValue}>{totalSeleccionados}</span> seleccionado{totalSeleccionados !== 1 ? 's' : ''}
                    {hayCampos && <> · <span className={styles.excelFieldsValue}>{Object.keys(payloadPreview).length} campo{Object.keys(payloadPreview).length !== 1 ? 's' : ''}</span></>}
                  </span>
                  {hayCampos && (
                    <span className={styles.excelFieldNames}>
                      → {Object.keys(payloadPreview).join(', ')}
                    </span>
                  )}
                </div>

              {!confirming ? (
                <button
                  onClick={() => { if (hayCampos && totalSeleccionados > 0) setConfirming(true); }}
                  disabled={!hayCampos || totalSeleccionados === 0}
                  className={styles.excelPrimaryButton}
                >
                  Asignar a seleccionados ({totalSeleccionados} registro{totalSeleccionados !== 1 ? 's' : ''})
                </button>
              ) : (
                <div className={styles.excelConfirmRow}>
                  <span className={styles.excelConfirmWarning}>
                    ⚠ Se actualizarán {totalSeleccionados} registro{totalSeleccionados !== 1 ? 's' : ''}
                  </span>
                  <button
                    onClick={handleAssign}
                    disabled={assigning}
                    className={styles.excelDangerButton}
                  >
                    {assigning ? 'Guardando...' : '⚠ Confirmar'}
                  </button>
                  <button
                    onClick={() => setConfirming(false)}
                    disabled={assigning}
                    className={styles.excelSecondaryButton}
                  >
                    Cancelar
                  </button>
                </div>
              )}

              {assignError && (
                <div className={styles.excelError}>
                  Error: {assignError}
                </div>
              )}
              </div>
            </div>
          )}

          {assignResult && (
            <div className={styles.excelSuccess}>
              <span>✓ {assignResult.updated} registro{assignResult.updated !== 1 ? 's' : ''} actualizado{assignResult.updated !== 1 ? 's' : ''}.</span>
              <div className={styles.excelSuccessActions}>
                <button
                  onClick={() => {
                    setAssignResult(null);
                    setCamposExcel({ ...EMPTY_CAMPOS_EXCEL });
                    setSelectedIds(new Set());
                    setConfirming(false);
                  }}
                  className={`${styles.excelResultButton} ${styles.isSuccess}`}
                >
                  Seguir con estos registros
                </button>
                <button
                  onClick={() => {
                    setPastedText('');
                    setRows([]);
                    setCuilCol(null);
                    setSearched(false);
                    setSelectedIds(new Set());
                    setCamposExcel({ ...EMPTY_CAMPOS_EXCEL });
                    setClearedByReg({});
                    setAssignResult(null);
                    setAssignError(null);
                    setConfirming(false);
                    setStep('paste');
                  }}
                  className={`${styles.excelResultButton} ${styles.isPrimary}`}
                >
                  Cargar otro Excel
                </button>
              </div>
            </div>
          )}
        </>
        );
      })()}
    </div>
  );
}

// `mode` es obligatorio: los tres call sites (Ajustes) siempre lo pasan. Antes
// existía un modo 'all' por defecto que renderizaba un flujo "General / Legacy"
// que ya nadie montaba; se eliminó junto con sus ~393 líneas de JSX muerto.
export default function BulkModifyTab({ mode }: { mode: 'corrector' | 'bulk' | 'excel' }) {
  const [filtros, setFiltros] = useState<Filtros>(EMPTY_FILTROS);
  const [campos, setCampos] = useState<CamposAModificar>(EMPTY_CAMPOS);
  const [previewCount, setPreviewCount] = useState(0);
  const [previewIds, setPreviewIds] = useState<Set<string>>(new Set());
  const [step, setStep] = useState<'filter' | 'confirm' | 'done'>('filter');
  const [updating, setUpdating] = useState(false);
  // Un campo cuenta como modificacion cuando tiene valor, con la MISMA semantica que
  // aplicarModificaciones: '' = no modificar, SIN_ESPECIFICAR = borrado explicito,
  // es_re 'si'/'no' = valor explicito (incluido false). Se deriva de EMPTY_CAMPOS para
  // que agregar un campo editable no vuelva a dejar el guard desincronizado.
  const hayCamposAModificar = (Object.keys(EMPTY_CAMPOS) as (keyof CamposAModificar)[])
    .some((k) => !!campos[k]);
  const aplicarDisabled = updating || previewCount === 0 || !hayCamposAModificar;
  const [updatedCount, setUpdatedCount] = useState(0);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const { registros, mutateRegistros, pushBulkRefresh, refresh, pushRegistroChange, pushBulkUpdateIds, pushBulkPatchByField } = useRegistros();
  const { nombres: ANALISTAS } = useAnalistas();

  // Derivar datos de filtros directamente de registros (reactivo)
  const allAnalistas = useMemo(() => Array.from(new Set(registros.map(r => r.analista).filter(Boolean))).sort(), [registros]);
  // Mismas opciones que en 19f881e (únicas y ordenadas), pero con Set en lugar del
  // `arr.indexOf()` dentro de un filter, que era O(n²) sobre todos los registros.
  const localidadesDisponibles = useMemo(() => Array.from(new Set(registros.map(r => r.localidad).filter(Boolean))).sort() as string[], [registros]);
  const allEmpleadoresList = useMemo(() => Array.from(new Set(registros.map(r => r.empleador?.trim()).filter(Boolean))).sort() as string[], [registros]);
  const allDependenciasList = useMemo(() => Array.from(new Set(registros.map(r => r.dependencia?.trim()).filter(Boolean))).sort() as string[], [registros]);
  const allEmpleadores = useMemo(() => Array.from(new Set(registros.map(r => r.empleador).filter(Boolean))).sort() as string[], [registros]);
  const [empleadorCorreccion, setEmpleadorCorreccion] = useState<string>('');
  const [empleadoresSeleccionados, setEmpleadoresSeleccionados] = useState<string[]>([]);
  const [busquedaEmpleador, setBusquedaEmpleador] = useState('');
const [correctorExpandido, setCorrectorExpandido] = useState(false);
  const [gruposDescartados, setGruposDescartados] = useState<Map<string, number>>(() => {
    if (typeof window === 'undefined') return new Map();
    try {
      const saved = localStorage.getItem('empleador_grupos_ok');
      if (!saved) return new Map();
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return new Map((parsed as string[]).map(k => [k, 0]));
      }
      return new Map(Object.entries(parsed) as [string, number][]);
    } catch { return new Map(); }
  });

  const [localidadCorreccion, setLocalidadCorreccion] = useState<string>('');
  const [localidadesSeleccionadas, setLocalidadesSeleccionadas] = useState<string[]>([]);
  const [busquedaLocalidad, setBusquedaLocalidad] = useState('');
  const [correctorLocalidadExpandido, setCorrectorLocalidadExpandido] = useState(false);
  const [dependenciaCorreccion, setDependenciaCorreccion] = useState<string>('');
  const [dependenciasSeleccionadas, setDependenciasSeleccionadas] = useState<string[]>([]);
  const [busquedaDependencia, setBusquedaDependencia] = useState('');
  const [correctorDependenciaExpandido, setCorrectorDependenciaExpandido] = useState(false);
  const [reasignadorExpandido, setReasignadorExpandido] = useState(false);
  const [reasignarModo, setReasignarModo] = useState<'empleador' | 'dependencia'>('empleador');
  const [reasignarEmpOrigen, setReasignarEmpOrigen] = useState('');
  const [reasignarDepOrigen, setReasignarDepOrigen] = useState('');
  const [reasignarEmpDestino, setReasignarEmpDestino] = useState('');
  const [reasignarDepDestino, setReasignarDepDestino] = useState('');
  const [reasignarBusquedaOrigen, setReasignarBusquedaOrigen] = useState('');
  // ── Reasignar registros entre analistas (reparto con cuotas) ──
  const [raExpandido, setRaExpandido] = useState(false);
  const [raOrigen, setRaOrigen] = useState<string>('');
  const [raEstados, setRaEstados] = useState<string[]>([]); // vacío = todos los estados
  const [raScoreMin, setRaScoreMin] = useState('');
  const [raScoreMax, setRaScoreMax] = useState('');
  const [raFechaDesde, setRaFechaDesde] = useState('');
  const [raFechaHasta, setRaFechaHasta] = useState('');
  const [raDestinos, setRaDestinos] = useState<{ analista: string; cuota: number }[]>([]);
  const [raAsignaciones, setRaAsignaciones] = useState<Map<string, string>>(new Map()); // registroId -> analista destino
  const [raDestinoActivo, setRaDestinoActivo] = useState<string>('');
  const [raNuevoDestino, setRaNuevoDestino] = useState<string>('');
  const [raNuevaCuota, setRaNuevaCuota] = useState<string>('');
  const [raMultiCant, setRaMultiCant] = useState<Record<string, string>>({}); // analista -> cantidad (reparto múltiple con cantidades distintas)
  const [gruposLocalidadDescartados, setGruposLocalidadDescartados] = useState<Map<string, number>>(() => {
    if (typeof window === 'undefined') return new Map();
    try {
      const saved = localStorage.getItem('localidad_grupos_ok');
      if (!saved) return new Map();
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return new Map((parsed as string[]).map(k => [k, 0]));
      }
      return new Map(Object.entries(parsed) as [string, number][]);
    } catch { return new Map(); }
  });

  const estaDescartado = useCallback((normalizado: string, cantidad: number): boolean => {
    const savedCount = gruposDescartados.get(normalizado);
    return savedCount !== undefined && cantidad <= savedCount;
  }, [gruposDescartados]);

  // Estado para el modal de registros
  const [modalRegistros, setModalRegistros] = useState<RegistroVariante[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalGrupo, setModalGrupo] = useState<string>('');
  const [modalLoading, setModalLoading] = useState(false);

  // Estado para el modal de todos los empleadores
  const [modalEmpleadoresOpen, setModalEmpleadoresOpen] = useState(false);
  const [busquedaEmpleadorModal, setBusquedaEmpleadorModal] = useState('');
  const [filtroTipoModal, setFiltroTipoModal] = useState<'todos' | 'gob_er' | 'muni' | 'min_salud' | 'consejo_educ' | 'sa' | 'srl' | 'sas' | 'se' | 'fisica'>('todos');
  const [empleadoresConConteo, setEmpleadoresConConteo] = useState<{ nombre: string; cantidad: number; tipo: string; categoria: string; masterName?: string; esDependencia?: boolean; empleadorParent?: string }[]>([]);
  const [empleadoresLoading, setEmpleadoresLoading] = useState(false);

  // Estado para "Nuevos hoy" - empleadores creados hoy
  const [showEmpleadoresHoy, setShowEmpleadoresHoy] = useState(false);
  const [empleadoresHoy, setEmpleadoresHoy] = useState<{ cuil: string; nombre: string; empleador: string; dependencia: string; id: string }[]>([]);
  const [loadingEmpleadoresHoy, setLoadingEmpleadoresHoy] = useState(false);
  // Edición inline dentro de "Nuevos hoy"
  const [editandoHoyId, setEditandoHoyId] = useState<string | null>(null);
  const [editHoyEmpleador, setEditHoyEmpleador] = useState('');
  const [editHoyDependencia, setEditHoyDependencia] = useState('');

  // Mapa empleador(normalizado) → dependencias, precomputado UNA vez sobre registros.
  // Evita recorrer todos los registros en cada tecla al editar.
  const depsByEmpleador = useMemo(() => {
    const norm = (s?: string | null) => (s ?? '')
      .normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
      .toUpperCase().replace(/\s+/g, ' ').trim();
    const m = new Map<string, Set<string>>();
    for (const r of registros) {
      const ne = norm(r.empleador);
      const d = r.dependencia?.trim();
      if (!ne || !d) continue;
      let set = m.get(ne);
      if (!set) { set = new Set<string>(); m.set(ne, set); }
      set.add(d);
    }
    return m;
  }, [registros]);

  // Dependencias del empleador elegido: lookup O(1) (exacto) con fallback difuso
  // que recorre solo las claves únicas del mapa (no todos los registros).
  const dependenciasParaEmpleador = useMemo(() => {
    const norm = (s?: string | null) => (s ?? '')
      .normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
      .toUpperCase().replace(/\s+/g, ' ').trim();
    const target = norm(editHoyEmpleador);
    if (!target) return [] as string[];
    const exact = depsByEmpleador.get(target);
    if (exact) return Array.from(exact).sort((a, b) => a.localeCompare(b));
    const set = new Set<string>();
    for (const [emp, deps] of depsByEmpleador) {
      if (emp.includes(target) || target.includes(emp)) deps.forEach(d => set.add(d));
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [depsByEmpleador, editHoyEmpleador]);
  const [fechaDesdeHoy, setFechaDesdeHoy] = useState<string>(() =>
    new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
  );
  const [fechaHastaHoy, setFechaHastaHoy] = useState<string>(() =>
    new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
  );

  // ── Normalización base de empleador ──────────────────────────────────────
  const normalizar = useCallback((nombre: string): string => {
    if (!nombre) return 'Sin dato';
    let n = nombre.toUpperCase().trim();
    n = n.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    // Quitar tipos societarios de forma más robusta
    n = n.replace(/\b(S\.?R\.?L\.?|S\.?A\.?|S\.?A\.?S\.?|LTDA\.?|CIA\.?|E\.?I\.?R\.?L\.?|INC\.?)\b/gi, '').trim();
    
    // Quitar conectores y palabras geográficas/institucionales/previsionales muy comunes que generan falsos positivos
    // Se agregan abreviaturas comunes (MUNIC, MUNI, PROV) para mejorar la detección
    const stopWords = /\b(EL|LA|LOS|LAS|DE|DEL|Y|E|ENTRE|RIOS|PROVINCIA|SANTA|FE|NACION|NACIONAL|CLUB|ATLETICO|ASOCIACION|MUTUAL|CENTRO|SINDICATO|UNION|AGRUPACION|PENSION|JUBILACION|CAJA|MUNICIPALIDAD|MUNIC|MUNI|COMUNA|ESTADO|GOBIERNO|MINISTERIO|SECRETARIA|DIRECCION|GENERAL|PERSONAL|VIA|TITULAR|COBRO|PAGO|PROV|DPTO|DTO|BS|AS)\b/gi;
    const temp = n.replace(stopWords, ' ').replace(/\s+/g, ' ').trim();
    return temp || n || 'Sin dato';
  }, []);

  // ── Levenshtein distance para similitud entre strings ────────────────────
  const levenshtein = useCallback((a: string, b: string): number => {
    const la = a.length, lb = b.length;
    if (la === 0) return lb;
    if (lb === 0) return la;
    if (Math.abs(la - lb) > Math.max(la, lb) * 0.4) return Math.max(la, lb);
    const dp: number[] = Array.from({ length: lb + 1 }, (_, i) => i);
    for (let i = 1; i <= la; i++) {
      let prev = i;
      for (let j = 1; j <= lb; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        const val = Math.min(dp[j] + 1, prev + 1, dp[j - 1] + cost);
        dp[j - 1] = prev;
        prev = val;
      }
      dp[lb] = prev;
    }
    return dp[lb];
  }, []);

  // ── Determinar si dos nombres normalizados son "similares" ───────────────
  // P-D: `tokenize` es un parametro opcional para que agruparFuzzy pueda pasar
  // un cache por invocacion. Sin el, el comportamiento es el original.
  const sonSimilares = useCallback((
    a: string,
    b: string,
    tokenize: (s: string) => string[] = s => s.split(/\s+/).filter(t => t.length >= 2),
  ): boolean => {
    if (a === b) return true;
    if (a === 'Sin dato' || b === 'Sin dato') return false;

    const shorter = a.length <= b.length ? a : b;
    const longer = a.length <= b.length ? b : a;

    // Mínimo 3 caracteres para considerar similitud
    if (shorter.length < 3) return false;

    // 1) Substring containment - Máxima sensibilidad para detectar inclusiones
    if (shorter.length >= 3 && longer.includes(shorter)) return true;

    // 1.5) Subsecuencia de caracteres — detecta abreviaturas como PVIUDEZ en PENSION POR VIUDEZ
    if (shorter.length >= 5) {
      let si = 0;
      for (let li = 0; li < longer.length && si < shorter.length; li++) {
        if (longer[li] === shorter[si]) si++;
      }
      if (si === shorter.length) return true;
    }

    // 2) Prefijo largo compartido
    const minPrefixLen = Math.max(4, Math.floor(shorter.length * 0.7));
    if (longer.startsWith(shorter.substring(0, minPrefixLen))) return true;

    // 3) Tokenizar y comparar
    const tokensA = tokenize(a);
    const tokensB = tokenize(b);
    
    if (tokensA.length >= 1 && tokensB.length >= 1) {
      let matched = 0;
      const usedB = new Set<number>();
      for (const ta of tokensA) {
        for (let j = 0; j < tokensB.length; j++) {
          if (usedB.has(j)) continue;
          const tb = tokensB[j];
          if (ta === tb || ta.includes(tb) || tb.includes(ta) ||
             (Math.min(ta.length, tb.length) >= 4 && levenshtein(ta, tb) <= 1)) {
            matched++;
            usedB.add(j);
            break;
          }
        }
      }
      const matchRatio = matched / Math.max(tokensA.length, tokensB.length);
      // Umbral más amigable para capturar pviudez vs viudez
      if (matchRatio >= 0.5 && matched >= 1) return true;
    }

    // 4) Levenshtein global
    const maxDist = shorter.length <= 6 ? 1 : shorter.length <= 10 ? 2 : 3;
    if (levenshtein(a, b) <= maxDist) return true;

    return false;
  }, [levenshtein]);

  // ── Helper para detectar tipo automáticamente si no está en el maestro ──
  const detectarTipoAutomatico = useCallback((nombre: string): { tipo: string, categoria: string } => {
    const n = nombre.toUpperCase().trim();
    
    // 1. Detectar Público por palabras clave
    if (/\b(MUNICIPALIDAD|MUNIC|MUNI|COMUNA|GOBIERNO|MINISTERIO|SECRETARIA|DIRECCION|GENERAL|PERSONAL|PROVINCIA|PROV|NACION|NACIONAL|CONSEJO|JUZGADO|TRIBUNAL|CONGRESO|CAMARA|SENADO|POLICIA|PENITENCIARIO|VIALIDAD|EDUCACION|SALUD|AFIP|ARCA|ANSES|IOSPER|PAMI)\b/i.test(n)) {
      return { tipo: 'Público', categoria: 'Estado' };
    }
    
    // 2. Detectar Persona Física (Patrón: Apellido, Nombre)
    if (n.includes(',') || (n.split(' ').length >= 2 && !/\b(S\.?A\.?|S\.?R\.?L\.?|INC|S\.A\.S|LTDA|CIA)\b/i.test(n) && n.length < 30)) {
      // Si tiene coma o es corto y no tiene siglas de empresa, es probable que sea persona
      return { tipo: 'Persona Física', categoria: 'Otros' };
    }
    
    // 3. Detectar Privado por siglas societarias
    if (/\b(S\.?A\.?|S\.?R\.?L\.?|S\.A\.S|INC|CORP|LTDA|CIA|CONSULTORA|GRUPO|LOGISTICA|TRANSPORTE|SERVICIOS|ESTACION|SUPERMERCADO|DISTRIBUIDORA)\b/i.test(n)) {
      if (/\bS\.?A\.?\b/i.test(n)) return { tipo: 'S.A', categoria: 'Privada' };
      if (/\bS\.?R\.?L\.?\b/i.test(n)) return { tipo: 'S.R.L', categoria: 'Privada' };
      return { tipo: 'Privada', categoria: 'Privada' };
    }

    return { tipo: 'Privada', categoria: 'Otros' }; // Default a privada/otros
  }, []);

  // ── Helper para obtener info del maestro (normalizado) ──────────────────
  // P-D: indice normalizado del maestro, precomputado una vez en lugar de
  // renormalizar toda la tabla EMPLEADORES_MAESTROS en cada llamada.
  // first-wins replica exactamente el return del bucle original.
  const maestroPorNormalizado = useMemo(() => {
    const idx = new Map<string, { masterName: string; tipo: string; categoria: string }>();
    for (const [mName, mInfo] of Object.entries(EMPLEADORES_MAESTROS)) {
      const k = normalizar(mName);
      if (!idx.has(k)) idx.set(k, { masterName: mName, ...mInfo });
    }
    return idx;
  }, [normalizar]);

  const getMaestroInfo = useCallback((nombre: string) => {
    const n = nombre.toUpperCase().trim();
    // Búsqueda exacta
    if (EMPLEADORES_MAESTROS[n]) return { masterName: n, ...EMPLEADORES_MAESTROS[n], matchType: 'exact' as const };
    
    // Búsqueda por normalización básica (sin SRL/SA/Stopwords)
    const normNombre = normalizar(nombre);
    const hit = maestroPorNormalizado.get(normNombre);
    if (hit) return { ...hit, matchType: 'fuzzy' as const };
    
    // Si no está en el maestro, intentar detección automática
    const auto = detectarTipoAutomatico(nombre);
    return { ...auto, matchType: 'auto' as const, masterName: undefined as string | undefined };
  }, [normalizar, detectarTipoAutomatico, maestroPorNormalizado]);

  // ── Union-Find para agrupar empleadores similares transitivamente ────────
  const agruparFuzzy = useCallback((keys: string[], variantesMap: Map<string, Set<string>>): VarianteEmpleador[] => {
    // Sólo el Corrector consume estos grupos. El bucle de abajo es O(n²) sobre
    // los empleadores/dependencias únicos (≈452 claves ⇒ ~102.000 comparaciones)
    // y se invoca desde varios memos, así que en 'excel' y 'bulk' representaba
    // ~1 s de bloqueo del main thread sin ningún consumidor.
    if (mode !== 'corrector') return EMPTY_VARIANTES;
    const keyList = Array.from(keys);
    // P-D: cache de tokenizacion con vida de esta invocacion (puro, sin refs).
    // Evita retokenizar cada clave O(m) veces dentro del bucle de pares.
    const tokenCache = new Map<string, string[]>();
    const tokenize = (s: string): string[] => {
      let v = tokenCache.get(s);
      if (v === undefined) {
        v = s.split(/\s+/).filter(t => t.length >= 2);
        tokenCache.set(s, v);
      }
      return v;
    };
    const parent = new Map<string, string>();
    const find = (x: string): string => {
      while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x)!)!); x = parent.get(x)!; }
      return x;
    };
    const union = (a: string, b: string) => {
      const ra = find(a), rb = find(b);
      if (ra !== rb) {
        // CAMBIO: El más CORTO es el representante (nombre más "general" e identificativo)
        if (ra.length <= rb.length) parent.set(rb, ra);
        else parent.set(ra, rb);
      }
    };

    for (const k of keyList) parent.set(k, k);

    // Comparar pares — O(n²) pero n es cantidad de empleadores únicos normalizados
    for (let i = 0; i < keyList.length; i++) {
      for (let j = i + 1; j < keyList.length; j++) {
        if (sonSimilares(keyList[i], keyList[j], tokenize)) {
          union(keyList[i], keyList[j]);
        }
      }
    }

    // Agrupar por representante
    const grupos = new Map<string, Set<string>>();
    for (const k of keyList) {
      const root = find(k);
      if (!grupos.has(root)) grupos.set(root, new Set());
      const variantes = variantesMap.get(k);
      if (variantes) for (const v of variantes) grupos.get(root)!.add(v);
    }

    return Array.from(grupos.entries()).map(([normalizado, variantes]) => ({
      normalizado,
      variantes: Array.from(variantes).sort(),
      cantidad: variantes.size,
    }));
  }, [sonSimilares, mode]);

  const variantesEmpleador = useMemo((): VarianteEmpleador[] => {
    // Paso 1: agrupar por normalización exacta
    const map = new Map<string, Set<string>>();
    for (const e of allEmpleadores) {
      const key = normalizar(e);
      if (!map.has(key)) map.set(key, new Set());
      map.get(key)!.add(e);
    }

    // Paso 2: fusionar grupos similares vía fuzzy matching
    const fuzzyGrupos = agruparFuzzy(Array.from(map.keys()), map);

    const result = fuzzyGrupos.filter(g => !estaDescartado(g.normalizado, g.cantidad));
    return result.sort((a, b) => b.cantidad - a.cantidad);
  }, [allEmpleadores, normalizar, agruparFuzzy, estaDescartado]);

  const variantesFiltradas = useMemo(() => {
    if (!busquedaEmpleador.trim()) return variantesEmpleador;
    const q = busquedaEmpleador.toLowerCase();
    
    // Buscar directamente en todos los empleadores sin pasar por normalización
    // para que cualquier coincidencia sea encontrada
    const matchingEmpleadores = allEmpleadores.filter(e => 
      e.toLowerCase().includes(q)
    );
    
    // Si no hay empleadores que coincidan, devolver vacío
    if (matchingEmpleadores.length === 0) return [];
    
    // Crear grupos para mostrar (cada empleador como su propio grupo)
    return matchingEmpleadores.map(e => ({
      normalizado: normalizar(e),
      variantes: [e],
      cantidad: 1,
    })).sort((a, b) => b.normalizado.localeCompare(a.normalizado));
  }, [allEmpleadores, busquedaEmpleador, normalizar, variantesEmpleador]);

  // Grupos con duplicados reales (más de 1 variante) — independiente de mostrarTodos
  const variantesConDuplicados = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const e of allEmpleadores) {
      const key = normalizar(e);
      if (!map.has(key)) map.set(key, new Set());
      map.get(key)!.add(e);
    }
    const fuzzyGrupos = agruparFuzzy(Array.from(map.keys()), map);
    return fuzzyGrupos.filter(g => g.cantidad > 1 && !estaDescartado(g.normalizado, g.cantidad)).sort((a, b) => b.cantidad - a.cantidad);
  }, [allEmpleadores, normalizar, agruparFuzzy, estaDescartado]);

  // Helpers para descartar/restaurar grupos
  const descartarGrupo = useCallback((normalizado: string, cantidad: number) => {
    setGruposDescartados(prev => {
      const next = new Map(prev);
      next.set(normalizado, cantidad);
      try { localStorage.setItem('empleador_grupos_ok', JSON.stringify(Object.fromEntries(next))); } catch { }
      return next;
    });
  }, []);

  const restaurarDescartados = useCallback(() => {
    setGruposDescartados(new Map());
    try { localStorage.removeItem('empleador_grupos_ok'); } catch { }
  }, []);

  // Localidad corrector helpers
const variantesLocalidadConDuplicados = useMemo(() => {
    if (mode !== 'corrector') return EMPTY_VARIANTES;
    const lista = registros.map(r => r.localidad).filter(Boolean) as string[];
    const myMap = new Map<string, Set<string>>();
    for (const locVar of lista) {
      const key = String(locVar).toUpperCase().trim();
      if (!myMap.has(key)) myMap.set(key, new Set());
      myMap.get(key)!.add(String(locVar));
    }
    return Array.from(myMap.entries())
      .filter(([key, vars]) => vars.size > 1 && !gruposLocalidadDescartados.has(key))
      .map(([normalizado, variantes]) => ({
        normalizado,
        variantes: Array.from(variantes),
        cantidad: variantes.size,
      }))
      .sort((a, b) => b.cantidad - a.cantidad);
  }, [registros, gruposLocalidadDescartados, mode]);

  // Todas las localidades para buscar
  const todasLasLocalidadess = useMemo(() => {
    if (mode !== 'corrector') return EMPTY_STRINGS;
    const lista = registros.map(r => r.localidad).filter(Boolean) as string[];
    return Array.from(new Set(lista)).sort();
  }, [registros, mode]);

  // Localidades filtradas por búsqueda
  const localidadesFiltradas = useMemo(() => {
    if (!busquedaLocalidad.trim()) return variantesLocalidadConDuplicados;
    const q = busquedaLocalidad.toLowerCase();
    return variantesLocalidadConDuplicados.filter(v => 
      v.normalizado.toLowerCase().includes(q) || 
      v.variantes.some(lv => lv.toLowerCase().includes(q))
    );
  }, [busquedaLocalidad, variantesLocalidadConDuplicados]);

  // Si no hay duplicados pero hay búsqueda, mostrar todas las localidades
  const listaLocalidadess = busquedaLocalidad.trim()
    ? todasLasLocalidadess.filter(l => l.toLowerCase().includes(busquedaLocalidad.toLowerCase())).map(l => ({
      normalizado: l.toUpperCase(),
      variantes: [l],
      cantidad: 1
    }))
    : localidadesFiltradas;

  // Dependencias corrector helpers
  const allDependencias = useMemo(() =>
    // Sólo alimenta la agrupación fuzzy del Corrector.
    mode !== 'corrector'
      ? EMPTY_STRINGS
      : Array.from(new Set(registros.map(r => r.dependencia).filter(Boolean) as string[])).sort(),
    [registros, mode]
  );

  const variantesDependencia = useMemo((): VarianteEmpleador[] => {
    const map = new Map<string, Set<string>>();
    for (const d of allDependencias) {
      const key = normalizar(d);
      if (!map.has(key)) map.set(key, new Set());
      map.get(key)!.add(d);
    }
    const fuzzyGrupos = agruparFuzzy(Array.from(map.keys()), map);
    return fuzzyGrupos.sort((a, b) => b.cantidad - a.cantidad);
  }, [allDependencias, normalizar, agruparFuzzy]);

  const listaDependencias = useMemo(() => {
    if (!busquedaDependencia.trim()) return variantesDependencia;
    const q = busquedaDependencia.toLowerCase();
    const matching = allDependencias.filter(d => d.toLowerCase().includes(q));
    if (matching.length === 0) return [];
    return matching.map(d => ({
      normalizado: normalizar(d),
      variantes: [d],
      cantidad: 1,
    })).sort((a, b) => a.normalizado.localeCompare(b.normalizado));
  }, [allDependencias, busquedaDependencia, normalizar, variantesDependencia]);

  const descartarGrupoLocalidad = useCallback((normalizado: string) => {
    setGruposLocalidadDescartados(prev => {
      const next = new Map(prev);
      next.set(normalizado, 1);
      try { localStorage.setItem('localidad_grupos_ok', JSON.stringify(Object.fromEntries(next))); } catch { }
      return next;
    });
  }, []);

  const restaurarDescartadosLocalidad = useCallback(() => {
    setGruposLocalidadDescartados(new Map());
    try { localStorage.removeItem('localidad_grupos_ok'); } catch { }
  }, []);

  // ── Cargar registros de un grupo de variantes ──────────────────────────
  const cargarRegistrosGrupo = useCallback(async (variantes: string[], grupoNombre: string) => {
    setModalLoading(true);
    setModalGrupo(grupoNombre);
    setModalOpen(true);

    try {
      const { data, error } = await supabase
        .from('registros')
        .select('id, nombre, cuil, empleador, estado, puntaje, analista')
        .in('empleador', variantes);

      if (error) {
        setToast({ message: `Error: ${error.message}`, type: 'error' });
        setModalRegistros([]);
      } else {
        setModalRegistros(data || []);
      }
    } catch {
      setToast({ message: 'Error al cargar registros', type: 'error' });
      setModalRegistros([]);
    } finally {
      setModalLoading(false);
    }
  }, []);

  // ── Cargar todos los empleadores con conteo ────────────────────────────
  const cargarTodosEmpleadores = useCallback(async (silent = false) => {
    if (!silent) {
      setEmpleadoresLoading(true);
      setModalEmpleadoresOpen(true);
    }

    try {
      const { data, error } = await supabase
        .from('registros')
        .select('empleador, dependencia')
        .not('empleador', 'is', null)
        .neq('empleador', '');

      if (error) {
        setToast({ message: `Error: ${error.message}`, type: 'error' });
        setEmpleadoresConConteo([]);
      } else {
        // Contar ocurrencias de cada empleador
        const conteo = new Map<string, number>();
        const conteoDep = new Map<string, number>();
        const depEmpleadorParents = new Map<string, Map<string, number>>();
        data.forEach(r => {
          const emp = r.empleador;
          conteo.set(emp, (conteo.get(emp) || 0) + 1);
          const dep = r.dependencia?.trim();
          if (dep) {
            conteoDep.set(dep, (conteoDep.get(dep) || 0) + 1);
            if (emp) {
              const m = depEmpleadorParents.get(dep) ?? new Map<string, number>();
              m.set(emp, (m.get(emp) || 0) + 1);
              depEmpleadorParents.set(dep, m);
            }
          }
        });
        const pickParent = (dep: string): string | undefined => {
          const m = depEmpleadorParents.get(dep);
          if (!m || m.size === 0) return undefined;
          let best: [string, number] | null = null;
          for (const entry of m.entries()) {
            if (!best || entry[1] > best[1]) best = entry;
          }
          return best?.[0];
        };

        // Convertir a array y enriquecer con info de maestro
        const empleadosArray = Array.from(conteo.entries())
          .map(([nombre, cantidad]) => {
            const maestro = getMaestroInfo(nombre);
            return {
              nombre,
              cantidad,
              tipo: maestro.tipo,
              categoria: maestro.categoria,
              masterName: maestro.masterName,
              esDependencia: false,
              empleadorParent: undefined as string | undefined,
            };
          })
          .sort((a, b) => b.cantidad - a.cantidad);

        // Agregar dependencias reales de registros (marcadas como dependencia)
        const nombresExistentes = new Set(empleadosArray.map(e => e.nombre.toUpperCase()));
        conteoDep.forEach((cantidad, dep) => {
          if (!nombresExistentes.has(dep.toUpperCase())) {
            const maestro = getMaestroInfo(dep);
            empleadosArray.push({ nombre: dep, cantidad, tipo: maestro.tipo, categoria: maestro.categoria, masterName: maestro.masterName, esDependencia: true, empleadorParent: pickParent(dep) });
            nombresExistentes.add(dep.toUpperCase());
          }
        });

        // Agregar dependencias predefinidas que no tengan registros aún
        for (const dep of DEPENDENCIAS_OFICIALES) {
          if (!nombresExistentes.has(dep.toUpperCase())) {
            const maestro = getMaestroInfo(dep);
            empleadosArray.push({ nombre: dep, cantidad: 0, tipo: maestro.tipo, categoria: maestro.categoria, masterName: maestro.masterName, esDependencia: true, empleadorParent: undefined });
          }
        }

        setEmpleadoresConConteo(empleadosArray);
      }
    } catch {
      setToast({ message: 'Error al cargar empleadores', type: 'error' });
      setEmpleadoresConConteo([]);
    } finally {
      if (!silent) setEmpleadoresLoading(false);
    }
  }, [getMaestroInfo]);

  useEffect(() => {
    if (!modalEmpleadoresOpen) return;
    const refreshId = window.setTimeout(() => { void cargarTodosEmpleadores(true); }, 0);
    return () => window.clearTimeout(refreshId);
  }, [registros, modalEmpleadoresOpen, cargarTodosEmpleadores]);

  useEffect(() => {
    if (!modalEmpleadoresOpen && !modalOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        if (modalEmpleadoresOpen) setModalEmpleadoresOpen(false);
        else if (modalOpen) setModalOpen(false);
      }
    };
    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true } as EventListenerOptions);
  }, [modalEmpleadoresOpen, modalOpen]);

  // ── Registros cargados hoy (Argentina) derivados del contexto ────────────
  // Solo registros con empleador cargado, filtrados por rango de fechas.
  // Valores diferidos: el input de fecha responde al instante; el filtrado pesado
  // se computa en baja prioridad sin bloquear la UI.
  const fechaDesdeDef = useDeferredValue(fechaDesdeHoy);
  const fechaHastaDef = useDeferredValue(fechaHastaHoy);
  const registrosNuevosHoy = useMemo(() => {
    const toArgDateStr = (iso: string) => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
      return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
    };
    return registros.filter(r => {
      if (!r.empleador || !r.empleador.trim()) return false;
      const ref = r.fecha ?? r.created_at ?? null;
      if (!ref) return false;
      const dateStr = toArgDateStr(ref);
      return dateStr >= fechaDesdeDef && dateStr <= fechaHastaDef;
    });
  }, [registros, fechaDesdeDef, fechaHastaDef]);

  const contadorNuevosHoy = registrosNuevosHoy.length;

  // ── Cargar empleadores nuevos de hoy ─────────────────────────────────────
  const cargarEmpleadoresHoy = useCallback(() => {
    setShowEmpleadoresHoy(true);
  }, []);

  // Iniciar edición inline de una fila de "Nuevos hoy"
  const iniciarEdicionHoy = useCallback((r: { id: string; empleador: string; dependencia: string }) => {
    setEditandoHoyId(r.id);
    setEditHoyEmpleador(r.empleador || '');
    setEditHoyDependencia(r.dependencia || '');
  }, []);

  const cancelarEdicionHoy = useCallback(() => {
    setEditandoHoyId(null);
    setEditHoyEmpleador('');
    setEditHoyDependencia('');
  }, []);

  // Guardar edición inline — OPTIMISTA: actualiza la fila y cierra el editor al
  // instante; persiste en DB y sincroniza el contexto en segundo plano.
  const guardarEdicionHoy = useCallback((id: string) => {
    const empleador = editHoyEmpleador.trim();
    const dependencia = editHoyDependencia.trim();
    // 1) UI instantánea
    setEmpleadoresHoy(prev => prev.map(r => (r.id === id ? { ...r, empleador, dependencia } : r)));
    setEditandoHoyId(null);
    // 2) Persistir + sincronizar sin bloquear el render
    setTimeout(async () => {
      try {
        const { error } = await supabase
          .from('registros')
          .update({ empleador, dependencia })
          .eq('id', id);
        if (error) throw error;
        const full = registros.find(r => r.id === id);
        if (full) {
          const updated = { ...full, empleador, dependencia };
          mutateRegistros(prev => prev.map(r => (r.id === id ? updated : r)));
          pushRegistroChange('UPDATE', updated);
        }
        setToast({ message: 'Registro actualizado', type: 'success' });
      } catch {
        setToast({ message: 'Error al actualizar el registro', type: 'error' });
      }
    }, 0);
  }, [registros, editHoyEmpleador, editHoyDependencia, mutateRegistros, pushRegistroChange]);

  // Sincronizar lista del modal reactivamente con filtros de fecha
  useEffect(() => {
    if (!showEmpleadoresHoy) return;
    const syncId = window.setTimeout(() => {
      setEmpleadoresHoy(
        registrosNuevosHoy.map(r => ({
          id: r.id,
          cuil: r.cuil,
          nombre: r.nombre,
          empleador: r.empleador || '',
          dependencia: r.dependencia || '',
        }))
      );
    }, 0);
    return () => window.clearTimeout(syncId);
  }, [showEmpleadoresHoy, registrosNuevosHoy]);


  const corregirEmpleador = useCallback(async () => {
    if (empleadoresSeleccionados.length === 0 || !empleadorCorreccion.trim()) {
      setToast({ message: 'Seleccioná al menos un empleador y escribí el nombre correcto', type: 'error' });
      return;
    }
    setUpdating(true);
    let actualizados = 0;
    let errores = 0;
    for (const emp of empleadoresSeleccionados) {
      const { error } = await supabase
        .from('registros')
        .update({ empleador: empleadorCorreccion.trim() })
        .eq('empleador', emp);
      if (error) errores++;
      else actualizados++;
    }
    setUpdating(false);
    if (errores > 0) {
      setToast({ message: `Actualizados ${actualizados}, ${errores} errores`, type: 'error' });
    } else {
      const correctedName = empleadorCorreccion.trim();
      const oldVariants = [...empleadoresSeleccionados];

      setToast({ message: `${actualizados} empleador(es) corregido(s)`, type: 'success' });
      setEmpleadoresSeleccionados([]);
      setEmpleadorCorreccion('');

      // Optimistic update: actualizar registros en DataContext directamente
      mutateRegistros(prev => prev.map(r =>
        oldVariants.includes(r.empleador ?? '') ? { ...r, empleador: correctedName } : r
      ));

      // Limpiar filtro si tenía seleccionado un empleador eliminado
      setFiltros(prev => {
        const cleaned = prev.empleador.filter(e => !oldVariants.includes(e));
        return cleaned.length !== prev.empleador.length ? { ...prev, empleador: cleaned } : prev;
      });

      // Si el modal está abierto, recargar con los nuevos datos
      if (modalOpen) {
        const variantesActualizadas = variantesConDuplicados.find(g => g.normalizado === modalGrupo)?.variantes || [];
        if (variantesActualizadas.length > 0) {
          // Recargar con las variantes actualizadas
          setTimeout(() => cargarRegistrosGrupo(variantesActualizadas, modalGrupo), 100);
        } else {
          // Si ya no hay variantes, cerrar el modal
          setModalOpen(false);
        }
      }

      // Broadcast incremental: receivers aplican el patch por valor sin refresh completo
      pushBulkPatchByField('empleador', oldVariants, { empleador: correctedName });
    }
  }, [empleadoresSeleccionados, empleadorCorreccion, mutateRegistros, pushBulkPatchByField, modalOpen, modalGrupo, variantesConDuplicados, cargarRegistrosGrupo]);

  const corregirLocalidad = useCallback(async () => {
    if (localidadesSeleccionadas.length === 0 || !localidadCorreccion.trim()) {
      setToast({ message: 'Seleccioná al menos una localidad y escribí el nombre correcto', type: 'error' });
      return;
    }
    setUpdating(true);
    let actualizados = 0;
    let errores = 0;
    for (const loc of localidadesSeleccionadas) {
      const { error } = await supabase
        .from('registros')
        .update({ localidad: localidadCorreccion.trim() })
        .eq('localidad', loc);
      if (error) errores++;
      else actualizados++;
    }
    setUpdating(false);
    if (errores > 0) {
      setToast({ message: `Actualizadas ${actualizados}, ${errores} errores`, type: 'error' });
    } else {
      const correctedName = localidadCorreccion.trim();
      const oldVars = [...localidadesSeleccionadas];
      setToast({ message: `${actualizados} localidad(es) corregida(s)`, type: 'success' });
      setLocalidadesSeleccionadas([]);
      setLocalidadCorreccion('');
      mutateRegistros(prev => prev.map(r =>
        oldVars.includes(r.localidad ?? '') ? { ...r, localidad: correctedName } : r
      ));
      pushBulkPatchByField('localidad', oldVars, { localidad: correctedName });
    }
  }, [localidadesSeleccionadas, localidadCorreccion, mutateRegistros, pushBulkPatchByField]);

  const agregarNuevaLocalidad = useCallback(async () => {
    if (!localidadCorreccion.trim()) {
      setToast({ message: 'Escribí el nombre de la nueva localidad', type: 'error' });
      return;
    }
    setUpdating(true);
    try {
      // Crear un registro dummy para que la localidad aparezca en los dropdowns
      const { error } = await supabase.from('registros').insert({
        localidad: localidadCorreccion.trim(),
        nombre: 'NUEVA LOCALIDAD',
        cuil: '00000000000',
        analista: 'Sistema',
        estado: 'derivado / rechazado cc',
        comentarios: 'Localidad agregada desde corrector',
      });
      
      if (error) throw error;
      
      setToast({ message: `Localidad "${localidadCorreccion.trim()}" creada`, type: 'success' });
      setLocalidadCorreccion('');
      pushBulkRefresh();
    } catch (err) {
      console.error(err);
      setToast({ message: 'Error al agregar localidad', type: 'error' });
    } finally {
      setUpdating(false);
    }
  }, [localidadCorreccion, pushBulkRefresh]);

  const corregirDependencia = useCallback(async () => {
    if (dependenciasSeleccionadas.length === 0 || !dependenciaCorreccion.trim()) {
      setToast({ message: 'Seleccioná al menos una dependencia y escribí el nombre correcto', type: 'error' });
      return;
    }
    setUpdating(true);
    let actualizados = 0;
    let errores = 0;
    for (const dep of dependenciasSeleccionadas) {
      const { error } = await supabase
        .from('registros')
        .update({ dependencia: dependenciaCorreccion.trim() })
        .eq('dependencia', dep);
      if (error) errores++;
      else actualizados++;
    }
    setUpdating(false);
    if (errores > 0) {
      setToast({ message: `Actualizadas ${actualizados}, ${errores} errores`, type: 'error' });
    } else {
      const correctedName = dependenciaCorreccion.trim();
      const oldVars = [...dependenciasSeleccionadas];
      setToast({ message: `${actualizados} dependencia(s) corregida(s)`, type: 'success' });
      setDependenciasSeleccionadas([]);
      setDependenciaCorreccion('');
      mutateRegistros(prev => prev.map(r =>
        oldVars.includes(r.dependencia ?? '') ? { ...r, dependencia: correctedName } : r
      ));
      pushBulkPatchByField('dependencia', oldVars, { dependencia: correctedName });
    }
  }, [dependenciasSeleccionadas, dependenciaCorreccion, mutateRegistros, pushBulkPatchByField]);

  const empleadoresUnicosFiltrados = useMemo(() => {
    const q = reasignarBusquedaOrigen.trim().toLowerCase();
    if (!q) return allEmpleadores;
    return allEmpleadores.filter(e => e.toLowerCase().includes(q));
  }, [allEmpleadores, reasignarBusquedaOrigen]);

  const dependenciasUnicasFiltradas = useMemo(() => {
    const q = reasignarBusquedaOrigen.trim().toLowerCase();
    if (!q) return allDependencias;
    return allDependencias.filter(d => d.toLowerCase().includes(q));
  }, [allDependencias, reasignarBusquedaOrigen]);

  const reasignarIds = useMemo(() => {
    if (reasignarModo === 'empleador') {
      if (!reasignarEmpOrigen) return [] as string[];
      return registros.filter(r => (r.empleador ?? '') === reasignarEmpOrigen).map(r => r.id);
    } else {
      if (!reasignarDepOrigen) return [] as string[];
      return registros.filter(r => (r.dependencia ?? '') === reasignarDepOrigen).map(r => r.id);
    }
  }, [reasignarModo, reasignarEmpOrigen, reasignarDepOrigen, registros]);

  const reasignarMasivo = useCallback(async () => {
    const origen = (reasignarModo === 'empleador' ? reasignarEmpOrigen : reasignarDepOrigen).trim();
    const empDestino = reasignarEmpDestino.trim();
    const depDestino = reasignarDepDestino.trim();

    if (!origen) {
      setToast({ message: reasignarModo === 'empleador' ? 'Elegí el empleador origen' : 'Elegí la dependencia origen', type: 'error' });
      return;
    }
    if (!empDestino && !depDestino) {
      setToast({ message: 'Definí al menos el empleador o la dependencia destino', type: 'error' });
      return;
    }
    if (reasignarIds.length === 0) {
      setToast({ message: 'No hay registros para reasignar', type: 'error' });
      return;
    }

    setUpdating(true);
    const patch: { empleador?: string; dependencia?: string } = {};
    if (empDestino) patch.empleador = empDestino;
    if (depDestino) patch.dependencia = depDestino;

    const CHUNK = 500;
    let actualizados = 0;
    let errores = 0;
    for (let i = 0; i < reasignarIds.length; i += CHUNK) {
      const slice = reasignarIds.slice(i, i + CHUNK);
      const { error } = await supabase.from('registros').update(patch).in('id', slice);
      if (error) errores++;
      else actualizados += slice.length;
    }
    setUpdating(false);

    if (errores > 0) {
      setToast({ message: `Reasignados ${actualizados}, ${errores} errores`, type: 'error' });
      return;
    }

    const idsSet = new Set(reasignarIds);
    const localPatch: Partial<Registro> = { ...patch };
    mutateRegistros(prev => prev.map(r => idsSet.has(r.id) ? { ...r, ...localPatch } : r));
    pushBulkUpdateIds(reasignarIds, localPatch);

    setToast({ message: `${actualizados} registro(s) reasignados`, type: 'success' });
    setReasignarEmpOrigen('');
    setReasignarDepOrigen('');
    setReasignarEmpDestino('');
    setReasignarDepDestino('');
    setReasignarBusquedaOrigen('');
  }, [reasignarModo, reasignarEmpOrigen, reasignarDepOrigen, reasignarEmpDestino, reasignarDepDestino, reasignarIds, mutateRegistros, pushBulkUpdateIds]);

  // ── Universo y reparto para reasignar entre analistas ──
  const raUniverso = useMemo(() => {
    if (!raOrigen) return [] as Registro[];
    const min = raScoreMin ? Number(raScoreMin) : null;
    const max = raScoreMax ? Number(raScoreMax) : null;
    return registros.filter(r => {
      if ((r.analista ?? '') !== raOrigen) return false;
      if (raEstados.length > 0 && !raEstados.includes(r.estado ?? '')) return false;
      if (min !== null && !(typeof r.puntaje === 'number' && r.puntaje >= min)) return false;
      if (max !== null && !(typeof r.puntaje === 'number' && r.puntaje <= max)) return false;
      if (raFechaDesde && (r.fecha ?? '') < raFechaDesde) return false;
      if (raFechaHasta && (r.fecha ?? '') > raFechaHasta) return false;
      return true;
    });
  }, [registros, raOrigen, raEstados, raScoreMin, raScoreMax, raFechaDesde, raFechaHasta]);

  const raTotalDisponible = raUniverso.length;

  const raAsignadosPorDestino = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const dest of raAsignaciones.values()) acc[dest] = (acc[dest] ?? 0) + 1;
    return acc;
  }, [raAsignaciones]);

  const raTotalCuotas = useMemo(
    () => raDestinos.reduce((s, d) => s + (d.cuota || 0), 0),
    [raDestinos],
  );

  const raAgregarDestino = useCallback(() => {
    const nombre = raNuevoDestino.trim();
    const cuota = Number(raNuevaCuota);
    if (!nombre) { setToast({ message: 'Elegí un analista destino', type: 'error' }); return; }
    if (nombre === raOrigen) { setToast({ message: 'El destino no puede ser el origen', type: 'error' }); return; }
    if (raDestinos.some(d => d.analista === nombre)) { setToast({ message: 'Ese destino ya está agregado', type: 'error' }); return; }
    if (!Number.isFinite(cuota) || cuota <= 0) { setToast({ message: 'Cuota inválida', type: 'error' }); return; }
    if (raTotalCuotas + cuota > raTotalDisponible) { setToast({ message: `La suma de cuotas (${raTotalCuotas + cuota}) supera los ${raTotalDisponible} disponibles`, type: 'error' }); return; }
    setRaDestinos(prev => [...prev, { analista: nombre, cuota }]);
    setRaDestinoActivo(prev => prev || nombre);
    setRaNuevoDestino('');
    setRaNuevaCuota('');
  }, [raNuevoDestino, raNuevaCuota, raOrigen, raDestinos, raTotalCuotas, raTotalDisponible]);

  const raAgregarMulti = useCallback(() => {
    const entries = Object.entries(raMultiCant)
      .filter(([a]) => a !== raOrigen && !raDestinos.some(d => d.analista === a))
      .map(([a, c]) => ({ analista: a, cuota: Number(c) }));
    if (entries.length === 0) { setToast({ message: 'Elegí al menos un analista', type: 'error' }); return; }
    const invalidas = entries.filter(d => !Number.isFinite(d.cuota) || d.cuota <= 0);
    if (invalidas.length > 0) { setToast({ message: `Poné una cantidad válida para: ${invalidas.map(d => d.analista).join(', ')}`, type: 'error' }); return; }
    const suma = entries.reduce((s, d) => s + d.cuota, 0);
    if (raTotalCuotas + suma > raTotalDisponible) { setToast({ message: `La suma (${raTotalCuotas + suma}) supera los ${raTotalDisponible} disponibles`, type: 'error' }); return; }
    setRaDestinos(prev => [...prev, ...entries]);
    setRaDestinoActivo(prev => prev || entries[0].analista);
    setRaMultiCant({});
  }, [raMultiCant, raOrigen, raDestinos, raTotalCuotas, raTotalDisponible]);

  const raQuitarDestino = useCallback((analista: string) => {
    setRaDestinos(prev => prev.filter(d => d.analista !== analista));
    setRaAsignaciones(prev => {
      const next = new Map(prev);
      for (const [id, dest] of next) if (dest === analista) next.delete(id);
      return next;
    });
    setRaDestinoActivo(prev => (prev === analista ? '' : prev));
  }, []);

  const raToggleFila = useCallback((id: string) => {
    if (!raDestinoActivo) { setToast({ message: 'Elegí primero un destino activo', type: 'error' }); return; }
    setRaAsignaciones(prev => {
      const next = new Map(prev);
      const actual = next.get(id);
      if (actual === raDestinoActivo) { next.delete(id); return next; }
      // Respetar la cuota del destino activo
      const cuota = raDestinos.find(d => d.analista === raDestinoActivo)?.cuota ?? 0;
      const yaAsignados = Array.from(next.values()).filter(v => v === raDestinoActivo).length;
      if (actual === undefined && yaAsignados >= cuota) {
        setToast({ message: `${raDestinoActivo} ya llegó a su cuota (${cuota})`, type: 'error' });
        return next;
      }
      next.set(id, raDestinoActivo);
      return next;
    });
  }, [raDestinoActivo, raDestinos]);

  const raTildarPrimerosN = useCallback(() => {
    if (!raDestinoActivo) { setToast({ message: 'Elegí primero un destino activo', type: 'error' }); return; }
    const cuota = raDestinos.find(d => d.analista === raDestinoActivo)?.cuota ?? 0;
    setRaAsignaciones(prev => {
      const next = new Map(prev);
      let asignados = Array.from(next.values()).filter(v => v === raDestinoActivo).length;
      for (const r of raUniverso) {
        if (asignados >= cuota) break;
        if (!next.has(r.id)) { next.set(r.id, raDestinoActivo); asignados++; }
      }
      return next;
    });
  }, [raDestinoActivo, raDestinos, raUniverso]);

  const raGuardar = useCallback(async () => {
    if (raAsignaciones.size === 0) { setToast({ message: 'No hay registros asignados', type: 'error' }); return; }
    // Agrupar ids por destino
    const grupos: Record<string, string[]> = {};
    for (const [id, dest] of raAsignaciones) (grupos[dest] ??= []).push(id);

    setUpdating(true);
    const infoById = new Map(raUniverso.map(r => [r.id, r]));
    const idAnalista = getSession()?.username ?? '';
    const ahora = new Date().toISOString();
    const CHUNK = 500;
    let actualizados = 0;
    let errores = 0;
    for (const [analista, ids] of Object.entries(grupos)) {
      for (let i = 0; i < ids.length; i += CHUNK) {
        const slice = ids.slice(i, i + CHUNK);
        const { error } = await supabase.from('registros').update({ analista }).in('id', slice);
        if (error) { errores += slice.length; continue; }
        actualizados += slice.length;
        const sliceSet = new Set(slice);
        mutateRegistros(prev => prev.map(r => (sliceSet.has(r.id) ? { ...r, analista } : r)));
        pushBulkUpdateIds(slice, { analista });

        // Auditoría: una fila por registro reasignado (insert en bloque, sin broadcast por fila)
        const auditRows = slice.map(id => {
          const reg = infoById.get(id);
          return {
            accion: 'Reasignación',
            campo_modificado: 'Analista',
            valor_anterior: raOrigen,
            valor_nuevo: analista,
            analista,
            id_analista: idAnalista,
            id_registro: id,
            nombre: reg?.nombre ?? '',
            cuil: reg?.cuil ?? '',
            fecha_hora: ahora,
          };
        });
        supabase.from('auditoria').insert(auditRows).then(({ error: auditErr }) => {
          if (auditErr) console.error('[Auditoría] Error al registrar reasignación:', auditErr.message);
        });
      }
    }
    setUpdating(false);

    if (errores > 0) {
      setToast({ message: `Reasignados ${actualizados}, ${errores} con error`, type: 'error' });
      return;
    }
    setToast({ message: `${actualizados} registro(s) reasignados`, type: 'success' });
    // Reset
    setRaOrigen('');
    setRaEstados([]);
    setRaScoreMin(''); setRaScoreMax('');
    setRaFechaDesde(''); setRaFechaHasta('');
    setRaDestinos([]);
    setRaAsignaciones(new Map());
    setRaDestinoActivo('');
  }, [raAsignaciones, raUniverso, raOrigen, mutateRegistros, pushBulkUpdateIds]);

  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }
  }, [toast]);


  const previewRecords = useCallback(async () => {
    const buildQuery = () => {
      // `.order('id')` no es cosmético: esta consulta se pagina con `.range()` y
      // sin ORDER BY el subconjunto que devuelve cada página es indefinido. Como
      // los ids se acumulan en un Set, el síntoma no serían duplicados visibles
      // sino filas OMITIDAS: `previewCount` quedaría por debajo del real y la
      // modificación masiva se aplicaría a menos registros de los previstos.
      // Aquí el orden no tiene ningún significado funcional (sólo se recogen
      // ids), así que la PK sola alcanza y es el orden determinista más barato.
      let q = supabase.from('registros').select('id').order('id', { ascending: true });
      q = applyChipFilter(q, 'estado', filtros.estados);
      q = applyChipFilter(q, 'analista', filtros.analistas);
      q = applyChipFilter(q, 'acuerdo_precios', filtros.acuerdoPrecios);
      q = applyChipFilter(q, 'tipo_cliente', filtros.tipoCliente);
      q = applyChipFilter(q, 'rango_etario', filtros.rangoEtario);
      q = applyChipFilter(q, 'sexo', filtros.sexo);
      q = applyChipFilter(q, 'localidad', filtros.localidad);
      q = applyChipFilter(q, 'empleador', filtros.empleador);
      if (filtros.esRe === 'si') q = q.eq('es_re', true);
      if (filtros.esRe === 'no') q = q.eq('es_re', false);
      if (filtros.scoreMin) q = q.gte('puntaje', Number(filtros.scoreMin));
      if (filtros.scoreMax) q = q.lte('puntaje', Number(filtros.scoreMax));
      if (filtros.montoMin) q = q.gte('monto', Number(filtros.montoMin));
      if (filtros.montoMax) q = q.lte('monto', Number(filtros.montoMax));
      if (filtros.fechaDesde) q = q.gte('fecha', filtros.fechaDesde);
      if (filtros.fechaHasta) q = q.lte('fecha', filtros.fechaHasta);
      if (filtros.search) {
        const s = filtros.search.toLowerCase();
        q = q.or(`nombre.ilike.%${s}%,cuil.ilike.%${s}%,empleador.ilike.%${s}%,estado.ilike.%${s}%,analista.ilike.%${s}%,localidad.ilike.%${s}%,comentarios.ilike.%${s}%`);
      }
      return q;
    };

    // Paginar para superar el límite de 1000 filas de Supabase
    const PAGE = 1000;
    const ids = new Set<string>();
    let from = 0;
    while (true) {
      const { data, error } = await buildQuery().range(from, from + PAGE - 1);
      if (error) {
        setToast({ message: `Error: ${error.message}`, type: 'error' });
        return;
      }
      if (!data || data.length === 0) break;
      for (const r of data) ids.add(r.id);
      if (data.length < PAGE) break;
      from += PAGE;
    }

    setPreviewIds(ids);
    setPreviewCount(ids.size);
    setStep('confirm');
  }, [filtros]);

  const [undoState, setUndoState] = useState<{ id: string; updates: Record<string, unknown> }[] | null>(null);
  const [undoing, setUndoing] = useState(false);

  const handleUndo = async () => {
    if (!undoState) return;
    setUndoing(true);
    
    // Group updates to minimize Supabase calls
    const groups: Record<string, { updates: Record<string, unknown>, ids: string[] }> = {};
    for (const item of undoState) {
       const key = JSON.stringify(item.updates);
       if (!groups[key]) groups[key] = { updates: item.updates, ids: [] };
       groups[key].ids.push(item.id);
    }

    let restored = 0;
    const BATCH_SIZE = 500;
    for (const group of Object.values(groups)) {
       for (let i = 0; i < group.ids.length; i += BATCH_SIZE) {
          const batch = group.ids.slice(i, i + BATCH_SIZE);
          const { error } = await supabase.from('registros').update(group.updates).in('id', batch);
          if (!error) restored += batch.length;
       }
    }

    setUndoing(false);
    setUndoState(null);
    setUpdatedCount(0);
    refresh(true);
    pushBulkRefresh();
    setToast({ message: `Se restauraron ${restored} registros a su estado anterior.`, type: 'success' });
    setStep('filter');
  };

  const handleUpdate = async () => {
    setUpdating(true);
    let updated = 0;

    // Construir el payload solo con campos que tienen valor
    // SIN_ESPECIFICAR → null (borra el valor en la DB)
    const sinEsp = (v: string) => v === SIN_ESPECIFICAR ? null : v;
    const updates: Record<string, unknown> = {};
    if (campos.estado) updates.estado = sinEsp(campos.estado);
    if (campos.analista) updates.analista = sinEsp(campos.analista);
    if (campos.acuerdo_precios) updates.acuerdo_precios = sinEsp(campos.acuerdo_precios);
    if (campos.tipo_cliente) updates.tipo_cliente = sinEsp(campos.tipo_cliente);
    if (campos.cuotas) updates.cuotas = campos.cuotas;
    if (campos.rango_etario) updates.rango_etario = sinEsp(campos.rango_etario);
    if (campos.sexo) updates.sexo = sinEsp(campos.sexo);
    if (campos.empleador) updates.empleador = campos.empleador;
    if (campos.localidad) updates.localidad = sinEsp(campos.localidad);
    if (campos.es_re === 'si') updates.es_re = true;
    if (campos.es_re === 'no') updates.es_re = false;
    if (campos.comentarios) updates.comentarios = campos.comentarios;

    if (Object.keys(updates).length === 0) {
      setToast({ message: 'Debes seleccionar al menos un campo para modificar', type: 'error' });
      setUpdating(false);
      return;
    }

    // -- Undo Backup --
    const keysToBackup = Object.keys(updates) as (keyof Registro)[];
    // P-D: un indice por id (O(n)) en lugar de un .find por preview (O(k*n)).
    // first-wins replica .find; ids ausentes siguen dando undefined.
    const registrosById = new Map<string, Registro>();
    for (const r of registros) if (!registrosById.has(r.id)) registrosById.set(r.id, r);
    const backup = Array.from(previewIds).map(id => {
       const oldReg = registrosById.get(id);
       const oldUpdates: Record<string, unknown> = {};
       keysToBackup.forEach(k => {
          oldUpdates[k] = oldReg ? (oldReg[k] ?? null) : null;
       });
       return { id, updates: oldUpdates };
    });
    setUndoState(backup);

    // Usar update masivo con .in() en lugar de uno por uno
    const idArray = Array.from(previewIds);
    // Supabase tiene límite de ~2000 IDs en un .in(), hacer en batches
    const BATCH_SIZE = 500;
    for (let i = 0; i < idArray.length; i += BATCH_SIZE) {
      const batch = idArray.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from('registros')
        .update(updates)
        .in('id', batch);
      if (!error) updated += batch.length;
    }

    setUpdating(false);
    setUpdatedCount(updated);
    setStep('done');
    // Actualizar estado local y notificar a otros tabs
    refresh(true);
    pushBulkRefresh();
  };

  const resetAll = () => {
    setFiltros(EMPTY_FILTROS);
    setCampos(EMPTY_CAMPOS);
    setPreviewCount(0);
    setPreviewIds(new Set());
    setStep('filter');
    setUpdatedCount(0);
  };

  return (
    <div className={[styles["uWidth100"]].join(' ')}>
      {toast && (
        <div className={[styles["uPositionFixed"], styles["uBottom24px"], styles["uRight24px"], styles["uZIndex9999"]].join(' ')}>
          <div className={[styles["uDisplayFlex"], styles["uAlignItemsCenter"], styles["uGap10px"], styles["uPadding12px-18px"], styles["uBorderRadius8px"], styles["uFontSize13px"], styles["uFontWeight600"]].join(' ')} style={{ background: toast.type === 'success' ? 'rgba(0, 255, 136, 0.15)' : 'rgba(239,68,68,0.15)', border: `1px solid ${toast.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`, color: toast.type === 'success' ? '#34d399' : '#ff3366' }}>
            {toast.type === 'success' ? <CheckCircle size={15} /> : <AlertTriangle size={15} />}
            {toast.message}
          </div>
        </div>
      )}

      <div className={`data-card ${styles.bulkRoot}${mode === 'excel' ? ` ${styles.isExcel}` : ''}${mode === 'bulk' ? ` ${styles.isBulk}` : ''}`}>
        {mode === 'corrector' && (
        <div className={styles.correctorHeader}>
          <div>
            <h3 className={styles.correctorTitle}>
              <ShieldCheck size={20} className={styles.correctorIcon} />
              Corrector
            </h3>
            <p className={styles.correctorSubtitle}>
              Detecta y corrige variantes de nombres para unificar la base
            </p>
          </div>
          <div className={styles.headerActions}>
            <button
              onClick={cargarEmpleadoresHoy}
              disabled={loadingEmpleadoresHoy}
              className={styles.pillButton}
            >
              {loadingEmpleadoresHoy ? <Loader2 size={12} /> : <Users size={12} />}
              Nuevos hoy
              {contadorNuevosHoy > 0 && (
                <span className={styles.pillCount}>
                  {contadorNuevosHoy}
                </span>
              )}
            </button>
            <div
              className={`${styles.statusPill}${variantesConDuplicados.length > 0 ? ` ${styles.isAlert}` : ''}`}
            >
              {variantesConDuplicados.length > 0 ? <AlertTriangle size={12} /> : <CheckCircle size={12} />}
              {variantesConDuplicados.length > 0
                ? `${variantesConDuplicados.length} variante${variantesConDuplicados.length > 1 ? 's' : ''} con duplicado${variantesConDuplicados.length > 1 ? 's' : ''}`
                : 'Sin duplicados'}
            </div>
            <button
              onClick={resetAll}
              className={styles.resetButton}
            >
              <X size={12} /> Resetear
            </button>
          </div>
        </div>
        )}

        {/* ── CORRECTOR DE EMPLEADOR ────────────────────────────────────────── */}
        {mode === 'corrector' && (
          <div className={`${styles.section}${variantesConDuplicados.length > 0 ? ` ${styles.isAlert}` : ''}`}>
          <div
            onClick={() => setCorrectorExpandido(!correctorExpandido)}
            className={`${styles.sectionToggle}${correctorExpandido ? ` ${styles.isExpanded}` : ''}`}
          >
            {variantesConDuplicados.length > 0
              ? <AlertTriangle size={18} color="#ff3366" />
              : <CheckCircle size={18} color="#555" />}
            <h4 className={`${styles.sectionTitle}${variantesConDuplicados.length > 0 ? ` ${styles.isAlert}` : ''}`}>
              {variantesConDuplicados.length > 0
                ? `Corrector de Empleador — ${variantesConDuplicados.length} grupos para corregir`
                : 'Corrector de Empleador — Sin duplicados'}
              {correctorExpandido ? <ChevronUp size={14} className={styles.chevron} /> : <ChevronDown size={14} className={styles.chevron} />}
            </h4>
            <div
              className={styles.sectionActions}
              onClick={(e) => e.stopPropagation()}
            >
              {gruposDescartados.size > 0 && (
                <button
                  onClick={restaurarDescartados}
                  className={`${styles.ghostButton} ${styles.ghostButtonInfo}`}
                >
                  Restaurar {gruposDescartados.size} descartado{gruposDescartados.size > 1 ? 's' : ''}
                </button>
              )}
              <button
                onClick={() => cargarTodosEmpleadores()}
                className={`${styles.ghostButton} ${styles.ghostButtonWarning}`}
              >
                <Users size={10} /> Ver todos ({allEmpleadores.length})
              </button>
            </div>
          </div>

          {correctorExpandido && (
            <>

          <div className={styles.fieldGrid}>
            <div>
              <label className={styles.label}>
                Nombre correcto
              </label>
              <input
                className={`form-input ${styles.darkInput}`}
                placeholder="Ej: MUNICIPALIDAD DE PARANA"
                value={empleadorCorreccion}
                onChange={e => setEmpleadorCorreccion(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && corregirEmpleador()}
              />
            </div>
          </div>

          <div className={styles.actionRow}>
            <button
              onClick={corregirEmpleador}
              disabled={updating || empleadoresSeleccionados.length === 0 || !empleadorCorreccion.trim()}
              className={styles.correctButton}
            >
              {updating ? 'CORRIGIENDO...' : `CORREGIR ${empleadoresSeleccionados.length} EMPLEADOR(ES)`}
            </button>
            <input
              className={`form-input ${styles.darkInputFlex}`}
              placeholder="Buscar empleador..."
              value={busquedaEmpleador}
              onChange={e => setBusquedaEmpleador(e.target.value)}
            />
          </div>

          {empleadoresSeleccionados.length > 0 && (
            <div className={styles.hint}>
              Seleccionados: {empleadoresSeleccionados.length} — {empleadorCorreccion || '(sin nombre correcto)'}
            </div>
          )}

          {/* Lista de variantes detectadas */}
          {variantesFiltradas.length > 0 ? (
            <div className={styles.scrollArea}>
              {variantesFiltradas.map((v, i) => {
                // 1) Detección de duplicados dentro de este grupo
                const keyCounts = new Map<string, number>();
                for (const item of v.variantes) {
                  const k = simplificarParaDuplicados(item);
                  if (k) keyCounts.set(k, (keyCounts.get(k) || 0) + 1);
                }
                const normCounts = new Map<string, number>();
                for (const item of v.variantes) {
                  const norm = normalizar(item);
                  if (norm && norm !== 'Sin dato') normCounts.set(norm, (normCounts.get(norm) || 0) + 1);
                }

                const dupsSet = new Set<string>();
                for (const item of v.variantes) {
                  const k = simplificarParaDuplicados(item);
                  const norm = normalizar(item);
                  if ((k && (keyCounts.get(k) || 0) > 1) || (norm && norm !== 'Sin dato' && (normCounts.get(norm) || 0) > 1)) {
                    dupsSet.add(item);
                  }
                }

                // 2) Ordenar: variantes duplicadas (verdes) primero, luego el resto
                const variantesOrdenadas = [...v.variantes].sort((a, b) => {
                  const aDup = dupsSet.has(a) ? 0 : 1;
                  const bDup = dupsSet.has(b) ? 0 : 1;
                  if (aDup !== bDup) return aDup - bDup;
                  return a.localeCompare(b);
                });

                const tieneDuplicados = dupsSet.size > 0;

                return (
                  <div key={i} className={`${styles.variantGroup} ${tieneDuplicados ? styles.hasDuplicates : ''}`}>
                    <div className={styles.variantGroupHeader}>
                      <div className={styles.variantGroupTitle}>
                        {v.normalizado} <span className={styles.mutedNote}>({v.cantidad} variantes)</span>
                        {tieneDuplicados && (
                          <span className={styles.duplicateBadge}>
                            {dupsSet.size} DUPLICADOS DETECTADOS
                          </span>
                        )}
                      </div>
                      <div className={styles.variantGroupActions}>
                        {tieneDuplicados && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const dups = Array.from(dupsSet);
                              setEmpleadoresSeleccionados(dups);
                              const sugerido = [...dups].sort((a, b) => b.length - a.length)[0];
                              if (sugerido) setEmpleadorCorreccion(sugerido);
                            }}
                            title="Seleccionar todas las variantes duplicadas de este grupo"
                            className={`${styles.variantAction} ${styles.isPrimary}`}
                          >
                            <CheckCircle size={10} /> Elegir duplicados ({dupsSet.size})
                          </button>
                        )}
                        {v.cantidad > 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              cargarRegistrosGrupo(v.variantes, v.normalizado);
                            }}
                            title="Ver todos los registros de este grupo"
                            className={styles.variantAction}
                          >
                            <Users size={10} /> Ver {v.cantidad}
                          </button>
                        )}
                        {v.cantidad > 1 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); descartarGrupo(v.normalizado, v.cantidad); }}
                            title="Marcar como correcto — no es un duplicado real"
                            className={styles.variantAction}
                          >
                            <CheckCircle size={10} /> OK
                          </button>
                        )}
                      </div>
                    </div>
                    <div className={styles.chipRow}>
                      {variantesOrdenadas.map((varName, j) => (
                        <VarianteChip
                          key={j}
                          label={varName}
                          isDuplicate={dupsSet.has(varName)}
                          selected={empleadoresSeleccionados.includes(varName)}
                          onToggle={() => setEmpleadoresSeleccionados(prev =>
                            prev.includes(varName) ? prev.filter(x => x !== varName) : [...prev, varName]
                          )}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <p>{busquedaEmpleador ? 'No se encontraron resultados.' : 'No se detectaron empleadores con múltiples variantes.'}</p>
              {busquedaEmpleador && (
                <p className={[styles["uFontSize11px"], styles["uMarginTop8px"], styles["uColorText-muted"]].join(' ')}>
                  Intentá con otro término.
                </p>
              )}
            </div>
          )}
            </>
          )}
        </div>
      )}

      {/* ── CORRECTOR DE LOCALIDAD ──────────────────────────────────────────── */}
      {mode === 'corrector' && (
        <div className={styles.section}>
          <div
            onClick={() => setCorrectorLocalidadExpandido(!correctorLocalidadExpandido)}
            className={`${styles.sectionToggle}${correctorLocalidadExpandido ? ` ${styles.isExpanded}` : ''}`}
          >
            <CheckCircle size={18} color="#555" />
            <h4 className={styles.sectionTitle}>
              Corrector de Localidad
              {correctorLocalidadExpandido ? <ChevronUp size={14} className={styles.chevron} /> : <ChevronDown size={14} className={styles.chevron} />}
            </h4>
            {gruposLocalidadDescartados.size > 0 && (
              <div className={styles.sectionActionsEnd} onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={restaurarDescartadosLocalidad}
                  className={`${styles.ghostButton} ${styles.ghostButtonInfo}`}
                >
                  Restaurar {gruposLocalidadDescartados.size} descartado{gruposLocalidadDescartados.size > 1 ? 's' : ''}
                </button>
              </div>
            )}
          </div>

          {correctorLocalidadExpandido && (
            <>
              <div className={styles.fieldGrid}>
                <div>
                  <label className={styles.label}>
                    Nombre correcto
                  </label>
                  <input
                    className={`form-input ${styles.darkInput}`}
                    placeholder="Ej: PARANA"
                    value={localidadCorreccion}
                    onChange={e => setLocalidadCorreccion(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && corregirLocalidad()}
                  />
                </div>
              </div>

              <div className={styles.actionRow}>
                <button
                  onClick={corregirLocalidad}
                  disabled={updating || localidadesSeleccionadas.length === 0 || !localidadCorreccion.trim()}
                  className={styles.correctButton}
                >
                  {updating ? 'CORRIGIENDO...' : `CORREGIR ${localidadesSeleccionadas.length} LOCALIDAD(ES)`}
                </button>
                <button
                  onClick={() => {
                    if (!localidadCorreccion.trim()) {
                      setToast({ message: 'Escribí el nombre de la nueva localidad', type: 'error' });
                      return;
                    }
                    agregarNuevaLocalidad();
                  }}
                  disabled={updating || !localidadCorreccion.trim()}
                  className={[styles["uBorder1px-solid-rgba-16-185-129-0-3"], styles["uBorderRadius6px"], styles["uPadding10px-24px"], styles["uFontSize11px"], styles["uFontWeight900"], styles["uTextTransformUppercase"], styles["uLetterSpacing1px"], styles["uFlexShrink0"]].join(' ')} style={{ background: (!localidadCorreccion.trim()) ? '#333' : 'rgba(0, 255, 136, 0.15)', color: (!localidadCorreccion.trim()) ? '#666' : '#34d399', cursor: (!localidadCorreccion.trim()) ? 'not-allowed' : 'pointer' }}
                >
                  AGREGAR NUEVA LOCALIDAD
                </button>
                <input
                  className={`form-input ${styles.darkInputFlex}`}
                  placeholder="Buscar localidad..."
                  value={busquedaLocalidad}
                  onChange={e => setBusquedaLocalidad(e.target.value)}
                />
              </div>

              {localidadesSeleccionadas.length > 0 && (
                <div className={styles.hint}>
                  Seleccionadas: {localidadesSeleccionadas.length} — {localidadCorreccion || '(sin nombre correcto)'}
                </div>
              )}

              {/* Lista de localidades */}
              {(listaLocalidadess.length > 0 || busquedaLocalidad.trim()) ? (
                <div className={styles.scrollArea}>
                  {listaLocalidadess.map((v, i) => (
                    <div key={i} className={[styles["uMarginBottom12px"], styles["uPadding12px-14px"], styles["uBackgroundSurface-sunken"], styles["uBorderRadius8px"], styles["uBorder1px-solid-border-subtle"]].join(' ')}>
                      <div className={[styles["uDisplayFlex"], styles["uAlignItemsCenter"], styles["uJustifyContentSpace-between"], styles["uMarginBottom6px"]].join(' ')}>
                        <div className={[styles["uFontSize11px"], styles["uColorFbbf24"], styles["uFontWeight800"], styles["uTextTransformUppercase"]].join(' ')}>
                          {v.normalizado} <span className={styles.mutedNote}>({v.cantidad} variantes)</span>
                        </div>
                        <div className={[styles["uDisplayFlex"], styles["uGap6px"], styles["uFlexShrink0"]].join(' ')}>
                          {v.cantidad > 1 && (
                            <button
                              onClick={(e) => { e.stopPropagation(); descartarGrupoLocalidad(v.normalizado); }}
                              title="Marcar como correcto"
                              className={[styles["uBackgroundRgba-16-185-129-0-1"], styles["uBorder1px-solid-rgba-16-185-129-0-3"], styles["uColor34d399"], styles["uBorderRadius4px"], styles["uPadding2px-8px"], styles["uFontSize9px"], styles["uFontWeight800"], styles["uCursorPointer"], styles["uTextTransformUppercase"], styles["uLetterSpacing0-5px"], styles["uDisplayFlex"], styles["uAlignItemsCenter"], styles["uGap4px"]].join(' ')}
                            >
                              <CheckCircle size={10} /> OK
                            </button>
                          )}
                        </div>
                      </div>
                      <div className={styles.chipRow}>
                        {v.variantes.map((varName, j) => (
                          <VarianteChip
                            key={j}
                            label={varName}
                            selected={localidadesSeleccionadas.includes(varName)}
                            onToggle={() => setLocalidadesSeleccionadas(prev =>
                              prev.includes(varName) ? prev.filter(x => x !== varName) : [...prev, varName]
                            )}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.emptyState}>
                  <p>{busquedaLocalidad ? 'No se encontraron resultados.' : 'No hay localidades en la base.'}</p>
                  {busquedaLocalidad && (
                    <p className={[styles["uFontSize11px"], styles["uMarginTop8px"], styles["uColorText-muted"]].join(' ')}>
                      Intentá con otro término.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── CORRECTOR DE DEPENDENCIA ──────────────────────────────────────────── */}
      {mode === 'corrector' && (
        <div className={styles.section}>
          <div
            onClick={() => setCorrectorDependenciaExpandido(!correctorDependenciaExpandido)}
            className={`${styles.sectionToggle}${correctorDependenciaExpandido ? ` ${styles.isExpanded}` : ''}`}
          >
            <CheckCircle size={18} color="#555" />
            <h4 className={styles.sectionTitle}>
              Corrector de Dependencia
              {correctorDependenciaExpandido ? <ChevronUp size={14} className={styles.chevron} /> : <ChevronDown size={14} className={styles.chevron} />}
            </h4>
          </div>

          {correctorDependenciaExpandido && (
            <>
              <div className={styles.fieldGrid}>
                <div>
                  <label className={styles.label}>
                    Nombre correcto
                  </label>
                  <input
                    className={`form-input ${styles.darkInput}`}
                    placeholder="Ej: Subsecretaría de Servicios Públicos"
                    value={dependenciaCorreccion}
                    onChange={e => setDependenciaCorreccion(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && corregirDependencia()}
                  />
                </div>
              </div>

              <div className={styles.actionRow}>
                <button
                  onClick={corregirDependencia}
                  disabled={updating || dependenciasSeleccionadas.length === 0 || !dependenciaCorreccion.trim()}
                  className={styles.correctButton}
                >
                  {updating ? 'CORRIGIENDO...' : `CORREGIR ${dependenciasSeleccionadas.length} DEPENDENCIA(S)`}
                </button>
                <input
                  className={`form-input ${styles.darkInputFlex}`}
                  placeholder="Buscar dependencia..."
                  value={busquedaDependencia}
                  onChange={e => setBusquedaDependencia(e.target.value)}
                />
              </div>

              {dependenciasSeleccionadas.length > 0 && (
                <div className={styles.hint}>
                  Seleccionadas: {dependenciasSeleccionadas.length} — {dependenciaCorreccion || '(sin nombre correcto)'}
                </div>
              )}

              {(listaDependencias.length > 0 || busquedaDependencia.trim()) ? (
                <div className={styles.scrollArea}>
                  {listaDependencias.map((v, i) => (
                    <div key={i} className={[styles["uMarginBottom12px"], styles["uPadding12px-14px"], styles["uBackgroundSurface-sunken"], styles["uBorderRadius8px"], styles["uBorder1px-solid-border-subtle"]].join(' ')}>
                      <div className={[styles["uFontSize11px"], styles["uColorFbbf24"], styles["uFontWeight800"], styles["uTextTransformUppercase"], styles["uMarginBottom6px"]].join(' ')}>
                        {v.normalizado} {v.cantidad > 1 && <span className={styles.mutedNote}>({v.cantidad} variantes)</span>}
                      </div>
                      <div className={styles.chipRow}>
                        {v.variantes.map((varName, j) => (
                          <VarianteChip
                            key={j}
                            label={varName}
                            selected={dependenciasSeleccionadas.includes(varName)}
                            onToggle={() => setDependenciasSeleccionadas(prev =>
                              prev.includes(varName) ? prev.filter(x => x !== varName) : [...prev, varName]
                            )}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.emptyState}>
                  <p>{busquedaDependencia ? 'No se encontraron resultados.' : 'No hay dependencias en la base.'}</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── REASIGNADOR MASIVO ────────────────────────────────────────────── */}
      {mode === 'corrector' && (
        <div className={[styles["uMarginBottom28px"], styles["uPadding20px"], styles["uBackgroundSurface-sunken"], styles["uBorder1px-solid-border-subtle"], styles["uBorderRadius10px"]].join(' ')}>
          <div
            onClick={() => setReasignadorExpandido(!reasignadorExpandido)}
            className={[styles["uDisplayFlex"], styles["uAlignItemsCenter"], styles["uGap10px"], styles["uCursorPointer"]].join(' ')} style={{ marginBottom: reasignadorExpandido ? 16 : 0 }}
          >
            <Filter size={18} color="#555" />
            <h4 className={[styles["uFontSize14px"], styles["uFontWeight800"], styles["uColorText-muted"], styles["uTextTransformUppercase"], styles["uDisplayFlex"], styles["uAlignItemsCenter"], styles["uGap8px"]].join(' ')}>
              Reasignar Empleador / Dependencia
              {reasignadorExpandido ? <ChevronUp size={14} className={[styles["uOpacity0-5"]].join(' ')} /> : <ChevronDown size={14} className={[styles["uOpacity0-5"]].join(' ')} />}
            </h4>
          </div>

          {reasignadorExpandido && (
            <>
              <div className={[styles["uFontSize11px"], styles["uColorText-muted"], styles["uMarginBottom16px"], styles["uLineHeight1-5"]].join(' ')}>
                Filtrá registros por empleador o dependencia actual y reasignalos a un nuevo empleador y/o dependencia.
              </div>

              {/* Toggle modo origen */}
              <div className={[styles["uDisplayFlex"], styles["uGap6px"], styles["uMarginBottom12px"]].join(' ')}>
                {([{ key: 'empleador' as const, label: 'Por empleador' }, { key: 'dependencia' as const, label: 'Por dependencia' }]).map(({ key, label }) => {
                  const activo = reasignarModo === key;
                  return (
                    <button
                      key={key}
                      onClick={() => { setReasignarModo(key); setReasignarEmpOrigen(''); setReasignarDepOrigen(''); setReasignarBusquedaOrigen(''); }}
                      className={[styles["uBorderRadius4px"], styles["uPadding4px-12px"], styles["uFontSize10px"], styles["uFontWeight800"], styles["uCursorPointer"], styles["uTextTransformUppercase"], styles["uLetterSpacing0-5px"]].join(' ')} style={{ background: activo ? 'var(--brand-muted-soft)' : 'var(--surface-card)', border: `1px solid ${activo ? 'var(--control-border-focus)' : 'var(--border-subtle)'}`, color: activo ? 'var(--action-primary)' : 'var(--text-muted)' }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* Paso 1: elegir origen */}
              <div className={[styles["uMarginBottom16px"]].join(' ')}>
                <label className={styles.label}>
                  1) {reasignarModo === 'empleador' ? 'Empleador origen' : 'Dependencia origen'}
                </label>
                <input
                  className={[`form-input ${styles.darkInput}`, styles["uMarginBottom8px"]].filter(Boolean).join(' ')}
                  placeholder={reasignarModo === 'empleador' ? 'Buscar empleador...' : 'Buscar dependencia...'}
                  value={reasignarBusquedaOrigen}
                  onChange={e => setReasignarBusquedaOrigen(e.target.value)}
                />
                <div className={[styles["uMaxHeight180px"], styles["uOverflowYAuto"], styles["uBackgroundSurface-sunken"], styles["uBorder1px-solid-border-subtle"], styles["uBorderRadius8px"], styles["uPadding8px"]].join(' ')}>
                  {reasignarModo === 'empleador' ? (
                    empleadoresUnicosFiltrados.length === 0 ? (
                      <div className={[styles["uColorText-muted"], styles["uFontSize12px"], styles["uPadding8px"]].join(' ')}>Sin resultados.</div>
                    ) : (
                      <div className={styles.chipRow}>
                        {empleadoresUnicosFiltrados.slice(0, 200).map(emp => {
                          const sel = reasignarEmpOrigen === emp;
                          const count = registros.filter(r => (r.empleador ?? '') === emp).length;
                          return (
                            <span
                              key={emp}
                              onClick={() => setReasignarEmpOrigen(sel ? '' : emp)}
                              className={[styles["uPadding4px-10px"], styles["uBorderRadius4px"], styles["uFontSize11px"], styles["uFontWeight600"], styles["uCursorPointer"]].join(' ')} style={{ background: sel ? 'var(--brand-muted-soft)' : 'var(--surface-card)', border: sel ? '1px solid var(--control-border-focus)' : '1px solid var(--border-subtle)', color: sel ? 'var(--action-primary)' : 'var(--text-secondary)' }}
                            >
                              {emp} <span style={{ color: sel ? 'var(--action-primary)' : 'var(--text-muted)' }}>({count})</span>
                            </span>
                          );
                        })}
                      </div>
                    )
                  ) : (
                    dependenciasUnicasFiltradas.length === 0 ? (
                      <div className={[styles["uColorText-muted"], styles["uFontSize12px"], styles["uPadding8px"]].join(' ')}>Sin resultados.</div>
                    ) : (
                      <div className={styles.chipRow}>
                        {dependenciasUnicasFiltradas.slice(0, 200).map(dep => {
                          const sel = reasignarDepOrigen === dep;
                          const matches = registros.filter(r => (r.dependencia ?? '') === dep);
                          const count = matches.length;
                          const parentEmp = matches[0]?.empleador ?? '—';
                          return (
                            <span
                              key={dep}
                              onClick={() => setReasignarDepOrigen(sel ? '' : dep)}
                              title={`Empleador actual: ${parentEmp}`}
                              className={[styles["uPadding4px-10px"], styles["uBorderRadius4px"], styles["uFontSize11px"], styles["uFontWeight600"], styles["uCursorPointer"]].join(' ')} style={{ background: sel ? 'rgba(167,139,250,0.2)' : 'rgba(255,255,255,0.04)', border: sel ? '1px solid #a78bfa' : '1px solid rgba(255,255,255,0.06)', color: sel ? '#a78bfa' : '#888' }}
                            >
                              {dep} <span style={{ color: sel ? '#a78bfa' : '#555' }}>({count})</span>
                            </span>
                          );
                        })}
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* Paso 2: destino */}
              <div className={[styles["uDisplayGrid"], styles["uGridTemplateColumns1fr-1fr"], styles["uGap12px"], styles["uMarginBottom16px"]].join(' ')}>
                <div>
                  <label className={styles.label}>
                    2) Nuevo empleador
                  </label>
                  <input
                    className={`form-input ${styles.darkInput}`}
                    list="reasignar-emp-list"
                    placeholder="Ej: Gobierno de la Provincia de Entre Ríos"
                    value={reasignarEmpDestino}
                    onChange={e => setReasignarEmpDestino(e.target.value)}
                  />
                  <datalist id="reasignar-emp-list">
                    {allEmpleadores.map(e => <option key={e} value={e} />)}
                  </datalist>
                </div>
                <div>
                  <label className={styles.label}>
                    Nueva dependencia (opcional)
                  </label>
                  <input
                    className={`form-input ${styles.darkInput}`}
                    placeholder="Ej: Jefatura de Policía de Entre Ríos"
                    value={reasignarDepDestino}
                    onChange={e => setReasignarDepDestino(e.target.value)}
                  />
                </div>
              </div>

              {(reasignarEmpOrigen || reasignarDepOrigen) && (
                <div className={[styles["uMarginBottom12px"], styles["uFontSize11px"], styles["uColor00d4ff"], styles["uFontWeight700"]].join(' ')}>
                  {reasignarIds.length} registro(s) coinciden con &quot;{reasignarModo === 'empleador' ? reasignarEmpOrigen : reasignarDepOrigen}&quot;
                </div>
              )}

              {(() => {
                const hayOrigen = reasignarModo === 'empleador' ? !!reasignarEmpOrigen : !!reasignarDepOrigen;
                const disabled = updating || !hayOrigen || (!reasignarEmpDestino.trim() && !reasignarDepDestino.trim()) || reasignarIds.length === 0;
                return (
                  <button
                    onClick={reasignarMasivo}
                    disabled={disabled}
                    className={[styles["uBorderNone"], styles["uBorderRadius6px"], styles["uPadding10px-24px"], styles["uFontSize11px"], styles["uFontWeight900"], styles["uTextTransformUppercase"], styles["uLetterSpacing1px"]].join(' ')} style={{ background: disabled ? 'var(--surface-hover)' : 'var(--action-primary)', color: disabled ? 'var(--text-muted)' : '#fff', cursor: disabled ? 'not-allowed' : 'pointer' }}
                  >
                    {updating ? 'REASIGNANDO...' : `REASIGNAR ${reasignarIds.length} REGISTRO(S)`}
                  </button>
                );
              })()}
            </>
          )}
        </div>
      )}

      {mode === 'excel' && (
        <div className={styles.excelWorkspace}>
          <div className={styles.excelPageHeader}>
            <div className={styles.excelPageIcon}><FileSpreadsheet size={20} /></div>
            <div>
              <h2 className={styles.excelPageTitle}>Asignar desde Excel</h2>
              <p className={styles.excelPageSubtitle}>Pegá una tabla, revisá las columnas y asigná los registros en pocos pasos.</p>
            </div>
          </div>
          <AsignarEmpleadorSection
            registros={registros}
            allEmpleadores={allEmpleadores}
            mutateRegistros={mutateRegistros}
            pushBulkUpdateIds={pushBulkUpdateIds}
            standalone={mode === 'excel'}
          />
        </div>
      )}



        {/* --- NUEVO FLUJO MINIMALISTA: CALIF x SCORE (mode === 'bulk') --- */}
        {mode === 'bulk' && step === 'filter' && (
          <div className={styles.scoreWorkspace}>
            <div className={styles.scorePageHeader}>
              <div className={styles.scorePageIcon}><Filter size={20} /></div>
              <div>
                <h2 className={styles.scorePageTitle}>Calificación por Score</h2>
                <p className={styles.scorePageSubtitle}>Filtrá registros por puntaje o redistribuilos entre analistas.</p>
              </div>
            </div>

            <div className={styles.scoreGrid}>
            <div className={styles.scoreCard}>
               <h4 className={styles.scoreCardTitle}>
                 <span className={styles.scoreStepBadge}>1</span>
                 Definir Rango de Score
               </h4>
               
               <div className={[styles["uDisplayGrid"], styles["uGridTemplateColumns1fr-1fr"], styles["uGap32px"], styles["uMarginBottom32px"]].join(' ')}>
                 <div>
                   <label className={[styles["uDisplayBlock"], styles["uFontSize10px"], styles["uColorText-muted"], styles["uFontWeight800"], styles["uTextTransformUppercase"], styles["uLetterSpacing0-5px"], styles["uMarginBottom12px"]].join(' ')}>SCORE MÍNIMO</label>
                   <input className={["form-input", styles["uFontSize20px"], styles["uPadding16px"], styles["uBackgroundSurface-sunken"], styles["uTextAlignCenter"], styles["uFontWeight800"], styles["uBorder1px-solid-border-subtle"], styles["uBorderRadius12px"], styles["uOutlineNone"], styles["uWidth100"]].filter(Boolean).join(' ')} type="number" placeholder="Ej: 0" value={filtros.scoreMin} onChange={e => setFiltros(p => ({ ...p, scoreMin: e.target.value }))}  />
                 </div>
                 <div>
                   <label className={[styles["uDisplayBlock"], styles["uFontSize10px"], styles["uColorText-muted"], styles["uFontWeight800"], styles["uTextTransformUppercase"], styles["uLetterSpacing0-5px"], styles["uMarginBottom12px"]].join(' ')}>SCORE MÁXIMO</label>
                   <input className={["form-input", styles["uFontSize20px"], styles["uPadding16px"], styles["uBackgroundSurface-sunken"], styles["uTextAlignCenter"], styles["uFontWeight800"], styles["uBorder1px-solid-border-subtle"], styles["uBorderRadius12px"], styles["uOutlineNone"], styles["uWidth100"]].filter(Boolean).join(' ')} type="number" placeholder="Ej: 499" value={filtros.scoreMax} onChange={e => setFiltros(p => ({ ...p, scoreMax: e.target.value }))}  />
                 </div>
               </div>

               <div className={[styles["uMarginTop24px"], styles["uPaddingBottom24px"]].join(' ')}>
                 <button onClick={() => setShowAdvancedFilters(!showAdvancedFilters)} className={styles.scoreAdvancedButton}>
                   {showAdvancedFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                   Filtros Avanzados (Opcional)
                 </button>
               </div>
               
               {showAdvancedFilters && (
                  <div className={[styles["uMarginTop8px"], styles["uMarginBottom32px"], styles["uPaddingTop32px"], styles["uBorderTop1px-solid-border-subtle"]].join(' ')}>
                    <div className={[styles["uDisplayGrid"], styles["uGridTemplateColumns1fr-1fr"], styles["uGap24px"], styles["uTextAlignLeft"]].join(' ')}>
                      <div>
                        <label className={styles.label}>Estado</label>
                        <select className={["form-select", styles["uBackgroundSurface-sunken"], styles["uFontSize12px"], styles["uPadding10px"]].filter(Boolean).join(' ')} value={filtros.estados[0] || ''} onChange={e => setFiltros(p => ({ ...p, estados: e.target.value ? [e.target.value] : [] }))} >
                          <option value="">Todos</option>
                          {ESTADOS.map(e => <option key={e} value={e}>{STATUS_LABEL[e] ?? e}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={styles.label}>Analista</label>
                        <select className={["form-select", styles["uBackgroundSurface-sunken"], styles["uFontSize12px"], styles["uPadding10px"]].filter(Boolean).join(' ')} value={filtros.analistas[0] || ''} onChange={e => setFiltros(p => ({ ...p, analistas: e.target.value ? [e.target.value] : [] }))} >
                          <option value="">Todos</option>
                          {allAnalistas.map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={styles.label}>Fecha Desde</label>
                        <input className={["form-input", styles["uBackgroundSurface-sunken"], styles["uFontSize12px"], styles["uPadding10px"]].filter(Boolean).join(' ')} type="date" value={filtros.fechaDesde} onChange={e => setFiltros(p => ({ ...p, fechaDesde: e.target.value }))}  />
                      </div>
                      <div>
                        <label className={styles.label}>Fecha Hasta</label>
                        <input className={["form-input", styles["uBackgroundSurface-sunken"], styles["uFontSize12px"], styles["uPadding10px"]].filter(Boolean).join(' ')} type="date" value={filtros.fechaHasta} onChange={e => setFiltros(p => ({ ...p, fechaHasta: e.target.value }))}  />
                      </div>
                    </div>
                  </div>
               )}

               <div className={[styles["uDisplayFlex"], styles["uJustifyContentCenter"], styles["uMarginTop16px"]].join(' ')}>
                 <button
                   onClick={previewRecords}
                   disabled={!filtros.scoreMin && !filtros.scoreMax && filtros.estados.length === 0 && filtros.analistas.length === 0 && !filtros.fechaDesde && !filtros.fechaHasta}
                   className={styles.scoreSearchButton}
                 >
                   BUSCAR REGISTROS
                 </button>
               </div>
            </div>

            {/* ── REASIGNAR REGISTROS ENTRE ANALISTAS (columna al lado del filtro) ── */}
            <div className={`${styles.scoreCard} ${styles.scoreReassignCard}`}>
              {/* Header colapsable */}
              <div
                onClick={() => setRaExpandido(!raExpandido)}
                className={styles.scoreReassignHeader}
              >
                <Users size={18} />
                <h4 className={[styles["uFlex1"], styles["uFontSize13px"], styles["uFontWeight800"], styles["uColorText-strong"], styles["uTextTransformUppercase"], styles["uLetterSpacing1px"], styles["uOpacity0-9"]].join(' ')}>
                  Reasignar Registros entre Analistas
                </h4>
                {raExpandido ? <ChevronUp size={16} color="#888" /> : <ChevronDown size={16} color="#888" />}
              </div>

              {raExpandido && (
                <div className={[styles["uPadding20px-32px-32px"]].join(' ')}>
                  <p className={[styles["uFontSize12px"], styles["uColorText-muted"], styles["uMarginBottom28px"], styles["uLineHeight1-5"]].join(' ')}>
                    Elegí un analista origen, acotá por estado/score/fecha (opcional), definí cuántos registros van a cada analista destino y tildalos.
                  </p>

                  {/* PASO 1: Origen */}
                  <div className={[styles["uMarginBottom28px"]].join(' ')}>
                    <h5 className={styles.stepTitle}>{stepBadge(1)} Analista origen</h5>
                    <CustomSelect
                      width="100%"
                      bg="var(--surface-card)"
                      value={raOrigen}
                      onChange={v => { setRaOrigen(String(v)); setRaAsignaciones(new Map()); }}
                      options={[{ label: '— Elegir analista —', value: '' }, ...ANALISTAS.map(a => ({ label: a, value: a }))]}
                    />
                  </div>

                  {/* PASO 2: Filtros opcionales */}
                  {raOrigen && (
                    <div className={[styles["uMarginBottom28px"]].join(' ')}>
                      <h5 className={styles.stepTitle}>{stepBadge(2)} Acotar <span className={styles.stepOptional}>(opcional)</span></h5>
                      <div className={[styles["uDisplayFlex"], styles["uFlexWrapWrap"], styles["uGap8px"], styles["uMarginBottom16px"]].join(' ')}>
                        {ESTADOS.map(e => {
                          const sel = raEstados.includes(e);
                          return (
                            <button
                              key={e}
                              onClick={() => { setRaEstados(prev => prev.includes(e) ? prev.filter(x => x !== e) : [...prev, e]); setRaAsignaciones(new Map()); }}
                              className={[styles["uBorderRadius10px"], styles["uPadding8px-14px"], styles["uFontSize11px"], styles["uFontWeight800"], styles["uCursorPointer"], styles["uTransitionAll-0-15s"]].join(' ')} style={{ background: sel ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.02)', border: `1px solid ${sel ? 'rgba(52,211,153,0.5)' : 'rgba(255,255,255,0.06)'}`, color: sel ? '#34d399' : '#888' }}
                            >
                              {STATUS_LABEL[e] ?? e}
                            </button>
                          );
                        })}
                      </div>
                      <div className={[styles["uDisplayGrid"], styles["uGridTemplateColumns1fr-1fr"], styles["uGap20px"]].join(' ')}>
                        <div>
                          <label className={styles.label}>Score mínimo</label>
                          <input className={["form-input", styles["uBackgroundSurface-sunken"], styles["uFontSize12px"], styles["uPadding10px"], styles["uWidth100"]].filter(Boolean).join(' ')} type="number" placeholder="0" value={raScoreMin} onChange={e => { setRaScoreMin(e.target.value); setRaAsignaciones(new Map()); }}  />
                        </div>
                        <div>
                          <label className={styles.label}>Score máximo</label>
                          <input className={["form-input", styles["uBackgroundSurface-sunken"], styles["uFontSize12px"], styles["uPadding10px"], styles["uWidth100"]].filter(Boolean).join(' ')} type="number" placeholder="∞" value={raScoreMax} onChange={e => { setRaScoreMax(e.target.value); setRaAsignaciones(new Map()); }}  />
                        </div>
                        <div>
                          <label className={styles.label}>Fecha desde</label>
                          <input className={["form-input", styles["uBackgroundSurface-sunken"], styles["uFontSize12px"], styles["uPadding10px"], styles["uWidth100"]].filter(Boolean).join(' ')} type="date" value={raFechaDesde} onChange={e => { setRaFechaDesde(e.target.value); setRaAsignaciones(new Map()); }}  />
                        </div>
                        <div>
                          <label className={styles.label}>Fecha hasta</label>
                          <input className={["form-input", styles["uBackgroundSurface-sunken"], styles["uFontSize12px"], styles["uPadding10px"], styles["uWidth100"]].filter(Boolean).join(' ')} type="date" value={raFechaHasta} onChange={e => { setRaFechaHasta(e.target.value); setRaAsignaciones(new Map()); }}  />
                        </div>
                      </div>
                      <div className={[styles["uFontSize13px"], styles["uColorText-muted"], styles["uMarginTop16px"]].join(' ')}>
                        <strong className={[styles["uColorText-strong"], styles["uFontSize16px"]].join(' ')}>{raTotalDisponible}</strong> registro(s) disponibles
                      </div>
                    </div>
                  )}

                  {/* PASO 3: Cuotas por destino */}
                  {raOrigen && raTotalDisponible > 0 && (
                    <div className={[styles["uMarginBottom28px"]].join(' ')}>
                      <h5 className={styles.stepTitle}>{stepBadge(3)} Cuotas por destino <span className={styles.stepProgress}>({raTotalCuotas}/{raTotalDisponible})</span></h5>
                      <div className={[styles["uDisplayFlex"], styles["uGap12px"], styles["uMarginBottom14px"], styles["uAlignItemsFlex-end"]].join(' ')}>
                        <div className={[styles["uFlex1"]].join(' ')}>
                          <label className={styles.label}>Analista destino</label>
                          <CustomSelect
                            width="100%"
                            bg="var(--surface-card)"
                            value={raNuevoDestino}
                            onChange={v => setRaNuevoDestino(String(v))}
                            options={[{ label: '— Elegir —', value: '' }, ...ANALISTAS.filter(a => a !== raOrigen && !raDestinos.some(d => d.analista === a)).map(a => ({ label: a, value: a }))]}
                          />
                        </div>
                        <div className={[styles["uWidth120px"]].join(' ')}>
                          <label className={styles.label}>Cantidad</label>
                          <input className={["form-input", styles["uBackgroundSurface-sunken"], styles["uFontSize12px"], styles["uPadding10px"], styles["uWidth100"]].filter(Boolean).join(' ')} type="number" placeholder="Ej: 100" value={raNuevaCuota} onChange={e => setRaNuevaCuota(e.target.value)}  />
                        </div>
                        <button onClick={raAgregarDestino} className={[styles["uHeight38px"], styles["uPadding0-18px"], styles["uBorderRadius10px"], styles["uBorder1px-solid-rgba-52-211-153-0-4"], styles["uBackgroundRgba-52-211-153-0-12"], styles["uColor34d399"], styles["uFontWeight800"], styles["uFontSize12px"], styles["uCursorPointer"], styles["uWhiteSpaceNowrap"]].join(' ')}>+ Agregar</button>
                      </div>

                      {/* Reparto entre varios analistas con cantidad por cada uno */}
                      {(() => {
                        const disponiblesMulti = ANALISTAS.filter(a => a !== raOrigen && !raDestinos.some(d => d.analista === a));
                        if (disponiblesMulti.length === 0) return null;
                        const seleccionados = Object.keys(raMultiCant);
                        const sumaSel = seleccionados.reduce((s, a) => s + (Number(raMultiCant[a]) || 0), 0);
                        const excede = raTotalCuotas + sumaSel > raTotalDisponible;
                        return (
                          <div className={[styles["uMarginTop16px"], styles["uPaddingTop16px"], styles["uBorderTop1px-dashed-rgba-255-255-255-0-08"]].join(' ')}>
                            <label className={styles.label}>O elegir varios y poner cantidad a cada uno</label>
                            <div className={[styles["uDisplayFlex"], styles["uFlexWrapWrap"], styles["uGap8px"]].join(' ')} style={{ marginBottom: seleccionados.length > 0 ? 14 : 0 }}>
                              {disponiblesMulti.map(a => {
                                const sel = a in raMultiCant;
                                return (
                                  <button
                                    key={a}
                                    onClick={() => setRaMultiCant(prev => {
                                      const next = { ...prev };
                                      if (a in next) delete next[a]; else next[a] = '';
                                      return next;
                                    })}
                                    className={[styles["uBorderRadius10px"], styles["uPadding8px-14px"], styles["uFontSize11px"], styles["uFontWeight800"], styles["uCursorPointer"], styles["uTransitionAll-0-15s"]].join(' ')} style={{ background: sel ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.02)', border: `1px solid ${sel ? 'rgba(52,211,153,0.5)' : 'rgba(255,255,255,0.06)'}`, color: sel ? '#34d399' : '#888' }}
                                  >
                                    {sel ? '✓ ' : ''}{a}
                                  </button>
                                );
                              })}
                            </div>
                            {seleccionados.length > 0 && (
                              <div className={[styles["uDisplayFlex"], styles["uFlexDirectionColumn"], styles["uGap8px"]].join(' ')}>
                                {seleccionados.map(a => (
                                  <div key={a} className={[styles["uDisplayFlex"], styles["uAlignItemsCenter"], styles["uGap12px"]].join(' ')}>
                                    <span className={[styles["uFlex1"], styles["uFontSize12-5px"], styles["uColorText-secondary"], styles["uFontWeight700"]].join(' ')}>{a}</span>
                                    <input
                                      className={["form-input", styles["uWidth130px"], styles["uBackgroundSurface-sunken"], styles["uFontSize12px"], styles["uPadding10px"]].filter(Boolean).join(' ')}
                                      type="number"
                                      placeholder="Cantidad"
                                      value={raMultiCant[a]}
                                      onChange={e => setRaMultiCant(prev => ({ ...prev, [a]: e.target.value }))}
                                    />
                                  </div>
                                ))}
                                <div className={[styles["uDisplayFlex"], styles["uAlignItemsCenter"], styles["uJustifyContentSpace-between"], styles["uMarginTop6px"]].join(' ')}>
                                  <span className={[styles["uFontSize11px"], styles["uFontWeight700"]].join(' ')} style={{ color: excede ? '#f87171' : '#888' }}>
                                    Suma: {sumaSel}{excede ? ` · supera ${raTotalDisponible}` : ` / ${raTotalDisponible}`}
                                  </span>
                                  <button
                                    onClick={raAgregarMulti}
                                    disabled={excede}
                                    className={[styles["uHeight38px"], styles["uPadding0-18px"], styles["uBorderRadius10px"], styles["uFontWeight800"], styles["uFontSize12px"], styles["uWhiteSpaceNowrap"]].join(' ')} style={{ border: `1px solid ${excede ? 'rgba(255,255,255,0.06)' : 'rgba(52,211,153,0.4)'}`, background: excede ? 'rgba(255,255,255,0.02)' : 'rgba(52,211,153,0.12)', color: excede ? '#555' : '#34d399', cursor: excede ? 'not-allowed' : 'pointer' }}
                                  >
                                    + Agregar {seleccionados.length}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      <div className={[styles["uDisplayFlex"], styles["uFlexWrapWrap"], styles["uGap10px"], styles["uMarginTop16px"]].join(' ')}>
                        {raDestinos.map(d => {
                          const hechos = raAsignadosPorDestino[d.analista] ?? 0;
                          const completo = hechos >= d.cuota;
                          const activo = raDestinoActivo === d.analista;
                          return (
                            <div
                              key={d.analista}
                              onClick={() => setRaDestinoActivo(d.analista)}
                              className={[styles["uDisplayFlex"], styles["uAlignItemsCenter"], styles["uGap10px"], styles["uCursorPointer"], styles["uTransitionAll-0-15s"], styles["uBorderRadius12px"], styles["uPadding8px-14px"]].join(' ')} style={{ background: activo ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.02)', border: `1px solid ${completo ? 'rgba(52,211,153,0.6)' : activo ? 'rgba(52,211,153,0.5)' : 'rgba(255,255,255,0.08)'}` }}
                            >
                              <span className={[styles["uFontSize13px"], styles["uFontWeight800"]].join(' ')} style={{ color: completo ? '#34d399' : '#ddd' }}>{d.analista}</span>
                              <span className={[styles["uFontSize12px"], styles["uFontWeight700"]].join(' ')} style={{ color: completo ? '#34d399' : '#888' }}>{hechos}/{d.cuota}</span>
                              <button onClick={(ev) => { ev.stopPropagation(); raQuitarDestino(d.analista); }} className={[styles["uBackgroundNone"], styles["uBorderNone"], styles["uColorText-muted"], styles["uCursorPointer"], styles["uFontSize16px"], styles["uLineHeight1"], styles["uPadding0"]].join(' ')}>×</button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* PASO 4: Tildar registros */}
                  {raDestinos.length > 0 && (
                    <div className={[styles["uMarginBottom28px"]].join(' ')}>
                      <div className={[styles["uDisplayFlex"], styles["uAlignItemsCenter"], styles["uJustifyContentSpace-between"], styles["uMarginBottom12px"]].join(' ')}>
                        <h5 className={`${styles.stepTitle} ${styles.noMargin}`}>{stepBadge(4)} Tildar para <span className={styles.stepProgress}>{raDestinoActivo || '—'}</span></h5>
                        <button onClick={raTildarPrimerosN} disabled={!raDestinoActivo} className={[styles["uPadding8px-14px"], styles["uBorderRadius10px"], styles["uFontSize11px"], styles["uFontWeight800"], styles["uWhiteSpaceNowrap"]].join(' ')} style={{ border: `1px solid ${raDestinoActivo ? 'rgba(52,211,153,0.4)' : 'rgba(255,255,255,0.06)'}`, background: raDestinoActivo ? 'rgba(52,211,153,0.12)' : 'rgba(255,255,255,0.02)', color: raDestinoActivo ? '#34d399' : '#555', cursor: raDestinoActivo ? 'pointer' : 'not-allowed' }}>
                          Tildar primeros N
                        </button>
                      </div>
                      <div className={[styles["uMaxHeight320px"], styles["uOverflowYAuto"], styles["uBorder1px-solid-border-subtle"], styles["uBorderRadius12px"], styles["uBackgroundSurface-sunken"]].join(' ')}>
                        {raUniverso.map(r => {
                          const dest = raAsignaciones.get(r.id);
                          return (
                            <div
                              key={r.id}
                              onClick={() => raToggleFila(r.id)}
                              className={[styles["uDisplayFlex"], styles["uAlignItemsCenter"], styles["uGap12px"], styles["uPadding10px-14px"], styles["uBorderBottom1px-solid-border-subtle"], styles["uCursorPointer"]].join(' ')} style={{ background: dest ? 'rgba(52,211,153,0.08)' : 'transparent' }}
                            >
                              <input type="checkbox" readOnly checked={!!dest} className={[styles["uAccentColor34d399"]].join(' ')} />
                              <span className={[styles["uFlex1"], styles["uFontSize12-5px"], styles["uColorText-secondary"]].join(' ')}>{r.nombre ?? r.cuil ?? r.id}</span>
                              <span className={[styles["uFontSize11px"], styles["uColorText-muted"]].join(' ')}>{STATUS_LABEL[r.estado ?? ''] ?? r.estado}</span>
                              {dest && <span className={[styles["uFontSize11px"], styles["uFontWeight800"], styles["uColor34d399"]].join(' ')}>→ {dest}</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Acción */}
                  {raDestinos.length > 0 && (
                    <button
                      onClick={raGuardar}
                      disabled={updating || raAsignaciones.size === 0}
                      className={[styles["uWidth100"], styles["uPadding16px"], styles["uBorderRadius30px"], styles["uBorderNone"], styles["uFontWeight900"], styles["uFontSize12px"], styles["uLetterSpacing0-5px"], styles["uDisplayFlex"], styles["uAlignItemsCenter"], styles["uJustifyContentCenter"], styles["uGap10px"], styles["uTransitionAll-0-3s-cubic-bezier-0-4-0-0-2-1"]].join(' ')} style={{ background: (updating || raAsignaciones.size === 0) ? '#222' : '#34d399', color: (updating || raAsignaciones.size === 0) ? '#555' : '#000', cursor: (updating || raAsignaciones.size === 0) ? 'not-allowed' : 'pointer', boxShadow: (updating || raAsignaciones.size === 0) ? 'none' : '0 4px 14px rgba(52, 211, 153, 0.2)' }}
                    >
                      {updating ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                      {updating ? 'REASIGNANDO...' : `REASIGNAR ${raAsignaciones.size} REGISTRO(S)`}
                    </button>
                  )}
                </div>
              )}
            </div>
            </div>
          </div>
        )}

        {mode === 'bulk' && step === 'confirm' && (
          <div className={[styles["uMaxWidth720px"], styles["uMargin40px-auto"]].join(' ')}>
            <div className={[styles["uTextAlignCenter"], styles["uMarginBottom40px"]].join(' ')}>
               <h2 className={[styles["uFontSize32px"], styles["uFontWeight900"], styles["uLetterSpacing1px1gkox"], styles["uColorText-strong"], styles["uMarginBottom8px"]].join(' ')}>{previewCount}</h2>
               <p className={[styles["uColorText-muted"], styles["uFontSize14px"], styles["uFontWeight600"], styles["uTextTransformUppercase"], styles["uLetterSpacing1px"]].join(' ')}>Registros Encontrados</p>
               <div className={[styles["uDisplayInline-block"], styles["uMarginTop12px"], styles["uPadding4px-12px"], styles["uBackgroundRgba-0-212-255-0-1"], styles["uColor00d4ff"], styles["uBorderRadius20px"], styles["uFontSize11px"], styles["uFontWeight800"]].join(' ')}>
                 Score: {filtros.scoreMin || '0'} a {filtros.scoreMax || '∞'}
               </div>
            </div>

            <div className={[styles["uBackgroundSurface-sunken"], styles["uBorder1px-solid-border-subtle"], styles["uBorderRadius16px"], styles["uPadding40px-32px"], styles["uMarginBottom32px"], styles["uBoxShadowShadow-sm"]].join(' ')}>
               <h4 className={[styles["uFontSize11px"], styles["uFontWeight800"], styles["uColorText-strong"], styles["uTextTransformUppercase"], styles["uLetterSpacing1px"], styles["uMarginBottom32px"], styles["uDisplayFlex"], styles["uAlignItemsCenter"], styles["uGap8px"], styles["uOpacity0-9"]].join(' ')}>
                 <span className={[styles["uWidth20px"], styles["uHeight20px"], styles["uBorderRadius50"], styles["uBackground34d399"], styles["uColor000"], styles["uDisplayFlex"], styles["uAlignItemsCenter"], styles["uJustifyContentCenter"], styles["uFontSize10px"], styles["uFontWeight900"]].join(' ')}>2</span>
                 Asignar Calificación
               </h4>
               
               <div className={[styles["uDisplayGrid"], styles["uGridTemplateColumnsRepeat-4-1fr"], styles["uGap16px"]].join(' ')}>
                  {ACUERDOS_OPCIONES.map(a => {
                    const isSelected = campos.acuerdo_precios === a;
                    return (
                      <button key={a} onClick={() => setCampos(p => ({ ...p, acuerdo_precios: a }))} className={[styles["uPadding24px-16px"], styles["uBorderRadius16px"], styles["uBorder1px-solid"], styles["uFontSize13px"], styles["uFontWeight800"], styles["uCursorPointer"], styles["uTransitionAll-0-2s"], styles["uTextAlignCenter"], styles["uOutlineNone"]].join(' ')} style={{ background: isSelected ? '#fff' : 'rgba(255,255,255,0.02)', color: isSelected ? '#000' : '#888', borderColor: isSelected ? '#fff' : 'rgba(255,255,255,0.06)' }}>
                        {a}
                      </button>
                    );
                  })}
               </div>

               <div className={[styles["uMarginTop32px"], styles["uPaddingTop24px"], styles["uBorderTop1px-solid-border-subtle"]].join(' ')}>
                 <button onClick={() => setShowAdvancedFilters(!showAdvancedFilters)} className={[styles["uBackgroundTransparent"], styles["uBorderNone"], styles["uColorText-muted"], styles["uFontSize11px"], styles["uFontWeight800"], styles["uTextTransformUppercase"], styles["uCursorPointer"], styles["uDisplayFlex"], styles["uAlignItemsCenter"], styles["uGap6px"], styles["uMargin0-auto"]].join(' ')}>
                   {showAdvancedFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                   Otras Modificaciones Masivas (Avanzado)
                 </button>
                 
                 {showAdvancedFilters && (
                    <div className={[styles["uDisplayGrid"], styles["uGridTemplateColumns1fr-1fr"], styles["uGap20px"], styles["uMarginTop32px"], styles["uTextAlignLeft"]].join(' ')}>
                        <div>
                          <label className={styles.label}>Estado</label>
                          <select className={["form-select", styles["uBackgroundSurface-sunken"], styles["uFontSize12px"], styles["uPadding10px"]].filter(Boolean).join(' ')} value={campos.estado} onChange={e => setCampos(p => ({ ...p, estado: e.target.value }))} >
                            <option value="">— No modificar —</option>
                            <option value={SIN_ESPECIFICAR}>Sin especificar (borrar)</option>
                            {ESTADOS.map(e => <option key={e} value={e}>{STATUS_LABEL[e] ?? e}</option>)}
                          </select>
                        </div>

                        <div>
                          <label className={styles.label}>Analista</label>
                          <select className={["form-select", styles["uBackgroundSurface-sunken"], styles["uFontSize12px"], styles["uPadding10px"]].filter(Boolean).join(' ')} value={campos.analista} onChange={e => setCampos(p => ({ ...p, analista: e.target.value }))} >
                            <option value="">— No modificar —</option>
                            <option value={SIN_ESPECIFICAR}>Sin especificar (borrar)</option>
                            {ANALISTAS.map(a => <option key={a} value={a}>{a}</option>)}
                          </select>
                        </div>
                        
                        <div>
                          <label className={styles.label}>Tipo Cliente</label>
                          <select className={["form-select", styles["uBackgroundSurface-sunken"], styles["uFontSize12px"], styles["uPadding10px"]].filter(Boolean).join(' ')} value={campos.tipo_cliente} onChange={e => setCampos(p => ({ ...p, tipo_cliente: e.target.value }))} >
                            <option value="">— No modificar —</option>
                            <option value={SIN_ESPECIFICAR}>Sin especificar (borrar)</option>
                            {TIPO_CLIENTE_OPCIONES.map(t => <option key={t} value={t}>{t === 'Renovacion' ? 'Renovación' : t}</option>)}
                          </select>
                        </div>

                        <div>
                          <label className={styles.label}>Cuotas</label>
                          <input className={["form-input", styles["uBackgroundSurface-sunken"], styles["uFontSize12px"], styles["uPadding10px"]].filter(Boolean).join(' ')} placeholder="Ej: 12, 24, 36" value={campos.cuotas} onChange={e => setCampos(p => ({ ...p, cuotas: e.target.value }))}  />
                        </div>

                        <div className={[styles["uGridColumn1-1"]].join(' ')}>
                          <label className={styles.label}>Empleador</label>
                          <input className={["form-input", styles["uBackgroundSurface-sunken"], styles["uFontSize12px"], styles["uPadding10px"]].filter(Boolean).join(' ')} placeholder="Nombre del empleador" value={campos.empleador} onChange={e => setCampos(p => ({ ...p, empleador: e.target.value }))}  />
                        </div>

                        {/* Los cinco controles siguientes quedaron sin UI en la migración de estilos,
                            aunque el writer nunca dejó de aplicar sus campos. Se restauran con la
                            semántica exacta de 19f881e: '' = no modificar, SIN_ESPECIFICAR = borrar. */}
                        <div>
                          <label className={styles.label}>Rango Etario</label>
                          <select className={["form-select", styles["uBackgroundSurface-sunken"], styles["uFontSize12px"], styles["uPadding10px"]].filter(Boolean).join(' ')} value={campos.rango_etario} onChange={e => setCampos(p => ({ ...p, rango_etario: e.target.value }))} >
                            <option value="">— No modificar —</option>
                            <option value={SIN_ESPECIFICAR}>Sin especificar (borrar)</option>
                            {RANGOS_ETARIOS.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </div>

                        <div>
                          <label className={styles.label}>Sexo</label>
                          <select className={["form-select", styles["uBackgroundSurface-sunken"], styles["uFontSize12px"], styles["uPadding10px"]].filter(Boolean).join(' ')} value={campos.sexo} onChange={e => setCampos(p => ({ ...p, sexo: e.target.value }))} >
                            <option value="">— No modificar —</option>
                            <option value={SIN_ESPECIFICAR}>Sin especificar (borrar)</option>
                            {SEXOS.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>

                        <div>
                          <label className={styles.label}>Localidad</label>
                          <select className={["form-select", styles["uBackgroundSurface-sunken"], styles["uFontSize12px"], styles["uPadding10px"]].filter(Boolean).join(' ')} value={campos.localidad} onChange={e => setCampos(p => ({ ...p, localidad: e.target.value }))} >
                            <option value="">— No modificar —</option>
                            <option value={SIN_ESPECIFICAR}>Sin especificar (borrar)</option>
                            {localidadesDisponibles.map(l => <option key={l} value={l}>{l}</option>)}
                          </select>
                        </div>

                        <div>
                          <label className={styles.label}>Resumen Ejecutivo</label>
                          <select className={["form-select", styles["uBackgroundSurface-sunken"], styles["uFontSize12px"], styles["uPadding10px"]].filter(Boolean).join(' ')} value={campos.es_re} onChange={e => setCampos(p => ({ ...p, es_re: e.target.value }))} >
                            <option value="">— No modificar —</option>
                            <option value="si">Sí</option>
                            <option value="no">No</option>
                          </select>
                        </div>

                        <div className={[styles["uGridColumn1-1"]].join(' ')}>
                          <label className={styles.label}>Comentarios (agregar al final)</label>
                          <textarea className={["form-input", styles["uBackgroundSurface-sunken"], styles["uFontSize12px"], styles["uPadding10px"]].filter(Boolean).join(' ')} placeholder="Texto a agregar..." value={campos.comentarios} onChange={e => setCampos(p => ({ ...p, comentarios: e.target.value }))} rows={2} style={{ resize: 'vertical' }} />
                        </div>
                    </div>
                 )}
               </div>
            </div>

            <div className={[styles["uDisplayFlex"], styles["uJustifyContentCenter"], styles["uGap16px"]].join(' ')}>
              <button onClick={() => setStep('filter')} className={[styles["uBackgroundTransparent"], styles["uColorText-muted"], styles["uBorder1px-solid-border-subtle"], styles["uPadding16px-32px"], styles["uBorderRadius30px"], styles["uFontSize12px"], styles["uFontWeight800"], styles["uCursorPointer"], styles["uTransitionAll-0-2s"]].join(' ')}>
                ATRÁS
              </button>
              <button
                onClick={handleUpdate}
                disabled={aplicarDisabled}
                className={[styles["uBorderNone"], styles["uFontWeight900"], styles["uPadding16px-40px"], styles["uBorderRadius30px"], styles["uFontSize12px"], styles["uLetterSpacing0-5px"], styles["uDisplayFlex"], styles["uAlignItemsCenter"], styles["uGap10px"], styles["uTransitionAll-0-3s-cubic-bezier-0-4-0-0-2-1"]].join(' ')} style={{ background: (aplicarDisabled) ? '#222' : '#34d399', color: (aplicarDisabled) ? '#555' : '#000', cursor: (aplicarDisabled) ? 'not-allowed' : 'pointer', boxShadow: (aplicarDisabled) ? 'none' : '0 4px 14px rgba(52, 211, 153, 0.2)' }}
              >
                {updating ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {updating ? 'APLICANDO...' : (campos.acuerdo_precios ? 'APLICAR CALIFICACIÓN' : 'APLICAR MODIFICACIONES')}
              </button>
            </div>
          </div>
        )}

        {mode === 'bulk' && step === 'done' && (
          <div className={[styles["uTextAlignCenter"], styles["uPadding64px-20px"], styles["uMaxWidth600px"], styles["uMargin0-auto"]].join(' ')}>
            <div className={[styles["uWidth80px"], styles["uHeight80px"], styles["uBorderRadius50"], styles["uBackgroundRgba-52-211-153-0-1"], styles["uDisplayFlex"], styles["uAlignItemsCenter"], styles["uJustifyContentCenter"], styles["uMargin0-auto-24px"]].join(' ')}>
              <CheckCircle size={40} className={[styles["uColor34d399"]].join(' ')} />
            </div>
            <h3 className={[styles["uFontSize28px"], styles["uFontWeight900"], styles["uColorText-strong"], styles["uMarginBottom12px"], styles["uLetterSpacing0-5px3s3pa"]].join(' ')}>
              ¡Actualización Exitosa!
            </h3>
            <p className={[styles["uFontSize15px"], styles["uColorText-muted"], styles["uMarginBottom40px"], styles["uLineHeight1-5"]].join(' ')}>
              Se asignó la calificación exitosamente a <strong className={[styles["uColorText-strong"]].join(' ')}>{updatedCount}</strong> registros.
            </p>
            <div className={[styles["uDisplayFlex"], styles["uJustifyContentCenter"], styles["uGap16px"]].join(' ')}>
              {undoState && (
                <button
                  onClick={handleUndo}
                  disabled={undoing}
                  className={[styles["uBackgroundTransparent"], styles["uColorFf3366"], styles["uBorder1px-solid-rgba-255-51-102-0-3"], styles["uFontWeight900"], styles["uPadding16px-32px"], styles["uBorderRadius30px"], styles["uFontSize12px"], styles["uLetterSpacing0-5px"], styles["uDisplayFlex"], styles["uAlignItemsCenter"], styles["uGap8px"], styles["uTransitionAll-0-2s"]].join(' ')} style={{ cursor: undoing ? 'not-allowed' : 'pointer', opacity: undoing ? 0.6 : 1 }}
                >
                  {undoing ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />}
                  {undoing ? 'RESTAURANDO...' : 'DESHACER ÚLTIMA ACCIÓN'}
                </button>
              )}
              <button
                onClick={resetAll}
                className={[styles["uBackgroundSurface-card"], styles["uColor000"], styles["uBorderNone"], styles["uFontWeight900"], styles["uPadding16px-40px"], styles["uBorderRadius30px"], styles["uFontSize12px"], styles["uCursorPointer"], styles["uLetterSpacing0-5px"], styles["uBoxShadow0-4px-14px-rgba-255-255-255-0-2"]].join(' ')}
              >
                NUEVA ASIGNACIÓN
              </button>
            </div>
          </div>
        )}

      </div>

      {/* MODAL DE REGISTROS DEL GRUPO */}
      {modalOpen && (
        <ModalPortal>
        <div
          className={`modal-overlay ${styles.modalOverlay}`}
          onClick={() => setModalOpen(false)}
        >
          <div
            className={styles.employerModal}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header del modal */}
            <div className={styles.employerModalHeader}>
              <div>
                <h3 className={styles.employerModalTitle}>
                  Registros del grupo: {modalGrupo}
                </h3>
                <p className={styles.employerModalSubtitle}>
                  {modalRegistros.length} registros encontrados
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className={styles.employerModalButton}
              >
                <X size={14} /> Cerrar
              </button>
            </div>

            {/* Contenido del modal */}
            <div className={styles.employerModalContent}>
              {modalLoading ? (
                <div className={[styles["uTextAlignCenter"], styles["uPadding40px"]].join(' ')}>
                  <Loader2 size={32} className={["animate-spin", styles["uColor00d4ff"], styles["uMargin0-auto-12px"]].filter(Boolean).join(' ')}  />
                  <p className={[styles["uColorText-muted"], styles["uFontSize13px"]].join(' ')}>Cargando registros...</p>
                </div>
              ) : modalRegistros.length === 0 ? (
                <div className={[styles["uTextAlignCenter"], styles["uPadding40px"], styles["uColorText-muted"]].join(' ')}>
                  <p>No se encontraron registros</p>
                </div>
              ) : (
                <table className={styles.employerTable}>
                  <thead>
                    <tr className={[styles["uBorderBottom1px-solid-border-subtle"]].join(' ')}>
                      <th className={[styles["uTextAlignLeft"], styles["uPadding10px-12px"], styles["uColorText-muted"], styles["uFontWeight700"], styles["uFontSize10px"], styles["uTextTransformUppercase"]].join(' ')}>Nombre</th>
                      <th className={[styles["uTextAlignLeft"], styles["uPadding10px-12px"], styles["uColorText-muted"], styles["uFontWeight700"], styles["uFontSize10px"], styles["uTextTransformUppercase"]].join(' ')}>CUIL</th>
                      <th className={[styles["uTextAlignLeft"], styles["uPadding10px-12px"], styles["uColorText-muted"], styles["uFontWeight700"], styles["uFontSize10px"], styles["uTextTransformUppercase"]].join(' ')}>Empleador</th>
                      <th className={[styles["uTextAlignLeft"], styles["uPadding10px-12px"], styles["uColorText-muted"], styles["uFontWeight700"], styles["uFontSize10px"], styles["uTextTransformUppercase"]].join(' ')}>Estado</th>
                      <th className={[styles["uTextAlignLeft"], styles["uPadding10px-12px"], styles["uColorText-muted"], styles["uFontWeight700"], styles["uFontSize10px"], styles["uTextTransformUppercase"]].join(' ')}>Score</th>
                      <th className={[styles["uTextAlignLeft"], styles["uPadding10px-12px"], styles["uColorText-muted"], styles["uFontWeight700"], styles["uFontSize10px"], styles["uTextTransformUppercase"]].join(' ')}>Analista</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modalRegistros.map((r) => (
                      <tr key={r.id}>
                        <td className={[styles["uPadding10px-12px"], styles["uColorText-secondary"], styles["uFontWeight600"]].join(' ')}>{r.nombre || '-'}</td>
                        <td className={[styles["uPadding10px-12px"], styles["uColorText-muted"], styles["uFontFamilyMonospace"]].join(' ')}>{r.cuil || '-'}</td>
                        <td className={[styles["uPadding10px-12px"], styles["uColorText-secondary"], styles["uFontWeight600"]].join(' ')}>{r.empleador}</td>
                        <td className={[styles["uPadding10px-12px"]].join(' ')}>
                          <span className={[styles["uPadding2px-8px"], styles["uBorderRadius4px"], styles["uFontSize10px"], styles["uBackgroundSurface-hover"], styles["uColorText-muted"], styles["uFontWeight600"]].join(' ')}>
                            {STATUS_LABEL[r.estado] ?? r.estado}
                          </span>
                        </td>
                        <td className={`${styles["uPadding10px-12px"]} ${styles.scoreValue}`}>{r.puntaje ?? '-'}</td>
                        <td className={[styles["uPadding10px-12px"], styles["uColorText-muted"]].join(' ')}>{r.analista || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* MODAL DE TODOS LOS EMPLEADORES */}
      {modalEmpleadoresOpen && (
        <ModalPortal>
        <div
          className={`modal-overlay ${styles.modalOverlay}`}
          onClick={() => setModalEmpleadoresOpen(false)}
        >
          <div
            className={styles.employerModal}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header del modal */}
            <div className={styles.employerModalHeader}>
              <div>
                <h3 className={styles.employerModalTitle}>
                  Todos los Empleadores
                </h3>
                <p className={styles.employerModalSubtitle}>
                  {empleadoresConConteo.filter(e => !e.esDependencia).length} empleadores · {empleadoresConConteo.filter(e => e.esDependencia).length} dependencias
                </p>
              </div>
              <div className={styles.employerModalActions}>
                <button
                  onClick={() => {
                    import('xlsx').then((XLSX) => {
                      const data = empleadoresConConteo.map(e => ({
                        Empresa: e.nombre,
                        Tipo: e.tipo,
                        Categoría: e.categoria,
                        'Es Dependencia': e.esDependencia ? 'Sí' : 'No',
                        Cantidad: e.cantidad
                      }));
                      const ws = XLSX.utils.json_to_sheet(data);
                      const wb = XLSX.utils.book_new();
                      XLSX.utils.book_append_sheet(wb, ws, "Empleadores");
                      XLSX.writeFile(wb, "Empleadores_y_Dependencias.xlsx");
                    });
                  }}
                  className={`${styles.employerModalButton} ${styles.isPrimary}`}
                >
                  <Download size={14} /> Descargar XLSX
                </button>
                <button
                  onClick={() => setModalEmpleadoresOpen(false)}
                  className={styles.employerModalButton}
                >
                  <X size={14} /> Cerrar
                </button>
              </div>
            </div>

            {/* Buscador + filtros tipo */}
            <div className={styles.employerModalFilters}>
              <input
                className={`form-input ${styles.darkInput}`}
                placeholder="Buscar empleador..."
                value={busquedaEmpleadorModal}
                onChange={e => setBusquedaEmpleadorModal(e.target.value)}
              />
              <div className={styles.employerFilterRow}>
                {([
                 { key: 'todos', label: 'Todos' },
                 { key: 'gob_er', label: 'Gob. Entre Ríos' },
                 { key: 'muni', label: 'Municipalidades' },
                 { key: 'min_salud', label: 'Min. Salud' },
                 { key: 'consejo_educ', label: 'Consejo Educ.' },
                 { key: 'sa', label: 'S.A.' },
                 { key: 'srl', label: 'S.R.L.' },
                 { key: 'sas', label: 'S.A.S.' },
                 { key: 'se', label: 'S.E.' },
                 { key: 'fisica', label: 'P. Física' },
                ] as const).map(({ key, label }) => {
                  const activo = filtroTipoModal === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setFiltroTipoModal(key)}
                      className={`${styles.employerFilterButton} ${activo ? styles.isActive : ''}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Contenido del modal */}
            <div className={styles.employerModalContent}>
              {empleadoresLoading ? (
                <div className={[styles["uTextAlignCenter"], styles["uPadding40px"]].join(' ')}>
                  <Loader2 size={32} className={["animate-spin", styles["uColor00d4ff"], styles["uMargin0-auto-12px"]].filter(Boolean).join(' ')}  />
                  <p className={[styles["uColorText-muted"], styles["uFontSize13px"]].join(' ')}>Cargando empleadores...</p>
                </div>
              ) : (
                <>
                  {(() => {
                    const normUp = (s: string) => (s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
                    const matchGobER = (s: string) => { const u = normUp(s); return u.includes('GOBIERNO') && u.includes('ENTRE RIOS'); };
                    const matchMuni = (s: string) => normUp(s).includes('MUNICIPALIDAD');
                    const matchMinSalud = (s: string) => { const u = normUp(s); return u.includes('MINISTERIO') && u.includes('SALUD'); };
                    const matchConsejoEduc = (s: string) => { const u = normUp(s); return u.includes('CONSEJO') && u.includes('EDUCAC'); };
                    const matchGroup = (e: typeof empleadoresConConteo[number], fn: (s: string) => boolean) =>
                      fn(e.nombre) || (!!e.masterName && fn(e.masterName)) || (!!e.empleadorParent && fn(e.empleadorParent));
                    const matchSA = (e: typeof empleadoresConConteo[number]) => e.tipo === 'S.A' || /\bS\.?A\.?\b(?!\.?[SE])/i.test(e.nombre);
                    const matchSRL = (e: typeof empleadoresConConteo[number]) => e.tipo === 'S.R.L' || /\bS\.?R\.?L\.?\b/i.test(e.nombre);
                    const matchSAS = (e: typeof empleadoresConConteo[number]) => e.tipo === 'S.A.S' || /\bS\.?A\.?S\.?\b/i.test(e.nombre);
                    const matchSE = (e: typeof empleadoresConConteo[number]) => e.tipo === 'S.E' || /\bS\.?E\.?\b/i.test(e.nombre);
                    const ENTIDAD_KEYWORDS = /\b(INSTITUTO|FACULTAD|UNIVERSIDAD|FUERZA|HOSPITAL|BANCO|CENTRO|MINISTERIO|SECRETARIA|DIRECCION|MUNICIPALIDAD|GOBIERNO|CONSEJO|ESCUELA|COLEGIO|CLUB|ASOCIACION|MUTUAL|SINDICATO|UNION|CAJA|EMPRESA|COOPERATIVA|SOCIEDAD|FUNDACION|OBRA|PENSION|JUBILACION|ARGENTINA|NACIONAL|PROVINCIAL|MUNICIPAL|PARROQUIA|IGLESIA|ESTADO|COMERCIAL|INDUSTRIAL|SERVICIOS|TRANSPORTE|SEGUROS|CAMARA|HONORABLE|JUZGADO|SUBSECRETARIA|COMISION|AREA|DEPARTAMENTO|SUPERINTENDENCIA|GENDARMERIA|POLICIA|JEFATURA|TESORERIA|ADMINISTRACION|REGISTRO|TRIBUNAL|FISCALIA|DEFENSORIA|COPNAF|PAMI|ANSES|AFIP|ARCA|S\.A|S\.R\.L|S\.A\.S|S\.E|LTDA|CIA|E\.I\.R\.L)\b/i;
                    const matchFisica = (e: typeof empleadoresConConteo[number]) => {
                      if (e.esDependencia) return false;
                      const nombre = e.nombre.trim();
                      if (ENTIDAD_KEYWORDS.test(nombre)) return false;
                      const partes = nombre.split(',');
                      if (partes.length !== 2) return false;
                      const [apellido, dado] = partes.map(s => s.trim());
                      if (!apellido || !dado) return false;
                      const palabrasTotal = nombre.split(/[\s,]+/).filter(Boolean).length;
                      if (palabrasTotal > 5) return false;
                      return /^[A-ZÁÉÍÓÚÑa-záéíóúñ,. -]+$/.test(nombre);
                    };

                    let filtered = busquedaEmpleadorModal.trim()
                      ? empleadoresConConteo.filter(e =>
                          e.nombre.toLowerCase().includes(busquedaEmpleadorModal.toLowerCase()) ||
                          e.tipo.toLowerCase().includes(busquedaEmpleadorModal.toLowerCase()) ||
                          e.categoria.toLowerCase().includes(busquedaEmpleadorModal.toLowerCase())
                        )
                      : empleadoresConConteo;

                    if (filtroTipoModal === 'gob_er') filtered = filtered.filter(e => matchGroup(e, matchGobER));
                    else if (filtroTipoModal === 'muni') filtered = filtered.filter(e => matchGroup(e, matchMuni));
                    else if (filtroTipoModal === 'min_salud') filtered = filtered.filter(e => matchGroup(e, matchMinSalud));
                    else if (filtroTipoModal === 'consejo_educ') filtered = filtered.filter(e => matchGroup(e, matchConsejoEduc));
                    else if (filtroTipoModal === 'sa') filtered = filtered.filter(matchSA);
                    else if (filtroTipoModal === 'srl') filtered = filtered.filter(matchSRL);
                    else if (filtroTipoModal === 'sas') filtered = filtered.filter(matchSAS);
                    else if (filtroTipoModal === 'se') filtered = filtered.filter(matchSE);
                    else if (filtroTipoModal === 'fisica') filtered = filtered.filter(matchFisica);

                    const renderTable = (items: typeof filtered, title?: string) => (
                      <div style={{ marginBottom: title ? 24 : 0 }}>
                        {title && (
                          <div className={styles.employerSectionTitle}>
                            <div />
                            {title} ({items.length})
                          </div>
                        )}
                        <div className={[styles["uOverflowXAuto"]].join(' ')}>
                          <table className={styles.employerTable}>
                            <thead>
                              <tr className={[styles["uBorderBottom1px-solid-border-subtle"]].join(' ')}>
                                <th className={[styles["uTextAlignLeft"], styles["uPadding12px"], styles["uColorText-muted"], styles["uFontWeight800"], styles["uTextTransformUppercase"]].join(' ')}>Empresa</th>
                                <th className={[styles["uTextAlignLeft"], styles["uPadding12px"], styles["uColorText-muted"], styles["uFontWeight800"], styles["uTextTransformUppercase"]].join(' ')}>Tipo</th>
                                <th className={[styles["uTextAlignLeft"], styles["uPadding12px"], styles["uColorText-muted"], styles["uFontWeight800"], styles["uTextTransformUppercase"]].join(' ')}>Categoría</th>
                                <th className={[styles["uTextAlignCenter"], styles["uPadding12px"], styles["uColorText-muted"], styles["uFontWeight800"], styles["uTextTransformUppercase"]].join(' ')}>Cant.</th>
                                <th className={[styles["uTextAlignCenter"], styles["uPadding12px"], styles["uColorText-muted"], styles["uFontWeight800"], styles["uTextTransformUppercase"]].join(' ')}>%</th>
                                <th className={[styles["uTextAlignRight"], styles["uPadding12px"], styles["uColorText-muted"], styles["uFontWeight800"], styles["uTextTransformUppercase"]].join(' ')}>Acciones</th>
                              </tr>
                            </thead>
                            <tbody>
                              {items.map((emp, idx) => {
                                const isMaster = emp.masterName === emp.nombre;
                                const totalGeneral = items.reduce((acc, curr) => acc + curr.cantidad, 0);
                                const porcentaje = totalGeneral > 0 ? ((emp.cantidad / totalGeneral) * 100).toFixed(1) : '0';
                                
                                return (
                                  <tr key={idx} className={isMaster ? styles.isMaster : ''}>
                                    <td className={[styles["uPadding12px"]].join(' ')}>
                                      <div className={[styles["uDisplayFlex"], styles["uFlexDirectionColumn"]].join(' ')}>
                                        <span className={styles.employerName}>{emp.nombre}</span>
                                      </div>
                                    </td>
                                    <td className={[styles["uPadding12px"]].join(' ')}>
                                      <span className={[styles["uPadding2px-8px"], styles["uBorderRadius4px"], styles["uBackgroundSurface-hover"], styles["uColorText-muted"], styles["uFontSize10px"], styles["uFontWeight700"]].join(' ')}>
                                        {emp.tipo}
                                      </span>
                                    </td>
                                    <td className={[styles["uPadding12px"]].join(' ')}>
                                      <span className={`${styles.employerCategory} ${emp.categoria === 'Estado' ? styles.isState : ''}`}>
                                        {emp.categoria}
                                      </span>
                                    </td>
                                    <td className={[styles["uPadding12px"], styles["uTextAlignCenter"]].join(' ')}>
                                      <span className={[styles["uFontWeight800"], styles["uColorText-muted"]].join(' ')}>{emp.cantidad}</span>
                                    </td>
                                    <td className={[styles["uPadding12px"], styles["uTextAlignCenter"]].join(' ')}>
                                      <span className={styles.employerPercentage}>
                                        {porcentaje}%
                                      </span>
                                    </td>
                                    <td className={[styles["uPadding12px"], styles["uTextAlignRight"]].join(' ')}>
                                      <div className={[styles["uDisplayFlex"], styles["uGap6px"], styles["uJustifyContentFlex-end"]].join(' ')}>
                                        <button
                                          onClick={() => {
                                            setEmpleadoresSeleccionados([emp.nombre]);
                                            setEmpleadorCorreccion(emp.nombre);
                                            setModalEmpleadoresOpen(false);
                                          }}
                                          className={styles.employerSelectButton}
                                        >
                                          Seleccionar
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );

                    if (filtered.length === 0) {
                      return (
                        <div className={[styles["uTextAlignCenter"], styles["uPadding40px"], styles["uColorText-muted"]].join(' ')}>
                          <p>No se encontraron empleadores</p>
                        </div>
                      );
                    }

                    const empleadores = filtered.filter(e => !e.esDependencia);
                    const dependencias = filtered.filter(e => e.esDependencia);
                    return (
                      <div className={[styles["uDisplayFlex"], styles["uFlexDirectionColumn"]].join(' ')}>
                        {empleadores.length > 0 && renderTable(empleadores, 'Empleadores')}
                        {dependencias.length > 0 && renderTable(dependencias, 'Dependencias')}
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* MODAL DE EMPLEADORES NUEVOS DE HOY */}
      {showEmpleadoresHoy && (
        <ModalPortal>
        <div
          className={styles.modalOverlay}
          onClick={() => setShowEmpleadoresHoy(false)}
        >
          <div
            className={`${styles.employerModal} ${styles.todayModal}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`${styles.employerModalHeader} ${styles.todayModalHeader}`}>
              <div>
                <h3 className={styles.employerModalTitle}>
                  Registros con Empleador
                </h3>
                <p className={styles.employerModalSubtitle}>
                  {empleadoresHoy.length} registro{empleadoresHoy.length !== 1 ? 's' : ''} con empleador cargado
                </p>
              </div>
              <div className={styles.todayDateFilters}>
                <label className={styles.todayDateField}>
                  <span>Desde</span>
                  <input
                    type="date"
                    value={fechaDesdeHoy}
                    onChange={e => setFechaDesdeHoy(e.target.value)}
                    className={styles.todayDateInput}
                  />
                </label>
                <label className={styles.todayDateField}>
                  <span>Hasta</span>
                  <input
                    type="date"
                    value={fechaHastaHoy}
                    onChange={e => setFechaHastaHoy(e.target.value)}
                    className={styles.todayDateInput}
                  />
                </label>
              </div>
              <div className={styles.employerModalActions}>
                <button
                  onClick={async () => {
                    if (!confirm(`¿Eliminar ${empleadoresHoy.length} registros de la base de datos? Esta acción es irreversible.`)) return;
                    
                    setLoadingEmpleadoresHoy(true);
                    try {
                      const ids = empleadoresHoy.map(r => r.id);
                      const { error } = await supabase.from('registros').delete().in('id', ids);
                      if (error) throw error;
                      
                      setEmpleadoresHoy([]);
                      setShowEmpleadoresHoy(false);
                      setToast({ message: `${ids.length} registros eliminados`, type: 'success' });
                    } catch {
                      setToast({ message: 'Error al eliminar registros', type: 'error' });
                    } finally {
                      setLoadingEmpleadoresHoy(false);
                    }
                  }}
                  className={`${styles.employerModalButton} ${styles.isDanger}`}
                >
                  <Trash2 size={14} /> Eliminar
                </button>
                <button
                  onClick={() => setShowEmpleadoresHoy(false)}
                  className={styles.employerModalButton}
                >
                  <X size={14} /> Cerrar
                </button>
              </div>
            </div>

            <div className={styles.employerModalContent}>
              {loadingEmpleadoresHoy ? (
                <div className={[styles["uDisplayFlex"], styles["uAlignItemsCenter"], styles["uJustifyContentCenter"], styles["uPadding40px"]].join(' ')}>
                  <Loader2 size={24} className={["animate-spin", styles["uColor34d399"]].filter(Boolean).join(' ')}  />
                </div>
              ) : empleadoresHoy.length === 0 ? (
                <div className={[styles["uTextAlignCenter"], styles["uPadding40px"], styles["uColorText-muted"]].join(' ')}>
                  <p>No se encontraron registros creados hoy.</p>
                </div>
              ) : (
                <table className={styles.employerTable}>
                  <thead>
                    <tr>
                      <th className={[styles["uTextAlignLeft"], styles["uPadding10px-12px"], styles["uColorText-muted"], styles["uFontWeight700"], styles["uFontSize10px"], styles["uTextTransformUppercase"]].join(' ')}>CUIL</th>
                      <th className={[styles["uTextAlignLeft"], styles["uPadding10px-12px"], styles["uColorText-muted"], styles["uFontWeight700"], styles["uFontSize10px"], styles["uTextTransformUppercase"]].join(' ')}>Apellido y Nombre</th>
                      <th className={[styles["uTextAlignLeft"], styles["uPadding10px-12px"], styles["uColorText-muted"], styles["uFontWeight700"], styles["uFontSize10px"], styles["uTextTransformUppercase"]].join(' ')}>Empleador</th>
                      <th className={[styles["uTextAlignLeft"], styles["uPadding10px-12px"], styles["uColorText-muted"], styles["uFontWeight700"], styles["uFontSize10px"], styles["uTextTransformUppercase"]].join(' ')}>Dependencia</th>
                      <th className={[styles["uTextAlignRight"], styles["uPadding10px-12px"], styles["uColorText-muted"], styles["uFontWeight700"], styles["uFontSize10px"], styles["uTextTransformUppercase"]].join(' ')}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {empleadoresHoy.map((r) => {
                      const editing = editandoHoyId === r.id;
                      return (
                      <tr
                        key={r.id}
                        className={editing ? styles.isEditing : ''}
                      >
                        <td className={[styles["uPadding10px-12px"], styles["uColorText-muted"], styles["uFontFamilyMonospace"], styles["uFontSize12px"]].join(' ')}>{r.cuil || '-'}</td>
                        <td className={[styles["uPadding10px-12px"], styles["uColorText-secondary"], styles["uFontWeight600"], styles["uFontSize12px"]].join(' ')}>{r.nombre || '-'}</td>
                        <td className={[styles["uPadding10px-12px"], styles["uColorText-secondary"], styles["uFontWeight600"], styles["uFontSize12px"], styles["uMinWidth220px"]].join(' ')}>
                          {editing
                            ? <ComboEditable value={editHoyEmpleador} onChange={setEditHoyEmpleador} options={allEmpleadoresList} placeholder="Elegí o escribí…" accent="#34d399" />
                            : (r.empleador || '-')}
                        </td>
                        <td className={[styles["uPadding10px-12px"], styles["uColorText-secondary"], styles["uFontWeight600"], styles["uFontSize12px"], styles["uMinWidth220px"]].join(' ')}>
                          {editing
                            ? <ComboEditable value={editHoyDependencia} onChange={setEditHoyDependencia} options={dependenciasParaEmpleador.length > 0 ? dependenciasParaEmpleador : allDependenciasList} placeholder="Elegí o escribí…" accent="#60a5fa" />
                            : (r.dependencia || '-')}
                        </td>
                        <td className={[styles["uPadding10px-12px"], styles["uTextAlignRight"], styles["uWhiteSpaceNowrap"]].join(' ')}>
                          {editing ? (
                            <div className={[styles["uDisplayFlex"], styles["uGap6px"], styles["uJustifyContentFlex-end"]].join(' ')}>
                              <button onClick={() => guardarEdicionHoy(r.id)} title="Guardar" className={`${styles.iconAction} ${styles.iconActionSave}`}>
                                <Save size={13} />
                              </button>
                              <button onClick={cancelarEdicionHoy} title="Cancelar" className={`${styles.iconAction} ${styles.iconActionCancel}`}>
                                <X size={13} />
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => iniciarEdicionHoy(r)} title="Editar" className={`${styles.iconAction} ${styles.iconActionEdit}`}>
                              <Pencil size={13} />
                            </button>
                          )}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
}
