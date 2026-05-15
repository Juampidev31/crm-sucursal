'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { STATUS_LABEL } from '@/lib/utils';
import { ESTADOS } from '@/context/FilterContext';
import { CONFIG } from '@/types';
import { useRegistros } from '@/features/registros/RegistrosProvider';
import {
  Users, AlertTriangle, Save, X, Filter, CheckCircle,
  Search, ChevronDown, ChevronUp, Loader2, Trash2, ShieldCheck
} from 'lucide-react';
import { parsePastedText, normalizeCuil, ParsedRow } from '@/lib/verificador-utils';
import { Registro } from '@/types';

const ANALISTAS = CONFIG.ANALISTAS_DEFAULT;

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

const TIPO_CLIENTE_OPCIONES = ['Apertura', 'Renovacion'];
const RANGOS_ETARIOS = ['18-25', '26-35', '36-45', '46-55', '56-65', '65+'];
const SEXOS = ['Masculino', 'Femenino', 'Otro'];
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

const EMPTY_CAMPOS: CamposAModificar = {
  estado: '', analista: '', acuerdo_precios: '', tipo_cliente: '',
  cuotas: '', rango_etario: '', sexo: '', empleador: '', localidad: '',
  es_re: '', comentarios: '',
};

interface AsignarEmpleadorSectionProps {
  registros: Registro[];
  allEmpleadores: string[];
  mutateRegistros: (fn: (prev: Registro[]) => Registro[]) => void;
  refresh: (silent?: boolean) => void;
  applyRegistroChange: (type: 'INSERT' | 'UPDATE' | 'DELETE', reg: Registro) => void;
  pushRegistroChange: (type: 'INSERT' | 'UPDATE' | 'DELETE', reg: Registro) => void;
}

function AsignarEmpleadorSection({ registros, allEmpleadores, mutateRegistros, refresh, applyRegistroChange, pushRegistroChange }: AsignarEmpleadorSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [cuilCol, setCuilCol] = useState<number | null>(null);
  const [nombreCol, setNombreCol] = useState<number | null>(null);
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
  const [assignError, setAssignError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [step, setStep] = useState<'paste' | 'match' | 'assign'>('paste');

  const previewRows = rows.slice(0, 5);
  const colCount = rows[0]?.cells.length ?? 0;

  const matchedRows = useMemo(() => {
    if (!searched || cuilCol === null || rows.length === 0) return [];
    return rows
      .map(r => {
        const cuil = normalizeCuil(r.cells[cuilCol] ?? '');
        const nombre = nombreCol !== null ? (r.cells[nombreCol] ?? '') : '';
        const found = registros.filter(reg => normalizeCuil(reg.cuil) === cuil);
        return { cuil, nombre, registros: found };
      })
      .filter(r => r.cuil !== '');
  }, [searched, rows, cuilCol, nombreCol, registros]);

  const allMatchedIds = useMemo(
    () => matchedRows.flatMap(r => r.registros.map(reg => reg.id)),
    [matchedRows]
  );

  const totalClientes = matchedRows.length;
  const totalRegistros = allMatchedIds.length;
  const totalSeleccionados = selectedIds.size;
  const { totalCompletos, totalConFaltantes } = useMemo(() => {
    let completos = 0, faltantes = 0;
    matchedRows.forEach(mr => mr.registros.forEach(r => {
      const missing: string[] = [];
      if (!r.nombre?.trim()) missing.push('x');
      if (!r.cuil?.trim() || r.cuil.length !== 11) missing.push('x');
      if (!r.analista) missing.push('x');
      if (!r.estado) missing.push('x');
      const req = r.estado === 'venta' || r.estado === 'derivado / aprobado cc';
      if (req) {
        if (!r.tipo_cliente) missing.push('x');
        if (!r.acuerdo_precios) missing.push('x');
        if (!r.cuotas?.trim()) missing.push('x');
        if (!r.rango_etario) missing.push('x');
        if (!r.sexo) missing.push('x');
        if (!r.empleador?.trim()) missing.push('x');
        if (!r.localidad?.trim()) missing.push('x');
      }
      if ((esGobiernoProvincialBulk(r.empleador) || esMunicipalidadParanaBulk(r.empleador) || esConsejoEducacionBulk(r.empleador)) && !r.dependencia?.trim()) missing.push('x');
      if (r.estado === 'derivado / rechazado cc' && !r.comentarios?.trim()) missing.push('x');
      if (missing.length === 0) completos++; else faltantes++;
    }));
    return { totalCompletos: completos, totalConFaltantes: faltantes };
  }, [matchedRows]);
  const allSelected = allMatchedIds.length > 0 && allMatchedIds.every(id => selectedIds.has(id));
  const someSelected = !allSelected && allMatchedIds.some(id => selectedIds.has(id));

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
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(allMatchedIds));
  };

  const toggleClient = (ids: string[]) => {
    preserveScroll();
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
    setNombreCol(null);
    setSearched(false);
    setAssignResult(null);
    setAssignError(null);
    setConfirming(false);
    setCamposExcel({ ...EMPTY_CAMPOS_EXCEL });
    setSelectedIds(new Set());
    if (parsed.length > 0) setStep('match');
  };

  const handleSearch = () => {
    setSearched(true);
    setAssignResult(null);
    setAssignError(null);
    setConfirming(false);
    setStep('assign');
  };

  // Limpiar selección al re-buscar
  useEffect(() => {
    if (!searched) setSelectedIds(new Set());
  }, [searched]);

  // Devuelve los campos obligatorios que faltan en un registro (según validarForm del modal)
  const getMissingFields = (r: Registro): string[] => {
    const missing: string[] = [];
    if (!r.nombre?.trim()) missing.push('nombre');
    if (!r.cuil?.trim() || r.cuil.length !== 11) missing.push('cuil');
    if (!r.analista) missing.push('analista');
    if (!r.estado) missing.push('estado');
    const requiereTyA = r.estado === 'venta' || r.estado === 'derivado / aprobado cc';
    if (requiereTyA) {
      if (!r.tipo_cliente) missing.push('tipo_cliente');
      if (!r.acuerdo_precios) missing.push('acuerdo_precios');
      if (!r.cuotas?.trim()) missing.push('cuotas');
      if (!r.rango_etario) missing.push('rango_etario');
      if (!r.sexo) missing.push('sexo');
      if (!r.empleador?.trim()) missing.push('empleador');
      if (!r.localidad?.trim()) missing.push('localidad');
    }
    if ((esGobiernoProvincialBulk(r.empleador) || esMunicipalidadParanaBulk(r.empleador) || esConsejoEducacionBulk(r.empleador)) && !r.dependencia?.trim()) {
      missing.push('dependencia');
    }
    if (r.estado === 'derivado / rechazado cc' && !r.comentarios?.trim()) {
      missing.push('comentarios');
    }
    return missing;
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
  const allAnalistasExcel = useMemo(() => dedupCI(registros.map(r => r.analista), ANALISTAS), [registros]);
  const allEstadosExcel = useMemo(() => dedupCI(registros.map(r => r.estado)), [registros]);
  const allTiposExcel = useMemo(() => dedupCI(registros.map(r => r.tipo_cliente), TIPO_CLIENTE_OPCIONES), [registros]);
  const allAcuerdosExcel = useMemo(() => dedupCI(registros.map(r => r.acuerdo_precios), ACUERDOS_OPCIONES), [registros]);
  const allLocalidadesExcel = useMemo(() => dedupCI(registros.map(r => r.localidad)), [registros]);
  const allDependenciasExcel = useMemo(() => dedupCI(registros.map(r => r.dependencia)), [registros]);
  const allCuotasExcel = useMemo(() => dedupCI(registros.map(r => r.cuotas)), [registros]);
  const allRangosExcel = useMemo(() => dedupCI(registros.map(r => r.rango_etario), RANGOS_ETARIOS), [registros]);
  const allSexosExcel = useMemo(() => dedupCI(registros.map(r => r.sexo), SEXOS), [registros]);

  // Construye payload solo con campos llenos
  const buildPayload = (): Record<string, unknown> => {
    const p: Record<string, unknown> = {};
    if (camposExcel.empleador.trim()) p.empleador = camposExcel.empleador.trim();
    if (camposExcel.dependencia.trim()) p.dependencia = camposExcel.dependencia.trim();
    if (camposExcel.analista.trim()) p.analista = camposExcel.analista.trim();
    if (camposExcel.estado.trim()) p.estado = camposExcel.estado.trim();
    if (camposExcel.tipo_cliente.trim()) p.tipo_cliente = camposExcel.tipo_cliente.trim();
    if (camposExcel.acuerdo_precios.trim()) p.acuerdo_precios = camposExcel.acuerdo_precios.trim();
    if (camposExcel.cuotas.trim()) p.cuotas = camposExcel.cuotas.trim();
    if (camposExcel.rango_etario.trim()) p.rango_etario = camposExcel.rango_etario.trim();
    if (camposExcel.sexo.trim()) p.sexo = camposExcel.sexo.trim();
    if (camposExcel.localidad.trim()) p.localidad = camposExcel.localidad.trim();
    if (camposExcel.comentarios.trim()) p.comentarios = camposExcel.comentarios.trim();
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
      const updatedRegs = registros.filter(r => idsSet.has(r.id)).map(r => ({ ...r, ...payload }));
      mutateRegistros(prev =>
        prev.map(r => idsSet.has(r.id) ? { ...r, ...payload } : r)
      );
      updatedRegs.forEach(reg => {
        applyRegistroChange('UPDATE', reg);
        pushRegistroChange('UPDATE', reg);
      });
      refresh(true);
    } else {
      setAssignError(error.message);
    }
  };

  const thStyle: React.CSSProperties = {
    padding: '8px 12px', fontSize: 10, fontWeight: 700,
    color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px',
    textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.06)',
  };
  const tdStyle: React.CSSProperties = {
    padding: '9px 12px', fontSize: 12, color: '#ccc',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  };

  return (
    <div style={{
      marginBottom: '28px', padding: '20px',
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: '10px',
    }}>
      <div
        onClick={() => setExpanded(v => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: expanded ? 16 : 0, cursor: 'pointer' }}
      >
        <Users size={18} color="#555" />
        <h4 style={{ fontSize: '14px', fontWeight: 800, color: '#888', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 8 }}>
          Asignar Campos desde Excel
          {expanded ? <ChevronUp size={14} style={{ opacity: 0.5 }} /> : <ChevronDown size={14} style={{ opacity: 0.5 }} />}
        </h4>
      </div>

      {expanded && (() => {
        const stepBtn = (n: number, label: string, isActive: boolean, isDone: boolean, isDisabled: boolean, onClick: () => void): React.ReactNode => (
          <button
            key={n}
            onClick={onClick}
            disabled={isDisabled}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
              background: isActive ? 'rgba(99,102,241,0.12)' : 'transparent',
              border: `1px solid ${isActive ? 'rgba(99,102,241,0.4)' : isDone ? 'rgba(74,222,128,0.25)' : 'rgba(255,255,255,0.06)'}`,
              borderRadius: 999, fontSize: 11, fontWeight: 700,
              color: isActive ? '#a5b4fc' : isDone ? '#4ade80' : '#555',
              cursor: isDisabled ? 'not-allowed' : 'pointer', opacity: isDisabled ? 0.4 : 1,
            }}
          >
            <span style={{
              width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 800,
              background: isActive ? 'rgba(99,102,241,0.35)' : isDone ? 'rgba(74,222,128,0.25)' : 'rgba(255,255,255,0.05)',
              color: isActive ? '#c7d2fe' : isDone ? '#4ade80' : '#666',
            }}>{isDone && !isActive ? '✓' : n}</span>
            {label}
          </button>
        );
        return (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
            {stepBtn(1, 'Pegar Excel', step === 'paste', rows.length > 0, false, () => setStep('paste'))}
            <span style={{ color: '#333', fontSize: 12 }}>›</span>
            {stepBtn(2, rows.length > 0 ? `Columnas (${rows.length} fila${rows.length !== 1 ? 's' : ''})` : 'Columnas', step === 'match', searched, rows.length === 0, () => { if (rows.length > 0) setStep('match'); })}
            <span style={{ color: '#333', fontSize: 12 }}>›</span>
            {stepBtn(3, searched ? `Asignar (${totalSeleccionados}/${totalRegistros})` : 'Asignar campos', step === 'assign', false, !searched, () => { if (searched) setStep('assign'); })}
          </div>

          {step === 'paste' && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 9, color: '#444', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>
              Pegar celdas de Excel (CUIL + Apellido/Nombre)
            </label>
            <textarea
              className="form-input"
              rows={4}
              placeholder="Pegá acá las celdas copiadas de Excel..."
              value={pastedText}
              onChange={e => setPastedText(e.target.value)}
              style={{ width: '100%', fontFamily: 'monospace', fontSize: 11, resize: 'vertical' }}
            />
            <button
              onClick={handleParse}
              disabled={!pastedText.trim()}
              style={{
                marginTop: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700,
                background: pastedText.trim() ? '#2d2f5e' : '#1a1a1a',
                border: `1px solid ${pastedText.trim() ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 6, cursor: pastedText.trim() ? 'pointer' : 'not-allowed',
                color: pastedText.trim() ? '#a5b4fc' : '#444',
              }}
            >
              Cargar
            </button>
          </div>
          )}

          {step === 'match' && rows.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: '#555', marginBottom: 8 }}>
                {rows.length} fila{rows.length !== 1 ? 's' : ''} detectada{rows.length !== 1 ? 's' : ''}. Asigná las columnas:
              </div>
              <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
                <div>
                  <label style={{ fontSize: 9, color: '#444', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: 4 }}>
                    Columna CUIL *
                  </label>
                  <select
                    value={cuilCol ?? ''}
                    onChange={e => { setCuilCol(e.target.value === '' ? null : Number(e.target.value)); setSearched(false); }}
                    style={{
                      fontSize: 12, padding: '6px 10px', borderRadius: 6,
                      background: '#1a1a1a', color: '#ccc',
                      border: '1px solid rgba(255,255,255,0.12)', outline: 'none',
                      cursor: 'pointer', minWidth: 180,
                    }}
                  >
                    <option value="">— seleccionar —</option>
                    {Array.from({ length: colCount }, (_, i) => (
                      <option key={i} value={i}>Col {i + 1}: {previewRows[0]?.cells[i] ?? ''}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ overflowX: 'auto', marginBottom: 12 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr>
                      {Array.from({ length: colCount }, (_, i) => (
                        <th key={i} style={thStyle}>
                          Col {i + 1}{i === cuilCol ? ' (CUIL)' : ''}{i === nombreCol ? ' (Nombre)' : ''}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, ri) => (
                      <tr key={ri}>
                        {row.cells.map((cell, ci) => (
                          <td key={ci} style={{
                            ...tdStyle,
                            background: ci === cuilCol ? 'rgba(99,102,241,0.06)' : ci === nombreCol ? 'rgba(74,222,128,0.04)' : undefined,
                          }}>
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                onClick={handleSearch}
                disabled={cuilCol === null}
                style={{
                  padding: '6px 14px', fontSize: 12, fontWeight: 700,
                  background: cuilCol !== null ? '#2d2f5e' : '#1a1a1a',
                  border: `1px solid ${cuilCol !== null ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 6, cursor: cuilCol !== null ? 'pointer' : 'not-allowed',
                  color: cuilCol !== null ? '#a5b4fc' : '#444',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <Search size={12} />
                Buscar en registros
              </button>
            </div>
          )}

          {step === 'assign' && searched && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: '#555', marginBottom: 8 }}>
                {totalRegistros} registro{totalRegistros !== 1 ? 's' : ''} en total de {totalClientes} cliente{totalClientes !== 1 ? 's' : ''}
                {' · '}
                <span style={{ color: '#4ade80', fontWeight: 700 }}>{totalCompletos} completo{totalCompletos !== 1 ? 's' : ''}</span>
                {' · '}
                <span style={{ color: '#f87171', fontWeight: 700 }}>{totalConFaltantes} con faltantes</span>
                {' · '}
                <span style={{ color: '#a5b4fc', fontWeight: 700 }}>{totalSeleccionados} seleccionado{totalSeleccionados !== 1 ? 's' : ''}</span>
              </div>
              <style>{`
                .bulk-excel-row { transition: background 80ms ease; }
                .bulk-excel-row:hover > td { background: rgba(99,102,241,0.10) !important; }
                .bulk-excel-row.is-selected > td,
                .bulk-excel-row.is-selected:hover > td { background: rgba(74,222,128,0.12) !important; }
              `}</style>
              <div style={{ overflowX: 'auto', maxHeight: 320, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead style={{ position: 'sticky', top: 0, background: '#111' }}>
                    <tr>
                      <th style={{ ...thStyle, width: 36, textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={allSelected}
                          ref={el => { if (el) el.indeterminate = someSelected; }}
                          onChange={toggleAll}
                          style={{ cursor: 'pointer' }}
                          title="Seleccionar todos"
                        />
                      </th>
                      <th style={thStyle}>CUIL</th>
                      <th style={thStyle}>APELLIDO Y NOMBRE</th>
                      <th style={thStyle}>FECHA</th>
                      <th style={thStyle}>CANTIDAD DE REGISTROS</th>
                      <th style={thStyle}>EMPLEADOR ACTUAL</th>
                      <th style={thStyle}>DEPENDENCIA ACTUAL</th>
                      <th style={thStyle}>FALTANTES</th>
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
                          return <span style={{ fontSize: 10, color: '#4ade80', fontWeight: 700 }}>✓ Completo</span>;
                        }
                        const fixed = isSelected ? missing.filter(willFill) : [];
                        const stillMissing = isSelected ? missing.filter(f => !willFill(f)) : missing;
                        return (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {fixed.map(f => (
                              <span key={f} style={{
                                fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                                background: 'rgba(74,222,128,0.12)', color: '#4ade80',
                                border: '1px solid rgba(74,222,128,0.3)', textTransform: 'uppercase', letterSpacing: '0.5px',
                              }} title="Se completará al aplicar">✓ {f}</span>
                            ))}
                            {stillMissing.map(f => (
                              <span key={f} style={{
                                fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                                background: 'rgba(248,113,113,0.12)', color: '#f87171',
                                border: '1px solid rgba(248,113,113,0.3)', textTransform: 'uppercase', letterSpacing: '0.5px',
                              }}>{f}</span>
                            ))}
                          </div>
                        );
                      };

                      return matchedRows.flatMap((mr, i) => {
                        const nombresDB = [...new Set(mr.registros.map(r => r.nombre).filter(Boolean))].join(' | ');
                        const nombreExcel = mr.nombre === mr.cuil ? '' : mr.nombre;
                        const nombreMostrar = nombresDB || nombreExcel || '—';

                        // Sin registros
                        if (mr.registros.length === 0) {
                          return [(
                            <tr key={`${i}-empty`} className="bulk-excel-row" style={{ opacity: 0.4 }}>
                              <td style={{ ...tdStyle, textAlign: 'center' }} />
                              <td style={tdStyle}>{mr.cuil}</td>
                              <td style={tdStyle}>{nombreMostrar}</td>
                              <td style={tdStyle}>—</td>
                              <td style={{ ...tdStyle, color: '#555' }}>Sin registros</td>
                              <td style={tdStyle}>—</td>
                              <td style={tdStyle}>—</td>
                              <td style={tdStyle}>—</td>
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
                            <tr key={`${i}-group`} className="bulk-excel-row" style={{ background: 'rgba(99,102,241,0.04)' }}>
                              <td style={{ ...tdStyle, textAlign: 'center' }}>
                                <input
                                  type="checkbox"
                                  checked={groupAllSelected}
                                  ref={el => { if (el) el.indeterminate = groupSomeSelected; }}
                                  onChange={() => toggleClient(rowIds)}
                                  style={{ cursor: 'pointer' }}
                                  title="Seleccionar/deseleccionar todos del cliente"
                                />
                              </td>
                              <td style={{ ...tdStyle, fontWeight: 700 }}>{mr.cuil}</td>
                              <td style={{ ...tdStyle, fontWeight: 700 }}>{nombreMostrar}</td>
                              <td style={tdStyle} colSpan={5}>
                                <span style={{ fontSize: 10, color: '#a5b4fc', fontWeight: 700 }}>{mr.registros.length} registros — elegí cuáles modificar</span>
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
                              className={`bulk-excel-row${checked ? ' is-selected' : ''}`}
                              onClick={(e) => {
                                if ((e.target as HTMLElement).closest('input')) return;
                                toggleClient([reg.id]);
                              }}
                              style={{ cursor: 'pointer' }}
                            >
                              <td style={{ ...tdStyle, textAlign: 'center', paddingLeft: isMulti ? 24 : 12 }}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleClient([reg.id])}
                                  style={{ cursor: 'pointer' }}
                                />
                              </td>
                              <td style={tdStyle}>{isMulti ? <span style={{ color: '#555' }}>↳ #{ri + 1}</span> : mr.cuil}</td>
                              <td style={tdStyle}>{isMulti ? '' : nombreMostrar}</td>
                              <td style={tdStyle}>{fmtFecha(reg)}</td>
                              <td style={{ ...tdStyle, color: '#ccc' }}>{isMulti ? '' : 1}</td>
                              <td style={tdStyle}>{reg.empleador || '—'}</td>
                              <td style={tdStyle}>{reg.dependencia || '—'}</td>
                              <td style={tdStyle}>{renderFaltantes(missing, checked)}</td>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 10, color: '#666', fontStyle: 'italic', marginBottom: 4 }}>
                Llená sólo los campos que querés modificar. Los vacíos no se tocan.
              </div>
              <style>{`.bulk-fields-row > div { flex: 0 0 150px; min-width: 150px; }`}</style>
              <div className="bulk-fields-row" style={{ display: 'flex', flexWrap: 'nowrap', overflowX: 'auto', gap: 10, paddingBottom: 4 }}>
                {(() => {
                  const labelStyle: React.CSSProperties = { fontSize: 9, color: '#888', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: 4 };
                  const selectStyle: React.CSSProperties = { width: '100%', fontSize: 12, padding: '6px 8px', background: '#1a1a1a', color: '#ddd', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, outline: 'none' };
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
                          <label style={labelStyle}>{f.label}</label>
                          <select value={camposExcel[f.key]} onChange={e => setField(f.key)(e.target.value)} style={selectStyle}>
                            <option value="" style={{ background: '#1a1a1a', color: '#888' }}>— no cambiar —</option>
                            {f.opts.map(o => <option key={o} value={o} style={{ background: '#1a1a1a', color: '#ddd' }}>{o}</option>)}
                          </select>
                        </div>
                      ))}
                      {inputs.map(f => (
                        <div key={f.key}>
                          <label style={labelStyle}>{f.label}</label>
                          <input
                            className="form-input"
                            list={`excel-dl-${f.key}`}
                            value={camposExcel[f.key]}
                            onChange={e => setField(f.key)(e.target.value)}
                            style={{ width: '100%', fontSize: 12 }}
                          />
                          <datalist id={`excel-dl-${f.key}`}>
                            {f.list.map(v => <option key={v} value={v} />)}
                          </datalist>
                        </div>
                      ))}
                      <div>
                        <label style={labelStyle}>Es RE</label>
                        <select value={camposExcel.es_re} onChange={e => setField('es_re')(e.target.value)} style={selectStyle}>
                          <option value="" style={{ background: '#1a1a1a', color: '#888' }}>— no cambiar —</option>
                          <option value="si" style={{ background: '#1a1a1a', color: '#ddd' }}>Sí</option>
                          <option value="no" style={{ background: '#1a1a1a', color: '#ddd' }}>No</option>
                        </select>
                      </div>
                      <div>
                        <label style={labelStyle}>Puntaje</label>
                        <input type="number" className="form-input" value={camposExcel.puntaje} onChange={e => setField('puntaje')(e.target.value)} style={{ width: '100%', fontSize: 12 }} />
                      </div>
                      <div>
                        <label style={labelStyle}>Monto</label>
                        <input type="number" className="form-input" value={camposExcel.monto} onChange={e => setField('monto')(e.target.value)} style={{ width: '100%', fontSize: 12 }} />
                      </div>
                      <div>
                        <label style={labelStyle}>Fecha</label>
                        <input type="date" className="form-input" value={camposExcel.fecha} onChange={e => setField('fecha')(e.target.value)} style={{ width: '100%', fontSize: 12 }} />
                      </div>
                    </>
                  );
                })()}
              </div>
              <div>
                <label style={{ fontSize: 9, color: '#444', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: 4 }}>Comentarios</label>
                <textarea className="form-input" rows={2} value={camposExcel.comentarios} onChange={e => { setCamposExcel(p => ({ ...p, comentarios: e.target.value })); setConfirming(false); }} style={{ width: '100%', fontSize: 12, resize: 'vertical' }} />
              </div>

              <div style={{
                position: 'sticky', bottom: 0, zIndex: 5,
                marginLeft: -20, marginRight: -20, marginBottom: -20,
                padding: '12px 20px',
                background: 'linear-gradient(to top, #0e0e10 70%, rgba(14,14,16,0.85))',
                borderTop: '1px solid rgba(255,255,255,0.06)',
                display: 'flex', flexDirection: 'column', gap: 8,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 11 }}>
                  <span style={{ color: '#888' }}>
                    <span style={{ color: '#a5b4fc', fontWeight: 700 }}>{totalSeleccionados}</span> seleccionado{totalSeleccionados !== 1 ? 's' : ''}
                    {hayCampos && <> · <span style={{ color: '#4ade80' }}>{Object.keys(payloadPreview).length} campo{Object.keys(payloadPreview).length !== 1 ? 's' : ''}</span></>}
                  </span>
                  {hayCampos && (
                    <span style={{ color: '#a5b4fc', fontSize: 10 }}>
                      → {Object.keys(payloadPreview).join(', ')}
                    </span>
                  )}
                </div>

              {!confirming ? (
                <button
                  onClick={() => { if (hayCampos && totalSeleccionados > 0) setConfirming(true); }}
                  disabled={!hayCampos || totalSeleccionados === 0}
                  style={{
                    alignSelf: 'flex-start', padding: '6px 14px', fontSize: 12, fontWeight: 700,
                    background: hayCampos && totalSeleccionados > 0 ? '#2d2f5e' : '#1a1a1a',
                    border: `1px solid ${hayCampos && totalSeleccionados > 0 ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)'}`,
                    borderRadius: 6, cursor: hayCampos && totalSeleccionados > 0 ? 'pointer' : 'not-allowed',
                    color: hayCampos && totalSeleccionados > 0 ? '#a5b4fc' : '#444',
                  }}
                >
                  Asignar a seleccionados ({totalSeleccionados} registro{totalSeleccionados !== 1 ? 's' : ''})
                </button>
              ) : (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, color: '#f87171', fontWeight: 600 }}>
                    ⚠ Se actualizarán {totalSeleccionados} registro{totalSeleccionados !== 1 ? 's' : ''}
                  </span>
                  <button
                    onClick={handleAssign}
                    disabled={assigning}
                    style={{
                      padding: '6px 14px', fontSize: 12, fontWeight: 700,
                      background: assigning ? '#1a1a1a' : '#5a1a1a',
                      border: '1px solid rgba(248,113,113,0.5)',
                      borderRadius: 6, cursor: assigning ? 'not-allowed' : 'pointer',
                      color: '#fff',
                    }}
                  >
                    {assigning ? 'Guardando...' : '⚠ Confirmar'}
                  </button>
                  <button
                    onClick={() => setConfirming(false)}
                    disabled={assigning}
                    style={{
                      padding: '6px 14px', fontSize: 12, fontWeight: 600,
                      background: 'transparent',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 6, cursor: 'pointer', color: '#666',
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              )}

              {assignError && (
                <div style={{ fontSize: 12, color: '#f87171', padding: '8px 12px', background: 'rgba(248,113,113,0.08)', borderRadius: 6 }}>
                  Error: {assignError}
                </div>
              )}
              </div>
            </div>
          )}

          {assignResult && (
            <div style={{
              padding: '10px 16px', background: 'rgba(74,222,128,0.08)',
              border: '1px solid rgba(74,222,128,0.2)', borderRadius: 8,
              fontSize: 12, color: '#4ade80', fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
            }}>
              <span>✓ {assignResult.updated} registro{assignResult.updated !== 1 ? 's' : ''} actualizado{assignResult.updated !== 1 ? 's' : ''}.</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => {
                    setAssignResult(null);
                    setCamposExcel({ ...EMPTY_CAMPOS_EXCEL });
                    setSelectedIds(new Set());
                    setConfirming(false);
                  }}
                  style={{
                    padding: '5px 12px', fontSize: 11, fontWeight: 700,
                    background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.35)',
                    borderRadius: 6, cursor: 'pointer', color: '#4ade80',
                  }}
                >
                  Seguir con estos registros
                </button>
                <button
                  onClick={() => {
                    setPastedText('');
                    setRows([]);
                    setCuilCol(null);
                    setNombreCol(null);
                    setSearched(false);
                    setSelectedIds(new Set());
                    setCamposExcel({ ...EMPTY_CAMPOS_EXCEL });
                    setAssignResult(null);
                    setAssignError(null);
                    setConfirming(false);
                    setStep('paste');
                  }}
                  style={{
                    padding: '5px 12px', fontSize: 11, fontWeight: 700,
                    background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.35)',
                    borderRadius: 6, cursor: 'pointer', color: '#a5b4fc',
                  }}
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

export default function BulkModifyTab({ mode = 'all' }: { mode?: 'all' | 'corrector' | 'bulk' }) {
  const [filtros, setFiltros] = useState<Filtros>(EMPTY_FILTROS);
  const [campos, setCampos] = useState<CamposAModificar>(EMPTY_CAMPOS);
  const [previewCount, setPreviewCount] = useState(0);
  const [previewIds, setPreviewIds] = useState<Set<string>>(new Set());
  const [step, setStep] = useState<'filter' | 'confirm' | 'done'>('filter');
  const [updating, setUpdating] = useState(false);
  const [updatedCount, setUpdatedCount] = useState(0);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const { registros, mutateRegistros, pushBulkRefresh, refresh, applyRegistroChange, pushRegistroChange } = useRegistros();

  // Derivar datos de filtros directamente de registros (reactivo)
  const allEstados = useMemo(() => Array.from(new Set(registros.map(r => r.estado).filter(Boolean))).sort(), [registros]);
  const allAnalistas = useMemo(() => Array.from(new Set(registros.map(r => r.analista).filter(Boolean))).sort(), [registros]);
  const allAcuerdos = useMemo(() => Array.from(new Set(registros.map(r => r.acuerdo_precios).filter(Boolean))).sort() as string[], [registros]);
  const allTipos = useMemo(() => Array.from(new Set(registros.map(r => r.tipo_cliente).filter(Boolean))).sort() as string[], [registros]);
  const allLocalidades = useMemo(() => Array.from(new Set(registros.map(r => r.localidad).filter(Boolean))).sort() as string[], [registros]);
  const allEmpleadores = useMemo(() => Array.from(new Set(registros.map(r => r.empleador).filter(Boolean))).sort() as string[], [registros]);
  const [empleadorCorreccion, setEmpleadorCorreccion] = useState<string>('');
  const [empleadoresSeleccionados, setEmpleadoresSeleccionados] = useState<string[]>([]);
  const [mostrarTodos, setMostrarTodos] = useState(true);
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

  interface VarianteEmpleador {
    normalizado: string;
    variantes: string[];
    cantidad: number;
  }

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
  const [filtroTipoModal, setFiltroTipoModal] = useState<'todos' | 'publico' | 'privada' | 'fisica' | 'maestros' | 'otros'>('todos');
  const [empleadoresConConteo, setEmpleadoresConConteo] = useState<{ nombre: string; cantidad: number; tipo: string; categoria: string; masterName?: string }[]>([]);
  const [empleadoresLoading, setEmpleadoresLoading] = useState(false);

  // Estado para "Nuevos hoy" - empleadores creados hoy
  const [showEmpleadoresHoy, setShowEmpleadoresHoy] = useState(false);
  const [empleadoresHoy, setEmpleadoresHoy] = useState<{ cuil: string; nombre: string; empleador: string; id: string }[]>([]);
  const [loadingEmpleadoresHoy, setLoadingEmpleadoresHoy] = useState(false);
  const [contadorNuevosHoy, setContadorNuevosHoy] = useState(0);
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
  const sonSimilares = useCallback((a: string, b: string): boolean => {
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
    const tokensA = a.split(/\s+/).filter(t => t.length >= 2);
    const tokensB = b.split(/\s+/).filter(t => t.length >= 2);
    
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
  const getMaestroInfo = useCallback((nombre: string) => {
    const n = nombre.toUpperCase().trim();
    // Búsqueda exacta
    if (EMPLEADORES_MAESTROS[n]) return { masterName: n, ...EMPLEADORES_MAESTROS[n], matchType: 'exact' as const };
    
    // Búsqueda por normalización básica (sin SRL/SA/Stopwords)
    const normNombre = normalizar(nombre);
    for (const [mName, mInfo] of Object.entries(EMPLEADORES_MAESTROS)) {
      if (normalizar(mName) === normNombre) return { masterName: mName, ...mInfo, matchType: 'fuzzy' as const };
    }
    
    // Si no está en el maestro, intentar detección automática
    const auto = detectarTipoAutomatico(nombre);
    return { ...auto, matchType: 'auto' as const, masterName: undefined as string | undefined };
  }, [normalizar, detectarTipoAutomatico]);

  // ── Union-Find para agrupar empleadores similares transitivamente ────────
  const agruparFuzzy = useCallback((keys: string[], variantesMap: Map<string, Set<string>>): VarianteEmpleador[] => {
    const keyList = Array.from(keys);
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
        if (sonSimilares(keyList[i], keyList[j])) {
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
  }, [sonSimilares]);

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

    const result = fuzzyGrupos.filter(g => (mostrarTodos || g.cantidad > 1) && !estaDescartado(g.normalizado, g.cantidad));
    return result.sort((a, b) => b.cantidad - a.cantidad);
  }, [allEmpleadores, mostrarTodos, normalizar, agruparFuzzy, gruposDescartados, estaDescartado]);

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
    
    // Crear grupos para显示 (cada empleador como su propio grupo)
    return matchingEmpleadores.map(e => ({
      normalizado: normalizar(e),
      variantes: [e],
      cantidad: 1,
    })).sort((a, b) => b.normalizado.localeCompare(a.normalizado));
  }, [allEmpleadores, busquedaEmpleador, normalizar]);

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
  }, [allEmpleadores, normalizar, agruparFuzzy, gruposDescartados, estaDescartado]);

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
    const lista = registros.map(r => r.localidad).filter(Boolean) as string[];
    if (!lista) return [];
    const myMap = new Map<string, Set<string>>();
    for (const locVar of lista) {
      const key = String(locVar).toUpperCase().trim();
      if (!myMap.has(key)) myMap.set(key, new Set());
      myMap.get(key)!.add(String(locVar));
    }
    return Array.from(myMap.entries())
      .filter(([_, vars]) => vars.size > 1)
      .map(([normalizado, variantes]) => ({
        normalizado,
        variantes: Array.from(variantes),
        cantidad: variantes.size,
      }))
      .sort((a, b) => b.cantidad - a.cantidad);
  }, [registros]);

  // Todas las localidades para buscar
  const todasLasLocalidadess = useMemo(() => {
    const lista = registros.map(r => r.localidad).filter(Boolean) as string[];
    return Array.from(new Set(lista)).sort();
  }, [registros]);

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
    Array.from(new Set(registros.map(r => r.dependencia).filter(Boolean) as string[])).sort(),
    [registros]
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
    } catch (err) {
      setToast({ message: 'Error al cargar registros', type: 'error' });
      setModalRegistros([]);
    } finally {
      setModalLoading(false);
    }
  }, []);

  // ── Cargar todos los empleadores con conteo ────────────────────────────
  const cargarTodosEmpleadores = useCallback(async () => {
    setEmpleadoresLoading(true);
    setModalEmpleadoresOpen(true);

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
        data.forEach(r => {
          const emp = r.empleador;
          conteo.set(emp, (conteo.get(emp) || 0) + 1);
          const dep = r.dependencia?.trim();
          if (dep) conteoDep.set(dep, (conteoDep.get(dep) || 0) + 1);
        });

        // Convertir a array y enriquecer con info de maestro
        const empleadosArray = Array.from(conteo.entries())
          .map(([nombre, cantidad]) => {
            const maestro = getMaestroInfo(nombre);
            return {
              nombre,
              cantidad,
              tipo: maestro.tipo,
              categoria: maestro.categoria,
              masterName: maestro.masterName
            };
          })
          .sort((a, b) => b.cantidad - a.cantidad);

        // Agregar dependencias reales de registros
        const nombresExistentes = new Set(empleadosArray.map(e => e.nombre.toUpperCase()));
        conteoDep.forEach((cantidad, dep) => {
          if (!nombresExistentes.has(dep.toUpperCase())) {
            const maestro = getMaestroInfo(dep);
            empleadosArray.push({ nombre: dep, cantidad, tipo: maestro.tipo, categoria: maestro.categoria, masterName: maestro.masterName });
            nombresExistentes.add(dep.toUpperCase());
          }
        });

        // Agregar dependencias predefinidas que no tengan registros aún
        for (const dep of DEPENDENCIAS_OFICIALES) {
          if (!nombresExistentes.has(dep.toUpperCase())) {
            const maestro = getMaestroInfo(dep);
            empleadosArray.push({ nombre: dep, cantidad: 0, tipo: maestro.tipo, categoria: maestro.categoria, masterName: maestro.masterName });
          }
        }

        setEmpleadoresConConteo(empleadosArray);
      }
    } catch (err) {
      setToast({ message: 'Error al cargar empleadores', type: 'error' });
      setEmpleadoresConConteo([]);
    } finally {
      setEmpleadoresLoading(false);
    }
  }, [getMaestroInfo]);

  // ── Registros cargados hoy (Argentina) derivados del contexto ────────────
  // Solo registros con empleador cargado, filtrados por rango de fechas.
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
      return dateStr >= fechaDesdeHoy && dateStr <= fechaHastaHoy;
    });
  }, [registros, fechaDesdeHoy, fechaHastaHoy]);

  // Mantener contador sincronizado con el useMemo
  useEffect(() => {
    setContadorNuevosHoy(registrosNuevosHoy.length);
  }, [registrosNuevosHoy]);

  // ── Cargar empleadores nuevos de hoy ─────────────────────────────────────
  const cargarEmpleadoresHoy = useCallback(() => {
    setShowEmpleadoresHoy(true);
  }, []);

  // Sincronizar lista del modal reactivamente con filtros de fecha
  useEffect(() => {
    if (!showEmpleadoresHoy) return;
    setEmpleadoresHoy(
      registrosNuevosHoy.map(r => ({
        id: r.id,
        cuil: r.cuil,
        nombre: r.nombre,
        empleador: r.empleador || '',
      }))
    );
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

      // Broadcast para otras pestañas
      pushBulkRefresh();
    }
  }, [empleadoresSeleccionados, empleadorCorreccion, mutateRegistros, pushBulkRefresh, modalOpen, modalRegistros, modalGrupo, variantesConDuplicados, cargarRegistrosGrupo]);

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
      pushBulkRefresh();
    }
  }, [localidadesSeleccionadas, localidadCorreccion, mutateRegistros, pushBulkRefresh]);

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
      pushBulkRefresh();
    }
  }, [dependenciasSeleccionadas, dependenciaCorreccion, mutateRegistros, pushBulkRefresh]);

  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }
  }, [toast]);

  const toggleFilter = (field: keyof Filtros, value: string) => {
    setFiltros(prev => {
      const list = prev[field] as string[];
      if (!Array.isArray(list)) return prev;
      return { ...prev, [field]: list.includes(value) ? list.filter(v => v !== value) : [...list, value] };
    });
  };

  const previewRecords = useCallback(async () => {
    let query = supabase.from('registros').select('id');

    // Aplicar todos los filtros
    if (filtros.estados.length > 0) query = query.in('estado', filtros.estados);
    if (filtros.analistas.length > 0) query = query.in('analista', filtros.analistas);
    if (filtros.acuerdoPrecios.length > 0) query = query.in('acuerdo_precios', filtros.acuerdoPrecios);
    if (filtros.tipoCliente.length > 0) query = query.in('tipo_cliente', filtros.tipoCliente);
    if (filtros.rangoEtario.length > 0) query = query.in('rango_etario', filtros.rangoEtario);
    if (filtros.sexo.length > 0) query = query.in('sexo', filtros.sexo);
    if (filtros.localidad.length > 0) query = query.in('localidad', filtros.localidad);
    if (filtros.empleador.length > 0) query = query.in('empleador', filtros.empleador);
    if (filtros.esRe === 'si') query = query.eq('es_re', true);
    if (filtros.esRe === 'no') query = query.eq('es_re', false);
    if (filtros.scoreMin) query = query.gte('puntaje', Number(filtros.scoreMin));
    if (filtros.scoreMax) query = query.lte('puntaje', Number(filtros.scoreMax));
    if (filtros.montoMin) query = query.gte('monto', Number(filtros.montoMin));
    if (filtros.montoMax) query = query.lte('monto', Number(filtros.montoMax));
    if (filtros.fechaDesde) query = query.gte('fecha', filtros.fechaDesde);
    if (filtros.fechaHasta) query = query.lte('fecha', filtros.fechaHasta);
    if (filtros.search) {
      const s = filtros.search.toLowerCase();
      query = query.or(`nombre.ilike.%${s}%,cuil.ilike.%${s}%,empleador.ilike.%${s}%,estado.ilike.%${s}%,analista.ilike.%${s}%,localidad.ilike.%${s}%,comentarios.ilike.%${s}%`);
    }

    const { data, error } = await query;
    if (error) {
      setToast({ message: `Error: ${error.message}`, type: 'error' });
      return;
    }
    const ids = new Set(data.map(r => r.id));
    setPreviewIds(ids);
    setPreviewCount(ids.size);
    setStep('confirm');
  }, [filtros]);

  const handleUpdate = async () => {
    setUpdating(true);
    let updated = 0;

    // Construir el payload solo con campos que tienen valor
    const updates: Record<string, unknown> = {};
    if (campos.estado) updates.estado = campos.estado;
    if (campos.analista) updates.analista = campos.analista;
    if (campos.acuerdo_precios) updates.acuerdo_precios = campos.acuerdo_precios;
    if (campos.tipo_cliente) updates.tipo_cliente = campos.tipo_cliente;
    if (campos.cuotas) updates.cuotas = campos.cuotas;
    if (campos.rango_etario) updates.rango_etario = campos.rango_etario;
    if (campos.sexo) updates.sexo = campos.sexo;
    if (campos.empleador) updates.empleador = campos.empleador;
    if (campos.localidad) updates.localidad = campos.localidad;
    if (campos.es_re === 'si') updates.es_re = true;
    if (campos.es_re === 'no') updates.es_re = false;
    if (campos.comentarios) updates.comentarios = campos.comentarios;

    if (Object.keys(updates).length === 0) {
      setToast({ message: 'Debes seleccionar al menos un campo para modificar', type: 'error' });
      setUpdating(false);
      return;
    }

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

  const chipStyle = (isActive: boolean) => ({
    padding: '5px 10px', borderRadius: '5px', fontSize: '10px', border: '1px solid',
    whiteSpace: 'nowrap' as const, fontWeight: 700 as const, cursor: 'pointer', transition: 'all 0.15s',
    background: isActive ? '#fff' : 'rgba(255,255,255,0.02)',
    borderColor: isActive ? '#fff' : 'rgba(255,255,255,0.06)',
    color: isActive ? '#000' : '#555',
    textTransform: 'uppercase' as const, letterSpacing: '0.5px'
  });

  const fieldSection = (title: string, children: React.ReactNode) => (
    <div style={{ marginBottom: '20px' }}>
      <label style={{ display: 'block', fontSize: '9px', color: '#444', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>{title}</label>
      {children}
    </div>
  );

  return (
    <div style={{ width: '100%' }}>
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: toast.type === 'success' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
            border: `1px solid ${toast.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
            color: toast.type === 'success' ? '#34d399' : '#f87171',
          }}>
            {toast.type === 'success' ? <CheckCircle size={15} /> : <AlertTriangle size={15} />}
            {toast.message}
          </div>
        </div>
      )}

      <div className="data-card" style={{ 
        background: '#0a0a0a', 
        border: '1px solid rgba(255,255,255,0.03)', 
        width: '100%',
        minHeight: 'calc(100vh - 200px)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#fff', letterSpacing: '-0.5px', display: 'flex', alignItems: 'center', gap: 10 }}>
              {mode === 'bulk' ? <Users size={20} style={{ color: '#888' }} /> : <ShieldCheck size={20} style={{ color: '#fbbf24' }} />}
              {mode === 'bulk' ? 'Calif. x SCORE' : 'Corrector'}
            </h3>
            <p style={{ fontSize: '13px', color: '#555', marginTop: '4px' }}>
              {mode === 'bulk' ? 'Filtra registros por cualquier condición y actualiza campos masivamente' : 'Detecta y corrige variantes de nombres para unificar la base'}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={cargarEmpleadoresHoy}
              disabled={loadingEmpleadoresHoy}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '6px',
                fontSize: '10px',
                fontWeight: 800,
                color: '#555',
                textTransform: 'uppercase',
                cursor: loadingEmpleadoresHoy ? 'not-allowed' : 'pointer',
              }}
            >
              {loadingEmpleadoresHoy ? <Loader2 size={12} className="animate-spin" /> : <Users size={12} />}
              Nuevos hoy
              {contadorNuevosHoy > 0 && (
                <span style={{ 
                  background: 'rgba(16,185,129,0.15)', 
                  color: '#34d399', 
                  padding: '1px 5px', 
                  borderRadius: 4, 
                  fontSize: '9px',
                  marginLeft: 4 
                }}>
                  {contadorNuevosHoy}
                </span>
              )}
            </button>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              background: variantesConDuplicados.length > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${variantesConDuplicados.length > 0 ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: '6px',
              fontSize: '10px',
              fontWeight: 800,
              color: variantesConDuplicados.length > 0 ? '#ef4444' : '#555',
              textTransform: 'uppercase',
            }}>
              {variantesConDuplicados.length > 0 ? <AlertTriangle size={12} /> : <CheckCircle size={12} />}
              {variantesConDuplicados.length > 0
                ? `${variantesConDuplicados.length} variante${variantesConDuplicados.length > 1 ? 's' : ''} con duplicado${variantesConDuplicados.length > 1 ? 's' : ''}`
                : 'Sin duplicados'}
            </div>
            <button
              onClick={resetAll}
              style={{
                background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
                color: '#666', borderRadius: '6px', padding: '6px 14px',
                fontSize: '10px', fontWeight: 800, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px',
                textTransform: 'uppercase',
              }}
            >
              <X size={12} /> Resetear
            </button>
          </div>
        </div>

        {/* ── CORRECTOR DE EMPLEADOR ────────────────────────────────────────── */}
        {(mode === 'all' || mode === 'corrector') && (
          <div style={{
          marginBottom: '28px', padding: '20px',
          background: variantesConDuplicados.length > 0 ? 'rgba(239,68,68,0.04)' : 'rgba(255,255,255,0.02)',
          border: `1px solid ${variantesConDuplicados.length > 0 ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.06)'}`,
          borderRadius: '10px',
        }}>
          <div 
            onClick={() => setCorrectorExpandido(!correctorExpandido)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: correctorExpandido ? 16 : 0, cursor: 'pointer' }}
          >
            {variantesConDuplicados.length > 0
              ? <AlertTriangle size={18} color="#ef4444" />
              : <CheckCircle size={18} color="#555" />}
            <h4 style={{ fontSize: '14px', fontWeight: 800, color: variantesConDuplicados.length > 0 ? '#ef4444' : '#888', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 8 }}>
              {variantesConDuplicados.length > 0
                ? `Corrector de Empleador — ${variantesConDuplicados.length} grupos para corregir`
                : 'Corrector de Empleador — Sin duplicados'}
              {correctorExpandido ? <ChevronUp size={14} style={{ opacity: 0.5 }} /> : <ChevronDown size={14} style={{ opacity: 0.5 }} />}
            </h4>
            <div 
              style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto' }}
              onClick={(e) => e.stopPropagation()}
            >
              {gruposDescartados.size > 0 && (
                <button
                  onClick={restaurarDescartados}
                  style={{
                    background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.3)',
                    color: '#60a5fa', borderRadius: '4px', padding: '4px 10px',
                    fontSize: '9px', fontWeight: 800, cursor: 'pointer',
                    textTransform: 'uppercase', letterSpacing: '0.5px',
                  }}
                >
                  Restaurar {gruposDescartados.size} descartado{gruposDescartados.size > 1 ? 's' : ''}
                </button>
              )}
              <button
                onClick={cargarTodosEmpleadores}
                style={{
                  background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)',
                  color: '#fbbf24', borderRadius: '4px', padding: '4px 10px',
                  fontSize: '9px', fontWeight: 800, cursor: 'pointer',
                  textTransform: 'uppercase', letterSpacing: '0.5px',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                <Users size={10} /> Ver todos ({allEmpleadores.length})
              </button>
            </div>
          </div>

          {correctorExpandido && (
            <>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', marginBottom: 20 }}>
            <div>
              <label style={{ display: 'block', fontSize: '9px', color: '#444', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
                Nombre correcto
              </label>
              <input
                className="form-input"
                placeholder="Ej: MUNICIPALIDAD DE PARANA"
                value={empleadorCorreccion}
                onChange={e => setEmpleadorCorreccion(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && corregirEmpleador()}
                style={{
                  background: '#111', color: '#ccc', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '6px', padding: '10px 12px', fontSize: '13px', width: '100%', outline: 'none',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button
              onClick={corregirEmpleador}
              disabled={updating || empleadoresSeleccionados.length === 0 || !empleadorCorreccion.trim()}
              style={{
                background: (empleadoresSeleccionados.length === 0 || !empleadorCorreccion.trim()) ? '#333' : '#fbbf24',
                color: (empleadoresSeleccionados.length === 0 || !empleadorCorreccion.trim()) ? '#666' : '#000',
                border: 'none', borderRadius: '6px', padding: '10px 24px',
                fontSize: '11px', fontWeight: 900, cursor: (empleadoresSeleccionados.length === 0 || !empleadorCorreccion.trim()) ? 'not-allowed' : 'pointer',
                textTransform: 'uppercase', letterSpacing: '1px',
                flexShrink: 0,
              }}
            >
              {updating ? 'CORRIGIENDO...' : `CORREGIR ${empleadoresSeleccionados.length} EMPLEADOR(ES)`}
            </button>
            <input
              className="form-input"
              placeholder="Buscar empleador..."
              value={busquedaEmpleador}
              onChange={e => setBusquedaEmpleador(e.target.value)}
              style={{
                background: '#111', color: '#ccc', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '6px', padding: '10px 12px', fontSize: '13px', flex: 1, outline: 'none',
              }}
            />
          </div>

          {empleadoresSeleccionados.length > 0 && (
            <div style={{ marginTop: '12px', fontSize: '11px', color: '#fbbf24', fontWeight: 700 }}>
              Seleccionados: {empleadoresSeleccionados.length} — {empleadorCorreccion || '(sin nombre correcto)'}
            </div>
          )}

          {/* Lista de variantes detectadas */}
          {variantesFiltradas.length > 0 ? (
            <div style={{ marginTop: '20px', maxHeight: 'calc(100vh - 450px)', overflowY: 'auto' }}>
              {variantesFiltradas.map((v, i) => (
                <div key={i} style={{
                  marginBottom: 12, padding: '12px 14px',
                  background: 'rgba(0,0,0,0.3)', borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.04)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ fontSize: '11px', color: '#fbbf24', fontWeight: 800, textTransform: 'uppercase' }}>
                      {v.normalizado} <span style={{ color: '#666' }}>({v.cantidad} variantes)</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      {v.cantidad > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            cargarRegistrosGrupo(v.variantes, v.normalizado);
                          }}
                          title="Ver todos los registros de este grupo"
                          style={{
                            background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.3)',
                            color: '#60a5fa', borderRadius: '4px', padding: '2px 8px',
                            fontSize: '9px', fontWeight: 800, cursor: 'pointer',
                            textTransform: 'uppercase', letterSpacing: '0.5px',
                            display: 'flex', alignItems: 'center', gap: 4,
                          }}
                        >
                          <Users size={10} /> Ver {v.cantidad}
                        </button>
                      )}
                      {v.cantidad > 1 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); descartarGrupo(v.normalizado, v.cantidad); }}
                          title="Marcar como correcto — no es un duplicado real"
                          style={{
                            background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
                            color: '#34d399', borderRadius: '4px', padding: '2px 8px',
                            fontSize: '9px', fontWeight: 800, cursor: 'pointer',
                            textTransform: 'uppercase', letterSpacing: '0.5px',
                            display: 'flex', alignItems: 'center', gap: 4,
                          }}
                        >
                          <CheckCircle size={10} /> OK
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {v.variantes.map((varName, j) => {
                      const isSelected = empleadoresSeleccionados.includes(varName);
                      return (
                        <span
                          key={j}
                          onClick={() => {
                            setEmpleadoresSeleccionados(prev =>
                              isSelected ? prev.filter(v => v !== varName) : [...prev, varName]
                            );
                          }}
                          style={{
                            padding: '4px 10px', borderRadius: '4px', fontSize: '11px',
                            background: isSelected ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.04)',
                            border: isSelected ? '1px solid #fbbf24' : '1px solid rgba(255,255,255,0.06)',
                            color: isSelected ? '#fbbf24' : '#888',
                            fontWeight: 600, cursor: 'pointer',
                          }}
                        >
                          {varName}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ marginTop: '20px', padding: '20px', textAlign: 'center', color: '#555', fontSize: '13px' }}>
              <p>{busquedaEmpleador ? 'No se encontraron resultados.' : 'No se detectaron empleadores con múltiples variantes.'}</p>
              {busquedaEmpleador && (
                <p style={{ fontSize: '11px', marginTop: '8px', color: '#444' }}>
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
      {(mode === 'all' || mode === 'corrector') && (
        <div style={{
          marginBottom: '28px', padding: '20px',
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '10px',
        }}>
          <div 
            onClick={() => setCorrectorLocalidadExpandido(!correctorLocalidadExpandido)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: correctorLocalidadExpandido ? 16 : 0, cursor: 'pointer' }}
          >
            <CheckCircle size={18} color="#555" />
            <h4 style={{ fontSize: '14px', fontWeight: 800, color: '#888', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 8 }}>
              Corrector de Localidad
              {correctorLocalidadExpandido ? <ChevronUp size={14} style={{ opacity: 0.5 }} /> : <ChevronDown size={14} style={{ opacity: 0.5 }} />}
            </h4>
          </div>

          {correctorLocalidadExpandido && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', marginBottom: 20 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '9px', color: '#444', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
                    Nombre correcto
                  </label>
                  <input
                    className="form-input"
                    placeholder="Ej: PARANA"
                    value={localidadCorreccion}
                    onChange={e => setLocalidadCorreccion(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && corregirLocalidad()}
                    style={{
                      background: '#111', color: '#ccc', border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '6px', padding: '10px 12px', fontSize: '13px', width: '100%', outline: 'none',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <button
                  onClick={corregirLocalidad}
                  disabled={updating || localidadesSeleccionadas.length === 0 || !localidadCorreccion.trim()}
                  style={{
                    background: (localidadesSeleccionadas.length === 0 || !localidadCorreccion.trim()) ? '#333' : '#fbbf24',
                    color: (localidadesSeleccionadas.length === 0 || !localidadCorreccion.trim()) ? '#666' : '#000',
                    border: 'none', borderRadius: '6px', padding: '10px 24px',
                    fontSize: '11px', fontWeight: 900, cursor: (localidadesSeleccionadas.length === 0 || !localidadCorreccion.trim()) ? 'not-allowed' : 'pointer',
                    textTransform: 'uppercase', letterSpacing: '1px',
                    flexShrink: 0,
                  }}
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
                  style={{
                    background: (!localidadCorreccion.trim()) ? '#333' : 'rgba(16,185,129,0.15)',
                    color: (!localidadCorreccion.trim()) ? '#666' : '#34d399',
                    border: '1px solid rgba(16,185,129,0.3)',
                    borderRadius: '6px', padding: '10px 24px',
                    fontSize: '11px', fontWeight: 900, cursor: (!localidadCorreccion.trim()) ? 'not-allowed' : 'pointer',
                    textTransform: 'uppercase', letterSpacing: '1px',
                    flexShrink: 0,
                  }}
                >
                  AGREGAR NUEVA LOCALIDAD
                </button>
                <input
                  className="form-input"
                  placeholder="Buscar localidad..."
                  value={busquedaLocalidad}
                  onChange={e => setBusquedaLocalidad(e.target.value)}
                  style={{
                    background: '#111', color: '#ccc', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '6px', padding: '10px 12px', fontSize: '13px', flex: 1, outline: 'none',
                  }}
                />
              </div>

              {localidadesSeleccionadas.length > 0 && (
                <div style={{ marginTop: '12px', fontSize: '11px', color: '#fbbf24', fontWeight: 700 }}>
                  Seleccionadas: {localidadesSeleccionadas.length} — {localidadCorreccion || '(sin nombre correcto)'}
                </div>
              )}

              {/* Lista de localidades */}
              {(listaLocalidadess.length > 0 || busquedaLocalidad.trim()) ? (
                <div style={{ marginTop: '20px', maxHeight: 'calc(100vh - 450px)', overflowY: 'auto' }}>
                  {listaLocalidadess.map((v, i) => (
                    <div key={i} style={{
                      marginBottom: 12, padding: '12px 14px',
                      background: 'rgba(0,0,0,0.3)', borderRadius: '8px',
                      border: '1px solid rgba(255,255,255,0.04)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <div style={{ fontSize: '11px', color: '#fbbf24', fontWeight: 800, textTransform: 'uppercase' }}>
                          {v.normalizado} <span style={{ color: '#666' }}>({v.cantidad} variantes)</span>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                          {v.cantidad > 1 && (
                            <button
                              onClick={(e) => { e.stopPropagation(); descartarGrupoLocalidad(v.normalizado); }}
                              title="Marcar como correcto"
                              style={{
                                background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
                                color: '#34d399', borderRadius: '4px', padding: '2px 8px',
                                fontSize: '9px', fontWeight: 800, cursor: 'pointer',
                                textTransform: 'uppercase', letterSpacing: '0.5px',
                                display: 'flex', alignItems: 'center', gap: 4,
                              }}
                            >
                              <CheckCircle size={10} /> OK
                            </button>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {v.variantes.map((varName, j) => {
                          const isSelected = localidadesSeleccionadas.includes(varName);
                          return (
                            <span
                              key={j}
                              onClick={() => {
                                setLocalidadesSeleccionadas(prev =>
                                  isSelected ? prev.filter(v => v !== varName) : [...prev, varName]
                                );
                              }}
                              style={{
                                padding: '4px 10px', borderRadius: '4px', fontSize: '11px',
                                background: isSelected ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.04)',
                                border: isSelected ? '1px solid #fbbf24' : '1px solid rgba(255,255,255,0.06)',
                                color: isSelected ? '#fbbf24' : '#888',
                                fontWeight: 600, cursor: 'pointer',
                              }}
                            >
                              {varName}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ marginTop: '20px', padding: '20px', textAlign: 'center', color: '#555', fontSize: '13px' }}>
                  <p>{busquedaLocalidad ? 'No se encontraron resultados.' : 'No hay localidades en la base.'}</p>
                  {busquedaLocalidad && (
                    <p style={{ fontSize: '11px', marginTop: '8px', color: '#444' }}>
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
      {(mode === 'all' || mode === 'corrector') && (
        <div style={{
          marginBottom: '28px', padding: '20px',
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '10px',
        }}>
          <div
            onClick={() => setCorrectorDependenciaExpandido(!correctorDependenciaExpandido)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: correctorDependenciaExpandido ? 16 : 0, cursor: 'pointer' }}
          >
            <CheckCircle size={18} color="#555" />
            <h4 style={{ fontSize: '14px', fontWeight: 800, color: '#888', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 8 }}>
              Corrector de Dependencia
              {correctorDependenciaExpandido ? <ChevronUp size={14} style={{ opacity: 0.5 }} /> : <ChevronDown size={14} style={{ opacity: 0.5 }} />}
            </h4>
          </div>

          {correctorDependenciaExpandido && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', marginBottom: 20 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '9px', color: '#444', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
                    Nombre correcto
                  </label>
                  <input
                    className="form-input"
                    placeholder="Ej: Subsecretaría de Servicios Públicos"
                    value={dependenciaCorreccion}
                    onChange={e => setDependenciaCorreccion(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && corregirDependencia()}
                    style={{
                      background: '#111', color: '#ccc', border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '6px', padding: '10px 12px', fontSize: '13px', width: '100%', outline: 'none',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <button
                  onClick={corregirDependencia}
                  disabled={updating || dependenciasSeleccionadas.length === 0 || !dependenciaCorreccion.trim()}
                  style={{
                    background: (dependenciasSeleccionadas.length === 0 || !dependenciaCorreccion.trim()) ? '#333' : '#fbbf24',
                    color: (dependenciasSeleccionadas.length === 0 || !dependenciaCorreccion.trim()) ? '#666' : '#000',
                    border: 'none', borderRadius: '6px', padding: '10px 24px',
                    fontSize: '11px', fontWeight: 900, cursor: (dependenciasSeleccionadas.length === 0 || !dependenciaCorreccion.trim()) ? 'not-allowed' : 'pointer',
                    textTransform: 'uppercase', letterSpacing: '1px', flexShrink: 0,
                  }}
                >
                  {updating ? 'CORRIGIENDO...' : `CORREGIR ${dependenciasSeleccionadas.length} DEPENDENCIA(S)`}
                </button>
                <input
                  className="form-input"
                  placeholder="Buscar dependencia..."
                  value={busquedaDependencia}
                  onChange={e => setBusquedaDependencia(e.target.value)}
                  style={{
                    background: '#111', color: '#ccc', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '6px', padding: '10px 12px', fontSize: '13px', flex: 1, outline: 'none',
                  }}
                />
              </div>

              {dependenciasSeleccionadas.length > 0 && (
                <div style={{ marginTop: '12px', fontSize: '11px', color: '#fbbf24', fontWeight: 700 }}>
                  Seleccionadas: {dependenciasSeleccionadas.length} — {dependenciaCorreccion || '(sin nombre correcto)'}
                </div>
              )}

              {(listaDependencias.length > 0 || busquedaDependencia.trim()) ? (
                <div style={{ marginTop: '20px', maxHeight: 'calc(100vh - 450px)', overflowY: 'auto' }}>
                  {listaDependencias.map((v, i) => (
                    <div key={i} style={{
                      marginBottom: 12, padding: '12px 14px',
                      background: 'rgba(0,0,0,0.3)', borderRadius: '8px',
                      border: '1px solid rgba(255,255,255,0.04)',
                    }}>
                      <div style={{ fontSize: '11px', color: '#fbbf24', fontWeight: 800, textTransform: 'uppercase', marginBottom: 6 }}>
                        {v.normalizado} {v.cantidad > 1 && <span style={{ color: '#666' }}>({v.cantidad} variantes)</span>}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {v.variantes.map((varName, j) => {
                          const isSelected = dependenciasSeleccionadas.includes(varName);
                          return (
                            <span
                              key={j}
                              onClick={() => setDependenciasSeleccionadas(prev =>
                                isSelected ? prev.filter(d => d !== varName) : [...prev, varName]
                              )}
                              style={{
                                padding: '4px 10px', borderRadius: '4px', fontSize: '11px',
                                background: isSelected ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.04)',
                                border: isSelected ? '1px solid #fbbf24' : '1px solid rgba(255,255,255,0.06)',
                                color: isSelected ? '#fbbf24' : '#888',
                                fontWeight: 600, cursor: 'pointer',
                              }}
                            >
                              {varName}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ marginTop: '20px', padding: '20px', textAlign: 'center', color: '#555', fontSize: '13px' }}>
                  <p>{busquedaDependencia ? 'No se encontraron resultados.' : 'No hay dependencias en la base.'}</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {(mode === 'all' || mode === 'corrector') && (
        <AsignarEmpleadorSection
          registros={registros}
          allEmpleadores={allEmpleadores}
          mutateRegistros={mutateRegistros}
          refresh={refresh}
          applyRegistroChange={applyRegistroChange}
          pushRegistroChange={pushRegistroChange}
        />
      )}

        {/* STEP 1: FILTROS */}
        {(mode === 'all' || mode === 'bulk') && step === 'filter' && (
          <>
            {/* Resumen de filtros activos */}
            {(filtros.estados.length > 0 || filtros.analistas.length > 0 || filtros.scoreMin || filtros.scoreMax || filtros.acuerdoPrecios.length > 0 || filtros.fechaDesde || filtros.fechaHasta) && (
              <div style={{
                padding: '12px 16px', background: 'rgba(96,165,250,0.05)',
                border: '1px solid rgba(96,165,250,0.15)', borderRadius: '8px',
                marginBottom: '20px', display: 'flex', alignItems: 'center', gap: 8,
                flexWrap: 'wrap',
              }}>
                <Filter size={14} style={{ color: '#60a5fa', flexShrink: 0 }} />
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#888', marginRight: 8 }}>Filtros activos:</span>
                {filtros.estados.map(e => (
                  <span key={e} style={{ fontSize: '10px', padding: '2px 8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', color: '#ccc', fontWeight: 600 }}>{STATUS_LABEL[e] ?? e}</span>
                ))}
                {(filtros.scoreMin || filtros.scoreMax) && (
                  <span style={{ fontSize: '10px', padding: '2px 8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', color: '#ccc', fontWeight: 600 }}>
                    Score: {filtros.scoreMin || '0'} - {filtros.scoreMax || '∞'}
                  </span>
                )}
                {filtros.acuerdoPrecios.map(a => (
                  <span key={a} style={{ fontSize: '10px', padding: '2px 8px', background: 'rgba(251,191,36,0.15)', borderRadius: '4px', color: '#fbbf24', fontWeight: 600 }}>{a}</span>
                ))}
                {filtros.analistas.map(a => (
                  <span key={a} style={{ fontSize: '10px', padding: '2px 8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', color: '#ccc', fontWeight: 600 }}>{a}</span>
                ))}
                {(filtros.fechaDesde || filtros.fechaHasta) && (
                  <span style={{ fontSize: '10px', padding: '2px 8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', color: '#ccc', fontWeight: 600 }}>
                    Fecha: {filtros.fechaDesde || '…'} → {filtros.fechaHasta || '…'}
                  </span>
                )}
              </div>
            )}
            {/* Sección: Filtros de selección (Estado y Analista side-by-side) */}
            <div style={{ display: 'flex', gap: '48px', marginBottom: '24px', alignItems: 'flex-start' }}>
              <div style={{ flex: '1 1 auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '8px' }}>
                  <label style={{ fontSize: '9px', color: '#444', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px' }}>ESTADO (seleccioná los que querés filtrar)</label>
                  {filtros.estados.length > 0 && (
                    <span style={{ fontSize: '10px', color: '#60a5fa', fontWeight: 700 }}>· {filtros.estados.length} seleccionado{filtros.estados.length > 1 ? 's' : ''}</span>
                  )}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {allEstados.map(est => (
                    <span key={est} onClick={() => toggleFilter('estados', est)} style={chipStyle(filtros.estados.includes(est))}>
                      {STATUS_LABEL[est] ?? est}
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ flex: '0 0 auto', minWidth: '240px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '8px' }}>
                  <label style={{ fontSize: '9px', color: '#444', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px' }}>ANALISTA</label>
                  {filtros.analistas.length > 0 && (
                    <span style={{ fontSize: '10px', color: '#60a5fa', fontWeight: 700 }}>· {filtros.analistas.length} seleccionado{filtros.analistas.length > 1 ? 's' : ''}</span>
                  )}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {allAnalistas.map(an => (
                    <span key={an} onClick={() => toggleFilter('analistas', an)} style={chipStyle(filtros.analistas.includes(an))}>
                      {an}
                    </span>
                  ))}
                </div>
              </div>
            </div>


            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '9px', color: '#444', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>FECHA DESDE</label>
                <input className="form-input" type="date" value={filtros.fechaDesde} onChange={e => setFiltros(p => ({ ...p, fechaDesde: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '9px', color: '#444', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>FECHA HASTA</label>
                <input className="form-input" type="date" value={filtros.fechaHasta} onChange={e => setFiltros(p => ({ ...p, fechaHasta: e.target.value }))} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '9px', color: '#444', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>SCORE MÍN</label>
                <input className="form-input" type="number" placeholder="Ej: 0" value={filtros.scoreMin} onChange={e => setFiltros(p => ({ ...p, scoreMin: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '9px', color: '#444', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>SCORE MÁX</label>
                <input className="form-input" type="number" placeholder="Ej: 499" value={filtros.scoreMax} onChange={e => setFiltros(p => ({ ...p, scoreMax: e.target.value }))} />
              </div>
            </div>

            {/* Acuerdo de precios en filtros principales */}
            {allAcuerdos.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '9px', color: '#444', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>ACUERDO DE PRECIOS</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {allAcuerdos.map(a => (
                    <span key={a} onClick={() => toggleFilter('acuerdoPrecios', a)} style={chipStyle(filtros.acuerdoPrecios.includes(a))}>{a}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Advanced filters toggle */}
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'transparent', border: '1px solid rgba(255,255,255,0.06)',
                color: '#555', borderRadius: 6, padding: '8px 14px',
                fontSize: 11, fontWeight: 800, cursor: 'pointer',
                textTransform: 'uppercase', marginBottom: 16, width: '100%',
                justifyContent: 'center',
              }}
            >
              {showAdvancedFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              Filtros Avanzados
            </button>

            {showAdvancedFilters && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '9px', color: '#444', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>MONTO MÍN</label>
                    <input className="form-input" type="number" value={filtros.montoMin} onChange={e => setFiltros(p => ({ ...p, montoMin: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '9px', color: '#444', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>MONTO MÁX</label>
                    <input className="form-input" type="number" value={filtros.montoMax} onChange={e => setFiltros(p => ({ ...p, montoMax: e.target.value }))} />
                  </div>
                </div>

                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '9px', color: '#444', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>BÚSQUEDA (cualquier campo)</label>
                  <input className="form-input" placeholder="Buscar..." value={filtros.search} onChange={e => setFiltros(p => ({ ...p, search: e.target.value }))} />
                </div>

                {/* Tipo cliente */}
                {allTipos.length > 0 && (
                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontSize: '9px', color: '#444', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>TIPO CLIENTE</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {allTipos.map(t => (
                        <span key={t} onClick={() => toggleFilter('tipoCliente', t)} style={chipStyle(filtros.tipoCliente.includes(t))}>{t}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Rango etario */}
                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '9px', color: '#444', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>RANGO ETARIO</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {RANGOS_ETARIOS.map(r => (
                      <span key={r} onClick={() => toggleFilter('rangoEtario', r)} style={chipStyle(filtros.rangoEtario.includes(r))}>{r}</span>
                    ))}
                  </div>
                </div>

                {/* Sexo */}
                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '9px', color: '#444', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>SEXO</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {SEXOS.map(s => (
                      <span key={s} onClick={() => toggleFilter('sexo', s)} style={chipStyle(filtros.sexo.includes(s))}>{s}</span>
                    ))}
                  </div>
                </div>

                {/* Localidad */}
                {allLocalidades.length > 0 && (
                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontSize: '9px', color: '#444', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>LOCALIDAD</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {allLocalidades.map(l => (
                        <span key={l} onClick={() => toggleFilter('localidad', l)} style={chipStyle(filtros.localidad.includes(l))}>{l}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Empleador */}
                {allEmpleadores.length > 0 && (
                  <div style={{ marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <label style={{ fontSize: '9px', color: '#444', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px' }}>EMPLEADOR</label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {(['S.A.', 'S.R.L.'] as const).map(tipo => {
                          const patron = tipo === 'S.A.' ? /\bS\.?A\.?\b/i : /\bS\.?R\.?L\.?\b/i;
                          const matches = allEmpleadores.filter(e => patron.test(e));
                          if (matches.length === 0) return null;
                          const activo = matches.length > 0 && matches.every(m => filtros.empleador.includes(m));
                          return (
                            <button
                              key={tipo}
                              onClick={() => setFiltros(p => ({
                                ...p,
                                empleador: activo ? p.empleador.filter(e => !matches.includes(e)) : [...new Set([...p.empleador, ...matches])],
                              }))}
                              style={{
                                background: activo ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.04)',
                                border: `1px solid ${activo ? 'rgba(251,191,36,0.4)' : 'rgba(255,255,255,0.1)'}`,
                                color: activo ? '#fbbf24' : '#666',
                                borderRadius: '4px', padding: '3px 8px',
                                fontSize: '9px', fontWeight: 800, cursor: 'pointer',
                                textTransform: 'uppercase', letterSpacing: '0.5px',
                              }}
                            >
                              {tipo} ({matches.length})
                            </button>
                          );
                        })}
                        {filtros.empleador.length > 1 && (
                          <button
                            onClick={() => setFiltros(p => ({ ...p, empleador: [] }))}
                            style={{
                              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                              color: '#f87171', borderRadius: '4px', padding: '3px 8px',
                              fontSize: '9px', fontWeight: 800, cursor: 'pointer',
                              textTransform: 'uppercase', letterSpacing: '0.5px',
                            }}
                          >
                            ✕ Limpiar
                          </button>
                        )}
                      </div>
                    </div>
                    <select
                      className="form-input"
                      value={filtros.empleador.length === 1 ? filtros.empleador[0] : ''}
                      onChange={e => setFiltros(p => ({ ...p, empleador: e.target.value ? [e.target.value] : [] }))}
                      style={{
                        background: '#111',
                        color: filtros.empleador.length > 1 ? '#fbbf24' : '#ccc',
                        border: `1px solid ${filtros.empleador.length > 1 ? 'rgba(251,191,36,0.3)' : 'rgba(255,255,255,0.08)'}`,
                        borderRadius: '6px',
                        padding: '10px 12px',
                        fontSize: '13px',
                        width: '100%',
                        outline: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      <option value="" style={{ background: '#111', color: '#666' }}>
                        {filtros.empleador.length > 1 ? `${filtros.empleador.length} empleadores seleccionados` : 'Todos'}
                      </option>
                      {allEmpleadores.map(e => (
                        <option key={e} value={e} style={{ background: '#111', color: '#ccc' }}>{e}</option>
                      ))}
                    </select>
                    {filtros.empleador.length > 1 && (
                      <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {filtros.empleador.slice(0, 6).map(e => (
                          <span key={e} style={{
                            fontSize: '9px', padding: '2px 7px', borderRadius: '4px',
                            background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)',
                            color: '#fbbf24', fontWeight: 700,
                          }}>{e}</span>
                        ))}
                        {filtros.empleador.length > 6 && (
                          <span style={{ fontSize: '9px', color: '#666', padding: '2px 4px' }}>
                            +{filtros.empleador.length - 6} más
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Es RE */}
                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '9px', color: '#444', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>RESUMEN EJECUTIVO</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span onClick={() => setFiltros(p => ({ ...p, esRe: p.esRe === 'si' ? '' : 'si' }))} style={chipStyle(filtros.esRe === 'si')}>Sí</span>
                    <span onClick={() => setFiltros(p => ({ ...p, esRe: p.esRe === 'no' ? '' : 'no' }))} style={chipStyle(filtros.esRe === 'no')}>No</span>
                  </div>
                </div>
              </>
            )}

            {/* Preview button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
              <button
                onClick={previewRecords}
                style={{
                  background: '#fff', color: '#000', border: 'none',
                  fontWeight: 900, padding: '12px 28px', borderRadius: '10px',
                  fontSize: '12px', letterSpacing: '0.5px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}
              >
                <Filter size={14} /> PREVISUALIZAR REGISTROS
              </button>
            </div>
          </>
        )}

        {/* STEP 2: CONFIRMAR - Seleccionar campos a modificar */}
        {(mode === 'all' || mode === 'bulk') && step === 'confirm' && (
          <>
            <div style={{
              padding: '16px 20px', background: 'rgba(250,204,21,0.06)',
              border: '1px solid rgba(250,204,21,0.15)', borderRadius: '10px',
              marginBottom: '24px', display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <AlertTriangle size={20} style={{ color: '#facc15', flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: '14px', fontWeight: 700, color: '#fff', marginBottom: 4 }}>
                  {previewCount} registros serán modificados
                </p>
                <p style={{ fontSize: '12px', color: '#888' }}>
                  Selecciona los campos que deseas actualizar. Solo los campos con valor se aplicarán.
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {fieldSection('Estado',
                <select className="form-select" value={campos.estado} onChange={e => setCampos(p => ({ ...p, estado: e.target.value }))}>
                  <option value="">— No modificar —</option>
                  {ESTADOS.map(e => <option key={e} value={e}>{STATUS_LABEL[e] ?? e}</option>)}
                </select>
              )}

              {fieldSection('Analista',
                <select className="form-select" value={campos.analista} onChange={e => setCampos(p => ({ ...p, analista: e.target.value }))}>
                  <option value="">— No modificar —</option>
                  {ANALISTAS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              )}

              {fieldSection('Acuerdo de Precios',
                <select className="form-select" value={campos.acuerdo_precios} onChange={e => setCampos(p => ({ ...p, acuerdo_precios: e.target.value }))}>
                  <option value="">— No modificar —</option>
                  {ACUERDOS_OPCIONES.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              )}

              {fieldSection('Tipo Cliente',
                <select className="form-select" value={campos.tipo_cliente} onChange={e => setCampos(p => ({ ...p, tipo_cliente: e.target.value }))}>
                  <option value="">— No modificar —</option>
                  {TIPO_CLIENTE_OPCIONES.map(t => <option key={t} value={t}>{t === 'Renovacion' ? 'Renovación' : t}</option>)}
                </select>
              )}

              {fieldSection('Cuotas',
                <input className="form-input" placeholder="Ej: 12, 24, 36" value={campos.cuotas} onChange={e => setCampos(p => ({ ...p, cuotas: e.target.value }))} />
              )}

              {fieldSection('Rango Etario',
                <select className="form-select" value={campos.rango_etario} onChange={e => setCampos(p => ({ ...p, rango_etario: e.target.value }))}>
                  <option value="">— No modificar —</option>
                  {RANGOS_ETARIOS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              )}

              {fieldSection('Sexo',
                <select className="form-select" value={campos.sexo} onChange={e => setCampos(p => ({ ...p, sexo: e.target.value }))}>
                  <option value="">— No modificar —</option>
                  {SEXOS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              )}

              {fieldSection('Localidad',
                <select className="form-select" value={campos.localidad} onChange={e => setCampos(p => ({ ...p, localidad: e.target.value }))}>
                  <option value="">— No modificar —</option>
                  {registros.map(r => r.localidad).filter((l, i, arr) => l && arr.indexOf(l) === i).sort().map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              )}
            </div>

            {fieldSection('Empleador',
              <input className="form-input" placeholder="Nombre del empleador" value={campos.empleador} onChange={e => setCampos(p => ({ ...p, empleador: e.target.value }))} />
            )}

            {fieldSection('Resumen Ejecutivo',
              <select className="form-select" value={campos.es_re} onChange={e => setCampos(p => ({ ...p, es_re: e.target.value }))}>
                <option value="">— No modificar —</option>
                <option value="si">Sí</option>
                <option value="no">No</option>
              </select>
            )}

            {fieldSection('Comentarios (agregar al final)',
              <textarea className="form-input" placeholder="Texto a agregar..." value={campos.comentarios} onChange={e => setCampos(p => ({ ...p, comentarios: e.target.value }))} rows={2} style={{ resize: 'vertical' }} />
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 28 }}>
              <button
                onClick={() => setStep('filter')}
                style={{
                  background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                  color: '#666', borderRadius: '8px', padding: '12px 24px',
                  fontWeight: 700, fontSize: '12px', cursor: 'pointer',
                }}
              >
                VOLVER A FILTROS
              </button>
              <button
                onClick={handleUpdate}
                disabled={updating || Object.values(campos).every(v => !v)}
                style={{
                  background: Object.values(campos).every(v => !v) ? '#333' : '#fff',
                  color: Object.values(campos).every(v => !v) ? '#666' : '#000',
                  border: 'none', fontWeight: 900, padding: '12px 32px',
                  borderRadius: '10px', fontSize: '12px', letterSpacing: '0.5px',
                  cursor: Object.values(campos).every(v => !v) ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}
              >
                {updating ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {updating ? 'ACTUALIZANDO...' : 'CONFIRMAR ACTUALIZACIÓN'}
              </button>
            </div>
          </>
        )}

        {/* STEP 3: DONE */}
        {(mode === 'all' || mode === 'bulk') && step === 'done' && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <CheckCircle size={48} style={{ color: '#34d399', margin: '0 auto 16px' }} />
            <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#fff', marginBottom: 8 }}>
              ¡Actualización completada!
            </h3>
            <p style={{ fontSize: '14px', color: '#888', marginBottom: 24 }}>
              Se actualizaron <strong style={{ color: '#fff' }}>{updatedCount}</strong> registros correctamente.
            </p>
            <button
              onClick={resetAll}
              style={{
                background: '#fff', color: '#000', border: 'none',
                fontWeight: 800, padding: '12px 28px', borderRadius: '10px',
                fontSize: '12px', cursor: 'pointer',
              }}
            >
              NUEVA MODIFICACIÓN MASIVA
            </button>
          </div>
        )}
      </div>

      {/* MODAL DE REGISTROS DEL GRUPO */}
      {modalOpen && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.8)', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
          }}
          onClick={() => setModalOpen(false)}
        >
          <div
            style={{
              background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 12, width: '100%', maxWidth: 1200,
              maxHeight: '90vh', display: 'flex', flexDirection: 'column',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header del modal */}
            <div style={{
              padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 4 }}>
                  Registros del grupo: {modalGrupo}
                </h3>
                <p style={{ fontSize: 12, color: '#888' }}>
                  {modalRegistros.length} registros encontrados
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                style={{
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  color: '#888', borderRadius: 6, padding: '8px 12px',
                  fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                <X size={14} /> Cerrar
              </button>
            </div>

            {/* Contenido del modal */}
            <div style={{ padding: 24, overflow: 'auto', flex: 1 }}>
              {modalLoading ? (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <Loader2 size={32} className="animate-spin" style={{ color: '#60a5fa', margin: '0 auto 12px' }} />
                  <p style={{ color: '#888', fontSize: 13 }}>Cargando registros...</p>
                </div>
              ) : modalRegistros.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>
                  <p>No se encontraron registros</p>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <th style={{ textAlign: 'left', padding: '10px 12px', color: '#666', fontWeight: 700, fontSize: 10, textTransform: 'uppercase' }}>Nombre</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px', color: '#666', fontWeight: 700, fontSize: 10, textTransform: 'uppercase' }}>CUIL</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px', color: '#666', fontWeight: 700, fontSize: 10, textTransform: 'uppercase' }}>Empleador</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px', color: '#666', fontWeight: 700, fontSize: 10, textTransform: 'uppercase' }}>Estado</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px', color: '#666', fontWeight: 700, fontSize: 10, textTransform: 'uppercase' }}>Score</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px', color: '#666', fontWeight: 700, fontSize: 10, textTransform: 'uppercase' }}>Analista</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modalRegistros.map((r, idx) => (
                      <tr
                        key={r.id}
                        style={{
                          borderBottom: '1px solid rgba(255,255,255,0.03)',
                          background: idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
                        }}
                      >
                        <td style={{ padding: '10px 12px', color: '#ccc', fontWeight: 600 }}>{r.nombre || '-'}</td>
                        <td style={{ padding: '10px 12px', color: '#888', fontFamily: 'monospace' }}>{r.cuil || '-'}</td>
                        <td style={{ padding: '10px 12px', color: '#fbbf24', fontWeight: 600 }}>{r.empleador}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{
                            padding: '2px 8px', borderRadius: 4, fontSize: 10,
                            background: 'rgba(255,255,255,0.05)', color: '#888', fontWeight: 600,
                          }}>
                            {STATUS_LABEL[r.estado] ?? r.estado}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', color: '#60a5fa', fontWeight: 700 }}>{r.puntaje ?? '-'}</td>
                        <td style={{ padding: '10px 12px', color: '#888' }}>{r.analista || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE TODOS LOS EMPLEADORES */}
      {modalEmpleadoresOpen && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.8)', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
          }}
          onClick={() => setModalEmpleadoresOpen(false)}
        >
          <div
            style={{
              background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 12, width: '100%', maxWidth: 1200,
              maxHeight: '92vh', display: 'flex', flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header del modal */}
            <div style={{
              padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 4 }}>
                  Todos los Empleadores
                </h3>
                <p style={{ fontSize: 12, color: '#888' }}>
                  {empleadoresConConteo.length} empleadores únicos
                </p>
              </div>
              <button
                onClick={() => setModalEmpleadoresOpen(false)}
                style={{
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  color: '#888', borderRadius: 6, padding: '8px 12px',
                  fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                <X size={14} /> Cerrar
              </button>
            </div>

            {/* Buscador + filtros tipo */}
            <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input
                className="form-input"
                placeholder="Buscar empleador..."
                value={busquedaEmpleadorModal}
                onChange={e => setBusquedaEmpleadorModal(e.target.value)}
                style={{
                  background: '#111', color: '#ccc', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '6px', padding: '10px 12px', fontSize: '13px', width: '100%', outline: 'none',
                }}
              />
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {([
                 { key: 'todos', label: 'Todos' },
                 { key: 'publico', label: 'Público' },
                 { key: 'privada', label: 'Privado' },
                 { key: 'fisica', label: 'P. Física' },
                 { key: 'maestros', label: 'Maestros' },
                 { key: 'otros', label: 'Otros' },
                ] as const).map(({ key, label }) => {
                  const activo = filtroTipoModal === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setFiltroTipoModal(key)}
                      style={{
                        background: activo ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${activo ? 'rgba(251,191,36,0.4)' : 'rgba(255,255,255,0.1)'}`,
                        color: activo ? '#fbbf24' : '#666',
                        borderRadius: '4px', padding: '4px 12px',
                        fontSize: '10px', fontWeight: 800, cursor: 'pointer',
                        textTransform: 'uppercase', letterSpacing: '0.5px',
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Contenido del modal */}
            <div style={{ padding: 24, overflow: 'auto', flex: 1 }}>
              {empleadoresLoading ? (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <Loader2 size={32} className="animate-spin" style={{ color: '#60a5fa', margin: '0 auto 12px' }} />
                  <p style={{ color: '#888', fontSize: 13 }}>Cargando empleadores...</p>
                </div>
              ) : (
                <>
                  {(() => {
                    const esSA = (n: string) => /\bS\.?A\.?\b/i.test(n);
                    const esSRL = (n: string) => /\bS\.?R\.?L\.?\b/i.test(n);

                    let filtered = busquedaEmpleadorModal.trim()
                      ? empleadoresConConteo.filter(e =>
                          e.nombre.toLowerCase().includes(busquedaEmpleadorModal.toLowerCase()) ||
                          e.tipo.toLowerCase().includes(busquedaEmpleadorModal.toLowerCase()) ||
                          e.categoria.toLowerCase().includes(busquedaEmpleadorModal.toLowerCase())
                        )
                      : empleadoresConConteo;

                    if (filtroTipoModal === 'publico') filtered = filtered.filter(e => e.tipo === 'Público');
                    else if (filtroTipoModal === 'privada') filtered = filtered.filter(e => e.tipo === 'S.A' || e.tipo === 'S.R.L' || e.tipo === 'Privada');
                    else if (filtroTipoModal === 'fisica') filtered = filtered.filter(e => e.tipo === 'Persona Física');
                    else if (filtroTipoModal === 'maestros') filtered = filtered.filter(e => e.masterName === e.nombre);
                    else if (filtroTipoModal === 'otros') filtered = filtered.filter(e => !['S.A', 'S.R.L', 'Público', 'Persona Física', 'Privada'].includes(e.tipo));

                    const renderTable = (items: typeof filtered, title?: string, color?: string) => (
                      <div style={{ marginBottom: title ? 24 : 0 }}>
                        {title && (
                          <div style={{
                            fontSize: '10px', fontWeight: 900, color: color || '#888',
                            textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12,
                            paddingBottom: 6, borderBottom: `1px solid rgba(255,255,255,0.05)`,
                            display: 'flex', alignItems: 'center', gap: 8
                          }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: color || '#888' }} />
                            {title} ({items.length})
                          </div>
                        )}
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                            <thead>
                              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                <th style={{ textAlign: 'left', padding: '12px', color: '#555', fontWeight: 800, textTransform: 'uppercase' }}>Empresa</th>
                                <th style={{ textAlign: 'left', padding: '12px', color: '#555', fontWeight: 800, textTransform: 'uppercase' }}>Tipo</th>
                                <th style={{ textAlign: 'left', padding: '12px', color: '#555', fontWeight: 800, textTransform: 'uppercase' }}>Categoría</th>
                                <th style={{ textAlign: 'center', padding: '12px', color: '#555', fontWeight: 800, textTransform: 'uppercase' }}>Cant.</th>
                                <th style={{ textAlign: 'center', padding: '12px', color: '#555', fontWeight: 800, textTransform: 'uppercase' }}>%</th>
                                <th style={{ textAlign: 'right', padding: '12px', color: '#555', fontWeight: 800, textTransform: 'uppercase' }}>Acciones</th>
                              </tr>
                            </thead>
                            <tbody>
                              {items.map((emp, idx) => {
                                const isMaster = emp.masterName === emp.nombre;
                                const totalGeneral = items.reduce((acc, curr) => acc + curr.cantidad, 0);
                                const porcentaje = totalGeneral > 0 ? ((emp.cantidad / totalGeneral) * 100).toFixed(1) : '0';
                                
                                return (
                                  <tr key={idx} style={{ 
                                    borderBottom: '1px solid rgba(255,255,255,0.02)',
                                    background: isMaster ? 'rgba(52,211,153,0.02)' : 'transparent'
                                  }}>
                                    <td style={{ padding: '12px' }}>
                                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ color: isMaster ? '#34d399' : '#ccc', fontWeight: 600 }}>{emp.nombre}</span>
                                      </div>
                                    </td>
                                    <td style={{ padding: '12px' }}>
                                      <span style={{ 
                                        padding: '2px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.04)',
                                        color: '#888', fontSize: '10px', fontWeight: 700 
                                      }}>
                                        {emp.tipo}
                                      </span>
                                    </td>
                                    <td style={{ padding: '12px' }}>
                                      <span style={{ 
                                        color: emp.categoria === 'Estado' ? '#60a5fa' : '#888',
                                        fontSize: '11px', fontWeight: 600 
                                      }}>
                                        {emp.categoria}
                                      </span>
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>
                                      <span style={{ fontWeight: 800, color: '#555' }}>{emp.cantidad}</span>
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>
                                      <span style={{ 
                                        fontWeight: 800, color: '#34d399', fontSize: '11px',
                                        background: 'rgba(52,211,153,0.1)', padding: '2px 6px', borderRadius: 4
                                      }}>
                                        {porcentaje}%
                                      </span>
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'right' }}>
                                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                        <button
                                          onClick={() => {
                                            setEmpleadoresSeleccionados([emp.nombre]);
                                            setEmpleadorCorreccion(emp.nombre);
                                            setModalEmpleadoresOpen(false);
                                          }}
                                          style={{
                                            padding: '4px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.04)',
                                            border: '1px solid rgba(255,255,255,0.1)', color: '#aaa',
                                            fontSize: '10px', fontWeight: 800, cursor: 'pointer'
                                          }}
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
                        <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>
                          <p>No se encontraron empleadores</p>
                        </div>
                      );
                    }

                    if (filtroTipoModal === 'privada') {
                      const sa = filtered.filter(e => e.tipo === 'S.A');
                      const srl = filtered.filter(e => e.tipo === 'S.R.L');
                      const otras = filtered.filter(e => e.tipo === 'Privada');
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          {sa.length > 0 && renderTable(sa, 'Sociedades Anónimas (S.A.)', '#fbbf24')}
                          {srl.length > 0 && renderTable(srl, 'Sociedades de Resp. Limitada (S.R.L.)', '#fbbf24')}
                          {otras.length > 0 && renderTable(otras, 'Otras Entidades Privadas', '#fbbf24')}
                        </div>
                      );
                    }

                    return renderTable(filtered);
                  })()}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE EMPLEADORES NUEVOS DE HOY */}
      {showEmpleadoresHoy && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.8)', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
          }}
          onClick={() => setShowEmpleadoresHoy(false)}
        >
          <div
            style={{
              background: '#0a0a0a', border: '1px solid rgba(16,185,129,0.2)',
              borderRadius: 12, width: '100%', maxWidth: 900,
              maxHeight: '90vh', display: 'flex', flexDirection: 'column',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              padding: '20px 24px', borderBottom: '1px solid rgba(16,185,129,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
            }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: '#34d399', marginBottom: 4 }}>
                  Registros con Empleador
                </h3>
                <p style={{ fontSize: 12, color: '#888' }}>
                  {empleadoresHoy.length} registro{empleadoresHoy.length !== 1 ? 's' : ''} con empleador cargado
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: '#666', fontWeight: 700, textTransform: 'uppercase' }}>Desde</span>
                  <input
                    type="date"
                    value={fechaDesdeHoy}
                    onChange={e => setFechaDesdeHoy(e.target.value)}
                    style={{
                      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                      color: '#ccc', borderRadius: 6, padding: '5px 8px', fontSize: 12,
                      colorScheme: 'dark',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: '#666', fontWeight: 700, textTransform: 'uppercase' }}>Hasta</span>
                  <input
                    type="date"
                    value={fechaHastaHoy}
                    onChange={e => setFechaHastaHoy(e.target.value)}
                    style={{
                      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                      color: '#ccc', borderRadius: 6, padding: '5px 8px', fontSize: 12,
                      colorScheme: 'dark',
                    }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
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
                    } catch (err) {
                      setToast({ message: 'Error al eliminar registros', type: 'error' });
                    } finally {
                      setLoadingEmpleadoresHoy(false);
                    }
                  }}
                  style={{
                    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                    color: '#f87171', borderRadius: 6, padding: '8px 12px',
                    fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                    fontWeight: 700,
                  }}
                >
                  <Trash2 size={14} /> Eliminar
                </button>
                <button
                  onClick={() => setShowEmpleadoresHoy(false)}
                  style={{
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                    color: '#888', borderRadius: 6, padding: '8px 12px',
                    fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  <X size={14} /> Cerrar
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }}>
              {loadingEmpleadoresHoy ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
                  <Loader2 size={24} className="animate-spin" style={{ color: '#34d399' }} />
                </div>
              ) : empleadoresHoy.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>
                  <p>No se encontraron registros creados hoy.</p>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '10px 12px', color: '#666', fontWeight: 700, fontSize: 10, textTransform: 'uppercase' }}>CUIL</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px', color: '#666', fontWeight: 700, fontSize: 10, textTransform: 'uppercase' }}>Apellido y Nombre</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px', color: '#666', fontWeight: 700, fontSize: 10, textTransform: 'uppercase' }}>Empleador</th>
                    </tr>
                  </thead>
                  <tbody>
                    {empleadoresHoy.map((r, idx) => (
                      <tr
                        key={r.id}
                        style={{
                          borderBottom: '1px solid rgba(255,255,255,0.03)',
                          background: idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
                        }}
                      >
                        <td style={{ padding: '10px 12px', color: '#888', fontFamily: 'monospace', fontSize: 12 }}>{r.cuil || '-'}</td>
                        <td style={{ padding: '10px 12px', color: '#ccc', fontWeight: 600, fontSize: 12 }}>{r.nombre || '-'}</td>
                        <td style={{ padding: '10px 12px', color: '#34d399', fontWeight: 600, fontSize: 12 }}>{r.empleador}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
