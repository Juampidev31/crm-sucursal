'use client';

import React, { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { motion } from 'framer-motion';
import { formatCurrency, formatDate, capitalizarNombre, capitalizarTexto, sanitizarCuil, formatearCuil, displayAnalista, STATUS_LABEL } from '@/lib/utils';
import { Registro, Recordatorio } from '@/types';
import { Edit2, Trash2, X, Save, AlertCircle, AlertTriangle, Bell, FileText, DollarSign, Hash, SlidersHorizontal, MessageSquare, Search, ChevronDown, CheckCircle2, Plus, Minus, Timer, Pin, Maximize2, Minimize2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRegistros } from '@/features/registros/RegistrosProvider';
import { useRecordatorios } from '@/features/recordatorios/RecordatoriosProvider';
import { useSettings } from '@/features/settings/SettingsProvider';
import { useFilter, ESTADOS } from '@/context/FilterContext';
import { useAnalistas } from '@/features/settings/SettingsProvider';
import { logAudit } from '@/lib/audit';
import { corregirTildes } from '@/lib/correccion-tildes';
import ModalPortal from '@/components/ModalPortal';
import BitacoraModal from '@/components/BitacoraModal';
import { TagBadge, EtiquetasModal } from '@/components/EtiquetasSelector';
import { Tag } from 'lucide-react';
import { getLocalidadesByCP, getCPByLocalidad, addCustomMapping } from '@/lib/codigos-postales';
import { useSearchParams } from 'next/navigation';

// ── Constants ─────────────────────────────────────────────────────────────────

const WhatsAppIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.031 0C5.385 0 0 5.383 0 12.029c0 2.124.553 4.195 1.603 6.012L.117 23.518l5.626-1.476a11.97 11.97 0 0 0 6.288 1.765h.005c6.645 0 12.033-5.383 12.033-12.029C24.068 5.383 18.681 0 12.031 0zm0 21.802h-.004a9.982 9.982 0 0 1-5.088-1.385l-.365-.216-3.784.992.996-3.69-.237-.377a9.969 9.969 0 0 1-1.523-5.31c0-5.508 4.484-9.99 9.992-9.99 5.511 0 9.995 4.482 9.995 9.99s-4.484 9.99-9.992 9.99zm5.48-7.502c-.3-.15-1.776-.877-2.052-.978-.276-.1-.477-.15-.678.15-.201.3-.777.978-.952 1.178-.175.2-.35.226-.65.076-1.401-.703-2.529-1.36-3.486-2.923-.175-.302.176-.277.752-1.428.1-.2.05-.376-.025-.526-.075-.15-.678-1.633-.928-2.235-.244-.591-.492-.511-.678-.521-.175-.01-.376-.01-.577-.01-.2 0-.526.075-.802.376-.276.3-1.053 1.028-1.053 2.508 0 1.48 1.078 2.912 1.228 3.113.15.201 2.124 3.245 5.143 4.549 2.058.887 2.802.952 3.805.803 1.002-.15 3.211-1.312 3.662-2.583.451-1.272.451-2.361.316-2.583-.135-.226-.511-.35-.812-.501z"/>
  </svg>
);

const ESTADOS_PERMITIDOS_DUPLICADO = ['venta', 'derivado / aprobado cc'];

const initialForm: Partial<Registro> = {
  cuil: '', nombre: '', puntaje: 0, es_re: false,
  analista: '', fecha: '', fecha_score: '', monto: 0, interes: 0,
  estado: 'proyeccion', comentarios: '', dependencia: '', telefono: '',
};

const REGEX_NOMBRE = /^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ,.\s-]+$/;

const FIELD_LABELS: Record<string, string> = {
  nombre: 'Nombre', cuil: 'CUIL', analista: 'Analista',
  estado: 'Estado', monto: 'Monto', interes: 'Interés', fecha: 'Fecha',
  puntaje: 'Score', es_re: 'Es RE', comentarios: 'Comentarios', telefono: 'Teléfono',
  tipo_cliente: 'Tipo cliente', acuerdo_precios: 'Acuerdo precios',
  fecha_score: 'Fecha score', cuotas: 'Cuotas', rango_etario: 'Rango etario',
  sexo: 'Sexo', empleador: 'Empleador', dependencia: 'Dependencia', localidad: 'Localidad',
};

const DEPENDENCIAS_POR_DEFECTO = [
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
  'Secretaria de modernizacion del estado'
].sort();

const DEPENDENCIAS_MUNICIPALIDAD_PARANA = [
  'Administracion Fiscal Municipal',
  'Area Operativa Integral',
  'Coordinacion de Derechos Humanos',
  'Coordinacion de Recoleccion y Saneamiento',
  'Coordinacion para el abordaje Integral a las personas victimas de violencia de genero',
  'Coordinación de Integración Social a Personas en Situación de Calle',
  'Coordinación General de la Secretaría de Seguridad Vial, Movilidad y Ordenamiento Urbano',
  'Cuerpo Unico de Inspectores',
  'Departamento de Educacion y Extension Ecologica',
  'Desarrollo institucional SS a la Comunidad',
  'Direccion Balneario Thompson',
  'Direccion de Actas y Notificaciones',
  'Direccion de Archivos General',
  'Direccion de Arquitectura',
  'Direccion de Arquitectura Social y Mantenimiento Espacios Publicos',
  'Direccion de Defensa Civil',
  'Direccion de Fiscalizacion y Control Ambiental',
  'Direccion de Liquidacion de Haberes de Personal',
  'Direccion de Mantenimiento y Servicios Generales',
  'Direccion de Museos y Patrimonio Historico',
  'Direccion de Parques y Paseos - Sector Este',
  'Direccion de Recoleccion Sistematizada',
  'Direccion de Señalizacion',
  'Direccion de Taxis y Remises',
  'Direccion de Tramites Externos',
  'Direccion de espacios de cuidados de primera infancia',
  'Direccion de la casa de la mujer',
  'Direccion de produccion y Distribucion',
  'Direccion Despacho (Subsecretaria de infraestructura)',
  'Direccion General Parque Botanico',
  'Direccion General de Alumbrado Publico',
  'Direccion General de Conservacion Vial',
  'Direccion General de Desarrollo Institucional y Servicios',
  'Direccion General de Habilitaciones comerciales',
  'Direccion General de Integracion Social para personas mayores',
  'Direccion General de Parques y Paseos',
  'Direccion General de Recursos Humanos',
  'Direccion General de Salud Municipal',
  'Direccion General de Talleres Mecanicos',
  'Direccion Miradores Bajada Grande',
  'Direccion Residencia Madre Teresa de calcuta',
  'Honorable Consejo Deliberante',
  'Juzgado de Faltas 3',
  'Subsecretaria de Deporte Social y Capacitacion',
  'Subsecretaria de Educacion Formal y No formal',
  'Subsecretaria de Obras Sanitarias',
  'Subsecretaria de Prevision y Suministros',
  'Subsecretaria de Servicios Publicos',
  'Tesoreria General',
  'Unidad Municipal 3 - Sureste',
  'Unidad Municipal 4 Noreste',
  'Unidad Municipal Sur',
  'Unidad Municioal 2 - Oeste',
  'Unidad de Barrido',
].sort();

const ESTABLECIMIENTOS_MINISTERIO_SALUD = [
  'Area Emergencia Sanitaria',
  'Automotores',
  'Centro HUELLAS',
  'Centro de salud BELGRANO',
  'Centro de salud DR. L. ETCHEVEHERE',
  'Centro de salud EL BRETE',
  'Centro de salud HERMANA CATALINA',
  'Centro de salud JORGE NEWBERY',
  'Centro de salud MALVINAS ARGENTINAS',
  'Centro de salud SAN BENITO',
  'Centro de salud SELIG GOLDING',
  'Direccion de Atencion Medica',
  'Direccion de despacho',
  'Direccion de odontologia',
  'Hospital Escuela de Salud Mental',
  'Hospital Materno Infantil SAN ROQUE - Nivel 3B',
  'Hospital PASCUAL PALMA',
  'Hospital SAN MARTIN - Nivel 3B',
  'Hospital San Blas - NOGOYA - Nivel 2',
  'Jardin Maternal TERNURA',
  'Mesa de entradas',
  'Ministerio de Salud de Entre Rios',
  'Secretaria de salud - Direccion 2',
  'Subsecretaria de Servicios Asistenciales y Gestion',
].sort();

const ESTABLECIMIENTOS_CONSEJO_EDUCACION = [
  'Anexo Carlos Maria Onetti Nocturna 144',
  'Centro Comunitario 11',
  'Complejo Escuela Hogar Eva Peron',
  'Dirección de Educación de Jóvenes y Adultos',
  'Division de concursos de Secundaria (EGB - 3, Media, Polimodal y Superior)',
  'Escuela Bernardino Rivadavia 3-EGB 1 y 2',
  'Escuela Capitan de Fragata P.E.Giachino 193-EGB 1 y 2',
  'Escuela Carolina Tobar Garcia Especial 3',
  'Escuela Coronel Alvarez Condarco 185-EGB 1 y 2',
  'Escuela De los Cielitos 93-EGB 1 y 2',
  'Escuela EET 4-CFP - Secundaria Tecnica Dr. Jorge Pedro Busti',
  'Escuela ENET Teniente Luis Candelaria 3',
  'Escuela Evita 207-EGB 1 y 2',
  'Escuela Francisco Soler 16-EGB 1 y 2',
  'Escuela Jorge Newbery 22-EGB 1 y 2',
  'Escuela Luz Vieira Mendez 189-EGB 1 y 2',
  'Escuela Maestro Entrerriano 198 - Inicial',
  'Escuela Privada 009 - Rosario Vera Peñaloza',
  'Escuela Privada N° 127 Pastor Enrique Marconi',
  'Escuela Privada de gestión publica N°22 San Antonio Maria Gianelli',
  'Escuela Republica de Chile 132-EGB 1 y 2',
  'Escuela Secundaria N° 31 Jose de San Martin',
  'Escuela Secundaria N° 35 Cesareo Bernaldo de Quiros',
  'Escuela Secundaria N° 36 Capitan Justo Jose de Urquiza',
  'Escuela Secundaria N° 44 "Enrique Berduc"',
  'Escuela Secundaria N° 48 Congreso de Oriente',
  'Escuela Secundaria N° 5-EGB 1 y 2 Manuel Belgrano',
  'Escuela Secundaria N° 50 República de Entre Ríos',
  'Escuela Secundaria N° 6 Lomas del Mirador',
  'Escuela Secundaria N° 67 Tabare',
  'Escuela Secundaria N° Manuel Belgrano',
  'Escuela Secundaria de Adultos N° 23 Josefina Zubizarreta',
  'Escuela Soldados de Malvinas 200-EGB 1 y 2',
  'Escuela de Educación Técnica (EET) N° 3',
  'Organismo Central',
  'Parque Escolar Enrique Berduc',
  'Supervision Departamental de Educacion',
  'Taller Antequeda',
  'Unidad Educativa de Nivel Inicial N° 70',
  'Unidad Educativa del Centenario Nivel Inicial 2',
].sort();

function norm(s: string) {
  return s.toUpperCase()
    .replace(/[ÁÀÄÂ]/g, 'A')
    .replace(/[ÉÈËÊ]/g, 'E')
    .replace(/[ÍÌÏÎ]/g, 'I')
    .replace(/[ÓÒÖÔ]/g, 'O')
    .replace(/[ÚÙÜÛ]/g, 'U')
    .replace(/Ñ/g, 'N');
}

function esConsejoEducacion(s?: string) {
  if (!s) return false;
  const u = norm(s);
  return u.includes('CONSEJO') && u.includes('EDUCACI');
}

function esMinisterioSalud(s?: string) {
  if (!s) return false;
  const u = norm(s);
  return u.includes('MINISTERIO') && u.includes('SALUD');
}

function esMunicipalidad(s?: string) {
  if (!s) return false;
  return norm(s).includes('MUNICIPALIDAD');
}

function esGobiernoProvincial(s?: string) {
  if (!s) return false;
  const u = norm(s);
  return u.includes('GOBIERNO') && u.includes('ENTRE RIOS');
}

function esMinisterioDesarrolloHumano(s?: string) {
  if (!s) return false;
  const u = norm(s);
  return u.includes('MINISTERIO') && (u.includes('DESARROLLO') || u.includes('HUMANO'));
}

const DEPENDENCIAS_MINISTERIO_DESARROLLO_HUMANO = [
  'Direccion de la mujer',
  'Ministerio de Desarrollo Humano de Entre Rios',
  'Ministerio de Salud y Accion Social',
].sort();

function getDependencias(empleador?: string): string[] {
if (esMunicipalidad(empleador)) return DEPENDENCIAS_MUNICIPALIDAD_PARANA;
  if (esMinisterioSalud(empleador)) return ESTABLECIMIENTOS_MINISTERIO_SALUD;
  if (esConsejoEducacion(empleador)) return ESTABLECIMIENTOS_CONSEJO_EDUCACION;
  if (esMinisterioDesarrolloHumano(empleador)) return DEPENDENCIAS_MINISTERIO_DESARROLLO_HUMANO;
  return DEPENDENCIAS_POR_DEFECTO;
}

// Empleadores que exigen cargar la dependencia/repartición
function requiereDependencia(empleador?: string): boolean {
  return esGobiernoProvincial(empleador) || esMunicipalidad(empleador) ||
         esConsejoEducacion(empleador) || esMinisterioSalud(empleador) ||
         esMinisterioDesarrolloHumano(empleador);
}

// ── Validation ────────────────────────────────────────────────────────────────

function validarForm(form: Partial<Registro>, isAdmin: boolean): Record<string, string> {
  if (isAdmin) return {};
  const errs: Record<string, string> = {};
  if (!form.nombre?.trim()) errs.nombre = 'Requerido';
  else if (form.nombre.trim().length < 2) errs.nombre = 'Mín. 2 caracteres';
  else if (!REGEX_NOMBRE.test(form.nombre.trim())) errs.nombre = 'Solo letras';

  if (!form.cuil?.trim()) errs.cuil = 'Requerido';
  else if (form.cuil.length !== 11) errs.cuil = '11 dígitos';

  if (!form.analista?.trim()) errs.analista = 'Requerido';
  if (!form.estado) errs.estado = 'Requerido';
  const requiereTipoYAcuerdo = form.estado === 'venta' || form.estado === 'derivado / aprobado cc';
  if (requiereTipoYAcuerdo && !form.tipo_cliente) errs.tipo_cliente = 'Requerido';
  if (requiereTipoYAcuerdo && !form.acuerdo_precios) errs.acuerdo_precios = 'Requerido';
  if (requiereTipoYAcuerdo && !form.cuotas?.trim()) errs.cuotas = 'Requerido';
  if (requiereTipoYAcuerdo && !form.rango_etario) errs.rango_etario = 'Requerido';
  if (requiereTipoYAcuerdo && !form.sexo) errs.sexo = 'Requerido';
  if (requiereTipoYAcuerdo && !form.empleador?.trim()) errs.empleador = 'Requerido';
  if (requiereTipoYAcuerdo && !form.localidad?.trim()) errs.localidad = 'Requerido';
  
  if (requiereDependencia(form.empleador) && !form.dependencia?.trim()) {
    errs.dependencia = 'Requerido';
  }

  // Validación de Score vs Acuerdo de precios
  if (form.puntaje !== undefined && form.acuerdo_precios) {
    const score = Number(form.puntaje);
    const acuerdo = form.acuerdo_precios;
    if (score < 500 && acuerdo !== 'No califica') {
      errs.acuerdo_precios = 'Debe ser No califica (0-499)';
    } else if (score >= 500 && score < 600 && acuerdo !== 'Riesgo Medio') {
      errs.acuerdo_precios = 'Debe ser Riesgo MEDIO (500-599)';
    } else if (score >= 600 && score < 700 && acuerdo !== 'Riesgo Bajo') {
      errs.acuerdo_precios = 'Debe ser Riesgo BAJO (600-699)';
    } else if (score >= 700 && acuerdo !== 'Premium') {
      errs.acuerdo_precios = 'Debe ser PREMIUM (700-999)';
    }
  }

  if (form.estado === 'derivado / rechazado cc' && !form.comentarios?.trim())
    errs.comentarios = 'Requerido — ingresá el motivo de rechazo';

  const requiereInteres = form.estado === 'venta' || form.estado === 'derivado / aprobado cc';
  if (requiereInteres) {
    if (form.interes === undefined || form.interes === null || String(form.interes).trim() === '') {
      errs.interes = 'Requerido';
    } else if (isNaN(Number(form.interes))) {
      errs.interes = 'Inválido';
    }
  }

  if (form.fecha) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const selected = new Date(form.fecha + 'T00:00:00');
    if (selected > today) errs.fecha = 'No se permiten fechas futuras';
  }

  return errs;
}

// ── Field wrapper ─────────────────────────────────────────────────────────────

const Field = memo(function Field({ label, error, children, transparentLabel }: { label: string; error?: string; children: React.ReactNode; transparentLabel?: boolean }) {
  const isRequired = label.includes('*');
  const cleanLabel = label.replace('*', '').trim();

  return (
    <div className="form-group">
      <label className="form-label" style={transparentLabel ? { color: 'transparent', userSelect: 'none' } : undefined}>
        {cleanLabel || '—'}
        {isRequired && <span style={{ color: 'var(--rojo)', marginLeft: 4 }}>*</span>}
        {error && <span style={{ color: 'var(--rojo)', fontWeight: 400, marginLeft: 6 }}>— {error}</span>}
      </label>
      {children}
    </div>
  );
});

// ── PremiumSelect Component ───────────────────────────────────────────────────

const PremiumSelect = ({
  value,
  onChange,
  options,
  placeholder = "Seleccionar...",
  isSearchable = false,
  groups,
  onAddCustom,
  error,
  disabled = false,
  style
}: {
  value: string;
  onChange: (val: string) => void;
  options?: string[];
  placeholder?: string;
  isSearchable?: boolean;
  groups?: { label: string; items: string[] }[];
  onAddCustom?: () => void;
  error?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const [search, setSearch] = useState("");
  const ref = React.useRef<HTMLDivElement>(null);

  const toggleOpen = () => {
    if (disabled) return;
    if (!isOpen && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setOpenUpward(spaceBelow < 250);
    }
    setIsOpen(prev => !prev);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options || [];
    const q = search.toLowerCase();
    return (options || []).filter(opt => opt.toLowerCase().includes(q));
  }, [options, search]);

  const filteredGroups = useMemo(() => {
    if (!groups) return null;
    if (!search.trim()) return groups;
    const q = search.toLowerCase();
    return groups.map(g => ({
      ...g,
      items: g.items.filter(item => item.toLowerCase().includes(q))
    })).filter(g => g.items.length > 0);
  }, [groups, search]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setSearch("");
  };

  const addCustomBtn = onAddCustom && (
    <div
      onClick={(e) => { e.stopPropagation(); onAddCustom(); setIsOpen(false); }}
      style={{
        padding: '10px 12px',
        fontSize: '12px',
        color: '#34d399',
        fontWeight: 800,
        cursor: 'pointer',
        borderTop: '1px solid rgba(255, 255, 255, 0.12)',
        background: '#141418',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        position: 'sticky',
        bottom: 0,
        zIndex: 20,
        boxShadow: '0 -4px 12px rgba(0, 0, 0, 0.6)'
      }}
      onMouseEnter={e => e.currentTarget.style.background = '#1e1e24'}
      onMouseLeave={e => e.currentTarget.style.background = '#141418'}
    >
      <Plus size={14} /> {search ? `Agregar "${search}"...` : 'Agregar otro...'}
    </div>
  );

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <div
        className="form-select"
        tabIndex={disabled ? -1 : 0}
        onClick={toggleOpen}
        onKeyDown={e => { 
          if (!disabled && (e.key === 'Enter' || e.key === ' ')) { 
            e.preventDefault(); 
            toggleOpen();
          } 
          if (e.key === 'Escape') {
            e.stopPropagation();
            setIsOpen(false);
          }
        }}
        style={{
          width: '100%',
          height: '38px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px',
          background: disabled ? 'rgba(255,255,255,0.02)' : '#000000',
          border: `1px solid ${isOpen ? '#34d399' : (error ? 'var(--rojo)' : 'rgba(255, 255, 255, 0.12)')}`,
          borderRadius: '8px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          color: disabled ? 'var(--text-muted)' : (value ? '#e7e5e4' : '#9ca3af'),
          fontSize: '13px',
          transition: 'all 0.2s ease',
          opacity: disabled ? 0.6 : 1,
          outline: 'none',
          boxSizing: 'border-box',
          ...style
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {value || placeholder}
        </span>
        <ChevronDown size={14} style={{
          flexShrink: 0,
          marginLeft: 8,
          transition: 'transform 0.3s ease',
          transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          opacity: 0.5
        }} />
      </div>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0,
          right: 0,
          background: '#0c0c0c',
          border: '1px solid rgba(255,255,255,0.14)',
          borderRadius: '10px',
          boxShadow: '0 12px 36px rgba(0,0,0,0.95)',
          zIndex: 9999,
          overflow: 'hidden',
          animation: 'selectFade 0.2s ease-out'
        }}>
          {isSearchable && (
            <div style={{
              padding: '8px',
              borderBottom: '1px solid var(--border)',
              background: 'rgba(255,255,255,0.01)'
            }}>
              <div style={{ position: 'relative' }}>
                <Search size={12} style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)'
                }} />
                <input
                  autoFocus
                  placeholder="Buscar..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onClick={e => e.stopPropagation()}
                  style={{
                    width: '100%',
                    padding: '8px 8px 8px 28px',
                    fontSize: '12px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    color: '#fff',
                    outline: 'none'
                  }}
                />
              </div>
            </div>
          )}

          <div style={{ maxHeight: '170px', overflowY: 'auto', padding: '4px' }}>
            {!search && (
              <div
                onClick={(e) => { e.stopPropagation(); handleSelect(""); }}
                style={{
                  padding: '8px 10px',
                  fontSize: '13px',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  borderRadius: '6px',
                  marginBottom: '4px',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontStyle: 'italic'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <X size={12} /> Sin especificar
              </div>
            )}
            {groups ? (
              <>
                {filteredGroups?.map((g, idx) => (
                  <div key={idx}>
                    <div style={{
                      padding: '8px 10px 4px',
                      fontSize: '9px',
                      fontWeight: 800,
                      color: 'var(--gris)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>{g.label}</div>
                    {g.items.map(opt => (
                      <div
                        key={opt}
                        onClick={(e) => { e.stopPropagation(); handleSelect(opt); }}
                        style={{
                          padding: '8px 10px',
                          fontSize: '13px',
                          color: value === opt ? '#86efac' : '#fff',
                          background: value === opt ? 'rgba(134, 239, 172, 0.1)' : 'transparent',
                          cursor: 'pointer',
                          borderRadius: '6px',
                          margin: '2px 0'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                        onMouseLeave={e => e.currentTarget.style.background = value === opt ? 'rgba(134, 239, 172, 0.1)' : 'transparent'}
                      >
                        {opt}
                      </div>
                    ))}
                  </div>
                ))}
                {addCustomBtn}
              </>
            ) : (
              <>
                {filteredOptions.length > 0 ? (
                  filteredOptions.map(opt => (
                    <div
                      key={opt}
                      onClick={(e) => { e.stopPropagation(); handleSelect(opt); }}
                      style={{
                        padding: '8px 10px',
                        fontSize: '13px',
                        color: value === opt ? '#86efac' : '#fff',
                        background: value === opt ? 'rgba(134, 239, 172, 0.1)' : 'transparent',
                        cursor: 'pointer',
                        borderRadius: '6px',
                        margin: '2px 0'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                      onMouseLeave={e => e.currentTarget.style.background = value === opt ? 'rgba(134, 239, 172, 0.1)' : 'transparent'}
                    >
                      {opt}
                    </div>
                  ))
                ) : !onAddCustom && (
                  <div style={{ padding: '12px', textAlign: 'center', color: 'var(--gris)', fontSize: '12px' }}>
                    Sin resultados
                  </div>
                )}
                {addCustomBtn}
              </>
            )}
          </div>
        </div>
      )}
      {/* selectFade animation is in globals.css */}
    </div>
  );
};

// ── Modal: WhatsApp ─────────────────────────────────────────────────────────────

const WhatsappModal = memo(function WhatsappModal({
  registro, onConfirm, onCancel,
}: { registro: Registro | null; onConfirm: (telefono: string, action: 'save' | 'send') => void; onCancel: () => void }) {
  const [telefono, setTelefono] = useState('');
  const [errorVisible, setErrorVisible] = useState(false);

  useEffect(() => {
    if (registro) {
      setTelefono(registro.telefono || '');
      setErrorVisible(false);
    }
  }, [registro]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') {
        if (!telefono) { setErrorVisible(true); return; }
        onConfirm(telefono, 'send');
      }
    };
    if (registro) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [registro, onCancel, onConfirm, telefono]);

  const handleConfirm = (action: 'save' | 'send') => {
    if (!telefono) { setErrorVisible(true); return; }
    setErrorVisible(false);
    onConfirm(telefono, action);
  };

  if (!registro) return null;
  return (
    <ModalPortal>
      <div className="modal-overlay" onClick={onCancel} style={{ backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 1200 }}>
        <motion.div drag dragMomentum={false} className="modal-content" style={{ maxWidth: '400px', background: 'var(--bg-elev-1)', border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
          <div style={{
              background: 'rgba(14, 14, 18, 0.96)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '16px 16px 0 0',
              padding: '20px 24px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: '16px',
            }}>
              <div>
                <h3 style={{
                  fontSize: '13px', fontWeight: 800, color: '#25D366', margin: '0 0 6px 0',
                  textTransform: 'uppercase', letterSpacing: '0.5px',
                  display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                  <WhatsAppIcon size={16} />
                  WhatsApp / Teléfono
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--fg-dim)', margin: 0, lineHeight: 1.4 }}>
                  {registro.nombre ? <span style={{ color: '#fff', fontWeight: 700 }}>{registro.nombre} — </span> : null}
                  Ingresá el número de teléfono para continuar
                </p>
              </div>
              <button className="btn-icon" onClick={onCancel} style={{ color: 'var(--fg-muted)', background: 'rgba(255,255,255,0.03)', borderRadius: '50%', padding: '6px', flexShrink: 0 }}><X size={16} /></button>
            </div>
          <div className="modal-body" style={{ padding: '24px 28px 28px' }}>
            <input
              autoFocus
              type="tel"
              className="form-input"
              value={telefono}
              onChange={e => { setTelefono(e.target.value.replace(/\D/g, '').slice(0, 10)); setErrorVisible(false); }}
              placeholder="Ej: 3434538564 (10 dígitos)"
              style={{ width: '100%', borderColor: errorVisible ? '#ef4444' : undefined }}
            />
            {/* Pop-up de error inline */}
            <motion.div
              initial={false}
              animate={errorVisible ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              style={{
                marginTop: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '9px 13px',
                borderRadius: 8,
                background: 'rgba(239,68,68,0.13)',
                border: '1px solid rgba(239,68,68,0.35)',
                color: '#fca5a5',
                fontSize: 12,
                fontWeight: 700,
                pointerEvents: 'none',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              El teléfono es obligatorio
            </motion.div>
          </div>
          <div className="modal-footer" style={{ padding: '20px 28px', background: 'rgba(0,0,0,0.2)', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button className="btn-secondary" onClick={onCancel} style={{
              background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', color: 'var(--fg-muted)',
              fontWeight: 700, padding: '10px 20px', borderRadius: '8px', fontSize: '12px', letterSpacing: '0.5px'
            }}>CANCELAR</button>
            <button className="btn-secondary" onClick={() => handleConfirm('save')} style={{
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontWeight: 800,
              padding: '10px 20px', borderRadius: '8px', fontSize: '12px', letterSpacing: '0.5px', cursor: 'pointer'
            }}>
              GUARDAR
            </button>
            <button className="btn-primary" onClick={() => handleConfirm('send')} style={{
              background: '#25D366', color: '#fff', border: 'none', fontWeight: 800,
              padding: '10px 24px', borderRadius: '8px', fontSize: '12px', letterSpacing: '0.5px', cursor: 'pointer'
            }}>
              ENVIAR
            </button>
          </div>
        </motion.div>
      </div>
    </ModalPortal>
  );
});

// ── Modal: Registro ───────────────────────────────────────────────────────────

const RegistroModal = memo(function RegistroModal({
  isOpen, editingId, initialData, onClose, onSaved, onSavedWithRecordatorio, isAdmin,
}: {
  isOpen: boolean; editingId: string | null; initialData: Partial<Registro>;
  onClose: () => void; onSaved: (reg: Registro) => void;
  onSavedWithRecordatorio?: (registro: Registro) => void; isAdmin: boolean;
}) {
  const { nombres: ANALISTAS } = useAnalistas();
  const [form, setForm] = useState<Partial<Registro>>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [showDupModal, setShowDupModal] = useState(false);
  const [dupRecord, setDupRecord] = useState<Registro | null>(null);
  const [dupBlocked, setDupBlocked] = useState(false);
  const [agendarRecordatorio, setAgendarRecordatorio] = useState(false);
  const [empleadorCustom, setEmpleadorCustom] = useState(false);
  const [dependenciaCustom, setDependenciaCustom] = useState(false);
  const [cp, setCp] = useState('');
  const [cpAddOpen, setCpAddOpen] = useState(false);
  const [cpAddLoc, setCpAddLoc] = useState('');
  const [cpMapVersion, setCpMapVersion] = useState(0);
  const { registros: allRegistros } = useRegistros();

  // Derivar empleadores y localidades reactivamente desde DataContext
  const empleadoresDB = useMemo(() =>
    Array.from(new Set(allRegistros.map(r => r.empleador).filter(Boolean) as string[])).sort(),
    [allRegistros]
  );
  const empleadoresAgrupados = useMemo(() => {
    const esSA = (e: string) => /\bS\.?A\.?\b/i.test(e);
    const esSRL = (e: string) => /\bS\.?R\.?L\.?\b/i.test(e);

    const sa    = empleadoresDB.filter(e => esSA(e));
    const srl   = empleadoresDB.filter(e => esSRL(e));
    const otros = empleadoresDB.filter(e => !esSA(e) && !esSRL(e));
    return { sa, srl, otros };
  }, [empleadoresDB]);

  // ── Auto-corrección de sufijos legales ──────────────────────────────────
  const normalizarSufijosLegales = useCallback((valor: string): string => {
    if (!valor) return valor;
    // Patrones de sufijos legales con todas sus variantes
    return valor
      .replace(/\b(s\.?\s*r\.?\s*l\.?)\b/gi, 'S.R.L.')
      .replace(/\b(s\.?\s*a\.?\s*s\.?)\b/gi, 'S.A.S.')
      .replace(/\b(s\.?\s*a\.?)\b(?!\s*\.?\s*s)/gi, 'S.A.')
      .replace(/\b(ltda\.?)\b/gi, 'Ltda.')
      .replace(/\b(cia\.?)\b/gi, 'Cia.')
      .replace(/\b(e\.?\s*i\.?\s*r\.?\s*l\.?)\b/gi, 'E.I.R.L.');
  }, []);

  useEffect(() => {
    if (isOpen) {
      setForm(initialData);
      setErrors({});
      setShowPhoneModal(false);
      setShowDupModal(false);
      setDupRecord(null);
      setDupBlocked(false);
      setAgendarRecordatorio(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialData]);

  useEffect(() => {
    if (isOpen) {
      setEmpleadorCustom(!!initialData.empleador && !empleadoresDB.includes(initialData.empleador));
      setDependenciaCustom(
        !!initialData.dependencia &&
        !DEPENDENCIAS_POR_DEFECTO.includes(initialData.dependencia || '') &&
        !DEPENDENCIAS_MUNICIPALIDAD_PARANA.includes(initialData.dependencia || '') &&
        !ESTABLECIMIENTOS_MINISTERIO_SALUD.includes(initialData.dependencia || '') &&
        !ESTABLECIMIENTOS_CONSEJO_EDUCACION.includes(initialData.dependencia || '') &&
        !allRegistros.some(r => r.dependencia === initialData.dependencia)
      );
      setCp(initialData.localidad ? (getCPByLocalidad(initialData.localidad) || '') : '');
      setCpAddOpen(false);
      setCpAddLoc('');
    }
  }, [isOpen, initialData, empleadoresDB, allRegistros]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showPhoneModal) { setShowPhoneModal(false); e.stopImmediatePropagation(); }
        else if (showDupModal) { setShowDupModal(false); e.stopImmediatePropagation(); }
        else if (isOpen) { onClose(); e.stopImmediatePropagation(); }
      }
    };
    if (isOpen || showDupModal || showPhoneModal) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, showDupModal, showPhoneModal, onClose]);

  const set = (field: keyof Registro, value: unknown) => {
    setForm(prev => {
      const next = { ...prev, [field]: value };

      // Auto-actualizar acuerdo_precios según el score
      if (field === 'puntaje' && value !== undefined && value !== '') {
        const score = Number(value);
        if (score < 500) next.acuerdo_precios = 'No califica';
        else if (score < 600) next.acuerdo_precios = 'Riesgo Medio';
        else if (score < 700) next.acuerdo_precios = 'Riesgo Bajo';
        else next.acuerdo_precios = 'Premium';
      }

      // Ya no limpiamos el empleador automáticamente al cambiar de estado
      return next;
    });

    if (errors[field]) setErrors(prev => { const e = { ...prev }; delete e[field]; return e; });
    if (field === 'puntaje' && errors.acuerdo_precios) {
      setErrors(prev => { const e = { ...prev }; delete e.acuerdo_precios; return e; });
    }
  };

  // Venta / Aprobado CC exigen los campos demográficos completos e Interés
  const esVentaOAprobado = form.estado === 'venta' || form.estado === 'derivado / aprobado cc';
  const requiereInteres = form.estado === 'venta' || form.estado === 'derivado / aprobado cc';
  // Venta / Aprobado CC / Proyección exigen Teléfono
  const requiereTelefono = form.estado === 'venta' || form.estado === 'derivado / aprobado cc' || form.estado === 'proyeccion';

  const guardar = async (bypassDupCheck = false) => {
    const errs = validarForm(form, isAdmin);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    if (!bypassDupCheck) {
      const cuil = form.cuil?.trim() ?? '';
      const nombre = form.nombre?.trim() ?? '';
      let q1 = supabase.from('registros').select('id,nombre,cuil,estado').eq('cuil', cuil);
      let q2 = supabase.from('registros').select('id,nombre,cuil,estado').ilike('nombre', nombre);
      if (editingId) { q1 = q1.neq('id', editingId); q2 = q2.neq('id', editingId); }
      const [{ data: d1 }, { data: d2 }] = await Promise.all([q1, q2]);
      const seen = new Set<string>();
      const dups = [...(d1 ?? []), ...(d2 ?? [])].filter(d => { if (seen.has(d.id)) return false; seen.add(d.id); return true; });
      if (dups.length > 0) {
        const dup = dups[0] as Registro;
        setDupRecord(dup);
        setDupBlocked(!isAdmin && !ESTADOS_PERMITIDOS_DUPLICADO.includes(dup.estado));
        setShowDupModal(true);
        return;
      }
    }

    // Al validar correctamente el formulario, solo se solicita el teléfono de forma obligatoria en Venta, Aprobado CC y Proyección
    if (requiereTelefono && !isAdmin) {
      setShowPhoneModal(true);
    } else {
      await persistirRegistro(form.telefono || '', 'save');
    }
  };

  const handlePhoneConfirm = async (telefono: string, action: 'save' | 'send') => {
    setShowPhoneModal(false);
    await persistirRegistro(telefono, action);
  };

  const persistirRegistro = async (telefono: string, action: 'save' | 'send') => {
    setSaving(true);
    const cleanTel = telefono ? telefono.replace(/\D/g, '') : '';
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, created_at, updated_at, ...cleanForm } = form as Registro & { created_at?: string; updated_at?: string };
    const payload = {
      ...cleanForm,
      telefono: cleanTel || null,
      monto: Number(form.monto),
      interes: form.interes === undefined || form.interes === null || (form.interes as unknown as string) === '' ? null : Number(form.interes),
      puntaje: Number(form.puntaje),
      fecha: cleanForm.fecha || null,
      fecha_score: cleanForm.fecha_score || null,
    };
    if (editingId) {
      const { error } = await supabase.from('registros').update(payload).eq('id', editingId);
      if (error) { setErrors({ _: error.message }); setSaving(false); return; }
      // Auditar todos los cambios en una sola entrada
      const AUDIT_FIELDS = ['nombre', 'cuil', 'analista', 'estado', 'monto', 'interes', 'fecha', 'fecha_score', 'puntaje', 'es_re', 'comentarios', 'telefono', 'tipo_cliente', 'acuerdo_precios', 'cuotas', 'rango_etario', 'sexo', 'empleador', 'dependencia', 'localidad'] as const;
      const cambios = AUDIT_FIELDS.filter(field => String((initialData as Record<string, unknown>)[field] ?? '') !== String((payload as Record<string, unknown>)[field] ?? ''));
      if (cambios.length > 0) {
        logAudit({
          id_registro: editingId,
          nombre: String(payload.nombre ?? ''),
          cuil: String(payload.cuil ?? ''),
          analista: String(payload.analista ?? ''),
          accion: 'Modificación',
          campo_modificado: cambios.map(f => FIELD_LABELS[f] ?? f).join(', '),
          valor_anterior: cambios.map(f => String((initialData as Record<string, unknown>)[f] ?? '—')).join(' | '),
          valor_nuevo: cambios.map(f => String((payload as Record<string, unknown>)[f] ?? '—')).join(' | '),
        });
      }
      const savedReg: Registro = { ...form as Registro, ...payload, telefono: cleanTel, id: editingId };
      onClose();
      if (agendarRecordatorio && onSavedWithRecordatorio) onSavedWithRecordatorio(savedReg);
      else onSaved(savedReg);

      if (action === 'send' && cleanTel) {
        const waNum = cleanTel.length === 10 ? `549${cleanTel}` : cleanTel;
        window.open(`https://web.whatsapp.com/send?phone=${waNum}`, '_blank');
      }
    } else {
      const { data: newReg, error } = await supabase.from('registros').insert(payload).select().single();
      if (error) { setErrors({ _: error.message }); setSaving(false); return; }
      logAudit({ id_registro: (newReg as Registro).id, nombre: String(payload.nombre ?? ''), cuil: String(payload.cuil ?? ''), analista: String(payload.analista ?? ''), accion: 'Creación', campo_modificado: 'Nuevo registro', valor_nuevo: `${payload.nombre} | ${payload.estado} | $${payload.monto}` });
      onClose();
      if (agendarRecordatorio && onSavedWithRecordatorio && newReg) onSavedWithRecordatorio(newReg as Registro);
      else onSaved(newReg as Registro);

      if (action === 'send' && cleanTel) {
        const waNum = cleanTel.length === 10 ? `549${cleanTel}` : cleanTel;
        window.open(`https://web.whatsapp.com/send?phone=${waNum}`, '_blank');
      }
    }
    setSaving(false);
  };

  const [modalZoom, setModalZoom] = useState<number>(1);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('crm_modal_edit_zoom_level_v1');
      if (saved) {
        const val = parseFloat(saved);
        if (!isNaN(val)) setModalZoom(val);
      }
    }

    const handleZoomEvent = (e: Event) => {
      const customEvt = e as CustomEvent<number>;
      if (customEvt.detail) setModalZoom(customEvt.detail);
    };

    window.addEventListener('crm_modal_edit_zoom_changed', handleZoomEvent);
    return () => window.removeEventListener('crm_modal_edit_zoom_changed', handleZoomEvent);
  }, []);

  const handleModalZoom = (delta: number) => {
    setModalZoom(prev => {
      const next = Math.max(0.7, Math.round((prev + delta) * 100) / 100);
      if (typeof window !== 'undefined') {
        localStorage.setItem('crm_modal_edit_zoom_level_v1', String(next));
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('crm_modal_edit_zoom_changed', { detail: next }));
        }, 0);
      }
      return next;
    });
  };

  const resetModalZoom = () => {
    setModalZoom(1);
    if (typeof window !== 'undefined') {
      localStorage.setItem('crm_modal_edit_zoom_level_v1', '1');
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('crm_modal_edit_zoom_changed', { detail: 1 }));
      }, 0);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <ModalPortal>
      <div className="modal-overlay" onClick={onClose} style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
        <motion.div drag dragMomentum={false} className="modal-content" onClick={e => e.stopPropagation()} style={{
          background: 'var(--bg-elev-1)',
          backgroundImage: 'radial-gradient(ellipse at top left, rgba(16,185,129,0.08), transparent 50%), radial-gradient(ellipse at bottom right, rgba(255,255,255,0.02), transparent 40%)',
          border: '1px solid var(--border)',
          borderTop: '1px solid rgba(16,185,129,0.3)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05), 0 0 20px rgba(16,185,129,0.05)',
          borderRadius: '16px',
          overflow: 'visible',
          display: 'flex',
          flexDirection: 'column',
          zoom: modalZoom,
          transition: 'all 0.2s ease'
        }}>
          <div className="modal-header" style={{
            background: 'rgba(14, 14, 18, 0.96)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '16px 16px 0 0',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '16px',
          }}>
            <div>
              <h3 style={{
                fontSize: '13px', fontWeight: 800, color: '#fff', margin: '0 0 6px 0',
                textTransform: 'uppercase', letterSpacing: '0.5px',
                display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                {editingId ? <Edit2 size={16} strokeWidth={2.5} style={{ color: '#34d399' }} /> : <Plus size={16} strokeWidth={2.5} style={{ color: '#34d399' }} />}
                {editingId ? 'Editar' : 'Nuevo'} registro
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--fg-dim)', margin: 0, lineHeight: 1.4 }}>
                {editingId ? 'Modificá los datos del registro seleccionado' : 'Completá los campos para crear un nuevo registro'}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              {/* Zoom Controls (- % +) */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '20px',
                padding: '2px 4px',
                gap: '2px'
              }}>
                <button
                  type="button"
                  onClick={() => handleModalZoom(-0.05)}
                  title="Reducir tamaño del modal (-)"
                  style={{
                    width: '22px', height: '22px', borderRadius: '50%',
                    background: 'none', border: 'none', color: '#9ca3af',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                  onMouseLeave={e => e.currentTarget.style.color = '#9ca3af'}
                >
                  <Minus size={12} strokeWidth={2.5} />
                </button>
                <span
                  onClick={resetModalZoom}
                  title="Restablecer a 100%"
                  style={{
                    fontSize: '11px', fontWeight: 800, color: modalZoom === 1 ? '#9ca3af' : '#34d399',
                    padding: '0 4px', cursor: 'pointer', userSelect: 'none'
                  }}
                >
                  {Math.round(modalZoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => handleModalZoom(0.05)}
                  title="Agrandar tamaño del modal (+)"
                  style={{
                    width: '22px', height: '22px', borderRadius: '50%',
                    background: 'none', border: 'none', color: '#9ca3af',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                  onMouseLeave={e => e.currentTarget.style.color = '#9ca3af'}
                >
                  <Plus size={12} strokeWidth={2.5} />
                </button>
              </div>

              <button className="btn-icon" onClick={onClose} style={{ color: 'var(--fg-muted)', background: 'rgba(255,255,255,0.03)', borderRadius: '50%', padding: '6px', flexShrink: 0 }}><X size={18} /></button>
            </div>
          </div>
          <div className="modal-body" style={{ overflow: 'visible', padding: '16px 20px', flex: 1 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '10px 14px', marginBottom: '12px', alignItems: 'start' }}>
              <Field label="CUIL *" error={errors.cuil}>
                <input className="form-input" value={formatearCuil(form.cuil || '')} onChange={e => set('cuil', sanitizarCuil(e.target.value))} inputMode="numeric" autoFocus />
              </Field>
              <Field label="Nombre *" error={errors.nombre}>
                <input className="form-input" value={form.nombre || ''} onChange={e => set('nombre', isAdmin ? corregirTildes(e.target.value) : corregirTildes(capitalizarNombre(e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚüÜñÑ,.\s-]/g, ''))))} onPaste={e => {
                  if (isAdmin) return;
                  e.preventDefault();
                  const pasted = e.clipboardData.getData('text');
                  const clean = pasted.replace(/[^a-zA-ZáéíóúÁÉÍÓÚüÜñÑ,.\s-]/g, '');
                  set('nombre', corregirTildes(capitalizarNombre(clean)));
                }} />
              </Field>
              <Field label={`Analista${isAdmin ? '' : ' *'}`} error={errors.analista}>
                <PremiumSelect
                  value={form.analista || (isAdmin ? 'Sin especificar' : '')}
                  onChange={val => set('analista', val === 'Sin especificar' ? '' : val)}
                  options={isAdmin ? ['Sin especificar', ...ANALISTAS] : [...ANALISTAS]}
                  error={errors.analista}
                />
              </Field>
              <Field label="Estado *">
                <PremiumSelect
                  value={form.estado || 'proyeccion'}
                  onChange={val => set('estado', val)}
                  options={ESTADOS}
                  placeholder="Seleccionar estado..."
                />
              </Field>
              <Field label="Monto" error={errors.monto}>
                <input className="form-input" type="number" value={form.monto || ''} onChange={e => set('monto', e.target.value)} />
              </Field>
              <Field label={`Interés${(requiereInteres && !isAdmin) ? ' *' : ''}`} error={errors.interes}>
                <input className="form-input" type="number" value={form.interes ?? ''} onChange={e => set('interes', e.target.value)} placeholder="$" />
              </Field>
              <Field label="Fecha" error={errors.fecha}>
                <input className="form-input" type="date" value={form.fecha || ''} onChange={e => set('fecha', e.target.value)} max={new Date().toISOString().split('T')[0]} />
              </Field>
              <Field label="Fecha Score">
                <input className="form-input" type="date" value={form.fecha_score || ''} onChange={e => set('fecha_score', e.target.value)} />
              </Field>
              <Field label="Score">
                <input className="form-input" type="number" value={form.puntaje || ''} onChange={e => set('puntaje', Number(e.target.value))} placeholder="0" />
              </Field>
              <Field label={`Tipo de cliente${esVentaOAprobado ? ' *' : ''}`} error={errors.tipo_cliente}>
                <PremiumSelect
                  value={form.tipo_cliente || ''}
                  onChange={val => set('tipo_cliente', val)}
                  options={['Apertura', 'Renovacion']}
                  placeholder="— Sin especificar —"
                />
              </Field>
              <Field label={`Acuerdo de precios${esVentaOAprobado ? ' *' : ''}`} error={errors.acuerdo_precios}>
                <PremiumSelect
                  value={form.acuerdo_precios || ''}
                  onChange={val => set('acuerdo_precios', val)}
                  options={['Riesgo Bajo', 'Riesgo Medio', 'Premium', 'No califica']}
                  placeholder="— Sin especificar —"
                />
              </Field>
              <Field label={`Cuotas${esVentaOAprobado ? ' *' : ''}`} error={errors.cuotas}>
                <input className="form-input" value={form.cuotas || ''} onChange={e => set('cuotas', e.target.value)} placeholder="Ej: 12, 24, 36" />
              </Field>
              <Field label={`Rango etario${esVentaOAprobado ? ' *' : ''}`} error={errors.rango_etario}>
                <PremiumSelect
                  value={form.rango_etario || ''}
                  onChange={val => set('rango_etario', val)}
                  options={['18-25', '26-35', '36-45', '46-55', '56-65', '65+']}
                  placeholder="— Sin especificar —"
                />
              </Field>
              <Field label={`Sexo${esVentaOAprobado ? ' *' : ''}`} error={errors.sexo}>
                <PremiumSelect
                  value={form.sexo || ''}
                  onChange={val => set('sexo', val)}
                  options={['Masculino', 'Femenino', 'Otro']}
                  placeholder="— Sin especificar —"
                />
              </Field>
              <Field label={`Empleador${esVentaOAprobado ? ' *' : ''}`} error={errors.empleador}>
                {isAdmin ? (
                  <>
                    <input
                      className="form-input"
                      list="empleadores-datalist"
                      value={form.empleador || ''}
                      onChange={e => set('empleador', e.target.value)}
                      onBlur={e => set('empleador', e.target.value.trim())}
                      placeholder="— Sin especificar —"
                    />
                    <datalist id="empleadores-datalist">
                      {empleadoresDB.map(emp => <option key={emp} value={emp} />)}
                    </datalist>
                  </>
                ) : empleadorCustom ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      className="form-input"
                      style={{ flex: 1 }}
                      value={form.empleador || ''}
                      onChange={e => set('empleador', corregirTildes(e.target.value.charAt(0).toUpperCase() + e.target.value.slice(1).toLowerCase()))}
                      onBlur={e => {
                        const val = e.target.value.trim();
                        const upper = val.toUpperCase();
                        const esGobierno = esGobiernoProvincial(val);
                        const esDependenciaProvincial = (upper.includes('ENTRE RÍOS') || upper.includes('ENTRE RIOS')) &&
                                                      !esGobierno &&
                                                      !upper.includes('ENERSA') &&
                                                      !upper.includes('ENERGÍA DE ENTRE RÍOS') &&
                                                      !esMinisterioSalud(val);

                        if (esDependenciaProvincial) {
                          set('empleador', 'Gobierno de la Provincia de Entre Ríos');
                          set('dependencia', corregirTildes(val));
                          setDependenciaCustom(false);
                          setEmpleadorCustom(false);
                        } else {
                          set('empleador', normalizarSufijosLegales(val));
                        }
                      }}
                      onPaste={e => {
                        e.preventDefault();
                        const pasted = e.clipboardData.getData('text').trim();
                        set('empleador', corregirTildes(normalizarSufijosLegales(pasted.charAt(0).toUpperCase() + pasted.slice(1).toLowerCase())));
                      }}
                      placeholder="Nombre del empleador"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => { setEmpleadorCustom(false); set('empleador', ''); }}
                      title="Volver a la lista / No especificar"
                      className="btn-icon"
                      style={{ height: 40, width: 40, background: 'var(--surface2)', border: '1px solid var(--border-color)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <PremiumSelect
                    value={empleadoresDB.includes(form.empleador || '') ? (form.empleador || '') : ''}
                    onChange={val => {
                      const upper = val.toUpperCase();
                      const esGobierno = esGobiernoProvincial(val);
                      const esDependenciaProvincial = (upper.includes('ENTRE RÍOS') || upper.includes('ENTRE RIOS')) &&
                                                    !esGobierno &&
                                                    !esMunicipalidad(val) &&
                                                    !esMinisterioSalud(val) &&
                                                    !esConsejoEducacion(val) &&
                                                    !esMinisterioDesarrolloHumano(val) &&
                                                    !upper.includes('ENERSA') &&
                                                    !upper.includes('ENERGÍA DE ENTRE RÍOS');

                      if (esDependenciaProvincial) {
                        set('empleador', 'Gobierno de la Provincia de Entre Ríos');
                        set('dependencia', val);
                        setDependenciaCustom(false);
                      } else {
                        set('empleador', val);
                      }
                    }}
                    isSearchable={true}
                    placeholder="— Sin especificar —"
                    groups={[
                      { label: 'S.A.', items: empleadoresAgrupados.sa },
                      { label: 'S.R.L.', items: empleadoresAgrupados.srl },
                      { label: 'Otros', items: empleadoresAgrupados.otros },
                      { label: 'Dependencias provinciales', items: DEPENDENCIAS_POR_DEFECTO },
                    ]}
                    onAddCustom={() => {
                      setEmpleadorCustom(true);
                      set('empleador', '');
                    }}
                  />
                )}
              </Field>
              <Field label={`C.P.${esVentaOAprobado ? ' *' : ''}`} error={errors.localidad}>
                <input
                  className="form-input"
                  value={cp}
                  onChange={e => {
                    const next = e.target.value.replace(/\D/g, '').slice(0, 5);
                    setCp(next);
                    const m = getLocalidadesByCP(next);
                    if (m.length === 1) set('localidad', m[0]);
                    else if (m.length === 0) set('localidad', '');
                    else if (!m.includes(form.localidad || '')) set('localidad', '');
                  }}
                  placeholder="Código postal"
                  inputMode="numeric"
                />
                {cp && (() => {
                  void cpMapVersion;
                  const matches = getLocalidadesByCP(cp);
                  if (matches.length === 1) {
                    return (
                      <div style={{ marginTop: 6, fontSize: 13, color: '#86efac', fontWeight: 600 }}>
                        📍 {matches[0]}
                      </div>
                    );
                  }
                  if (matches.length > 1) {
                    return (
                      <div style={{ marginTop: 6 }}>
                        <PremiumSelect
                          value={form.localidad || ''}
                          onChange={val => set('localidad', val)}
                          options={matches}
                          placeholder="— Elegir localidad —"
                        />
                      </div>
                    );
                  }
                  return (
                    <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ fontSize: 12, color: 'var(--warning, #b45309)' }}>Sin coincidencia</div>
                      {isAdmin && !cpAddOpen && (
                        <button type="button" className="btn-secondary"
                          style={{ alignSelf: 'flex-start', fontSize: 12, padding: '4px 8px' }}
                          onClick={() => { setCpAddOpen(true); setCpAddLoc(''); }}>
                          + Agregar localidad
                        </button>
                      )}
                      {isAdmin && cpAddOpen && (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <input className="form-input" value={cpAddLoc}
                            onChange={e => setCpAddLoc(corregirTildes(capitalizarTexto(e.target.value)))}
                            placeholder="Nombre" style={{ flex: 1, height: 32 }} autoFocus />
                          <button type="button" className="btn-primary" style={{ padding: '0 10px', height: 32 }}
                            onClick={() => {
                              const name = cpAddLoc.trim();
                              if (!name) return;
                              addCustomMapping(cp, name);
                              set('localidad', name);
                              setCpAddOpen(false); setCpAddLoc('');
                              setCpMapVersion(v => v + 1);
                            }}>Guardar</button>
                          <button type="button" className="btn-icon"
                            onClick={() => { setCpAddOpen(false); setCpAddLoc(''); }}
                            style={{ height: 32, width: 32, background: 'var(--surface2)', border: '1px solid var(--border-color)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <X size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </Field>
            </div>
            {requiereDependencia(form.empleador) && (
              <div className="form-row">
                <Field label={`${(esConsejoEducacion(form.empleador) || esMinisterioSalud(form.empleador)) ? 'Establecimiento' : 'Repartición'} *`} error={errors.dependencia}>
                  {dependenciaCustom ? (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        className="form-input"
                        value={form.dependencia || ''}
                        onChange={e => set('dependencia', e.target.value)}
                        placeholder="Nombre de la dependencia"
                        style={{ flex: 1 }}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => { setDependenciaCustom(false); set('dependencia', ''); }}
                        className="btn-icon"
                        style={{ height: 40, width: 40, background: 'var(--surface2)', border: '1px solid var(--border-color)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <PremiumSelect
                      value={form.dependencia || ''}
                      onChange={val => set('dependencia', val)}
                      options={(() => {
                        const normDep = (s: string) => s.toUpperCase().replace(/º/g, '°').replace(/\s+/g, ' ').trim();
                        const all = [
                          ...getDependencias(form.empleador),
                          ...allRegistros.filter(r => norm(r.empleador || '') === norm(form.empleador || '')).map(r => r.dependencia).filter(Boolean) as string[],
                        ];
                        const seen = new Map<string, string>();
                        for (const v of all) { const k = normDep(v); if (!seen.has(k)) seen.set(k, v); }
                        return Array.from(seen.values()).sort();
                      })()}
                      placeholder="— Seleccionar dependencia —"
                      isSearchable={true}
                      onAddCustom={() => {
                        setDependenciaCustom(true);
                        set('dependencia', '');
                      }}
                    />
                  )}
                </Field>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '10px', marginBottom: '6px', alignItems: 'start' }}>
              <Field label={`Comentarios${form.estado === 'derivado / rechazado cc' ? ' *' : ''}`} error={errors.comentarios}>
                <textarea
                  className="form-input"
                  value={form.comentarios || ''}
                  onChange={e => set('comentarios', corregirTildes(e.target.value))}
                  rows={1}
                  style={{ resize: 'vertical', fontFamily: 'inherit', height: '100%', minHeight: '100%', padding: '6px 10px' }}
                  placeholder={form.estado === 'derivado / rechazado cc' ? 'Motivo de rechazo (obligatorio)...' : ''}
                />
              </Field>
              <Field label="Accion 1" transparentLabel={true}>
                <label 
                  className="modal-check-action"
                  style={{ 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', 
                    fontWeight: 700, borderRadius: '6px', width: '100%',
                    background: !!form.es_re ? 'rgba(16, 185, 129, 0.15)' : 'rgba(0,0,0,0.4)',
                    color: !!form.es_re ? '#10b981' : '#999',
                    border: !!form.es_re ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.12)',
                    transition: 'all 0.2s', boxSizing: 'border-box'
                  }}
                >
                  <input type="checkbox" checked={!!form.es_re} onChange={e => set('es_re', e.target.checked)} style={{ display: 'none' }} />
                  Resumen Ejecutivo (RE)
                </label>
              </Field>
              <Field label="Accion 2" transparentLabel={true}>
                <label 
                  className="modal-check-action"
                  style={{ 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', 
                    fontWeight: 700, borderRadius: '6px', width: '100%',
                    background: agendarRecordatorio ? 'rgba(245, 158, 11, 0.15)' : 'rgba(0,0,0,0.4)',
                    color: agendarRecordatorio ? '#f59e0b' : '#999',
                    border: agendarRecordatorio ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.12)',
                    transition: 'all 0.2s', boxSizing: 'border-box'
                  }}
                >
                  <input type="checkbox" checked={agendarRecordatorio} onChange={e => setAgendarRecordatorio(e.target.checked)} style={{ display: 'none' }} />
                  Agendar Recordatorio
                </label>
              </Field>
            </div>
            <p className="modal-required-legend" style={{ color: 'var(--rojo)', margin: '2px 0 0 0' }}>
              <span style={{ fontWeight: 700 }}>*</span> CAMPOS OBLIGATORIOS
            </p>
          </div>
          <div className="modal-footer" style={{
            background: 'rgba(0,0,0,0.2)', borderTop: '1px solid rgba(255,255,255,0.05)'
          }}>
            {errors._ && <span style={{ color: '#f87171', fontSize: '12px', flex: 1, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}><AlertTriangle size={13} />{errors._}</span>}
            {!errors._ && (
              <div style={{ flex: 1, fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', display: 'flex', alignItems: 'center' }}>
                Registro creado con fecha {initialData.created_at ? new Date(initialData.created_at).toLocaleDateString('es-AR') : new Date().toLocaleDateString('es-AR')} y hora {initialData.created_at ? new Date(initialData.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
            <button className="btn-secondary modal-btn-cancel" onClick={onClose} style={{
              background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--fg-muted)',
              fontWeight: 700, letterSpacing: '0.3px', transition: 'all 0.2s'
            }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}>CANCELAR</button>
            <button className="btn-primary modal-btn-save" onClick={() => guardar()} disabled={saving} style={{
              background: 'linear-gradient(90deg, #34d399, #10b981)', color: '#000', border: 'none',
              fontWeight: 800, letterSpacing: '0.3px', boxShadow: '0 4px 12px rgba(16,185,129,0.3)', transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', gap: '5px'
            }}>
              <Save size={13} strokeWidth={2.5} />{saving ? 'GUARDANDO…' : 'GUARDAR'}
            </button>
          </div>
        </motion.div>
      </div>
      </ModalPortal>

      {showPhoneModal && (
        <WhatsappModal
          registro={{ ...(form as Registro), telefono: form.telefono || '' }}
          onConfirm={handlePhoneConfirm}
          onCancel={() => setShowPhoneModal(false)}
        />
      )}

      {showDupModal && dupRecord && (
        <ModalPortal>
        <div className="modal-overlay" style={{ zIndex: 1100 }} onClick={() => { if (!dupBlocked) setShowDupModal(false); }}>
          <motion.div drag dragMomentum={false} className="modal-content" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
        <div style={{
            background: 'rgba(14, 14, 18, 0.96)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '16px 16px 0 0',
            padding: '20px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '16px',
          }}>
            <div>
              <h3 style={{
                fontSize: '13px', fontWeight: 800, margin: '0 0 6px 0',
                textTransform: 'uppercase', letterSpacing: '0.5px',
                display: 'flex', alignItems: 'center', gap: '8px',
                color: dupBlocked ? 'var(--rojo)' : '#f59e0b',
              }}>
                <AlertCircle size={16} strokeWidth={2.5} />
                {dupBlocked ? 'Registro duplicado' : 'Registro existente'}
              </h3>
              <p style={{ fontSize: '12px', color: dupBlocked ? '#fca5a5' : 'var(--fg-dim)', margin: 0, lineHeight: 1.4 }}>
                {dupBlocked ? 'Ya existe un registro activo para este cliente' : 'Ya existe un registro con este CUIL o nombre'}
              </p>
            </div>
            {!dupBlocked && <button className="btn-icon" onClick={() => setShowDupModal(false)} style={{ color: 'var(--fg-muted)', background: 'rgba(255,255,255,0.03)', borderRadius: '50%', padding: '6px', flexShrink: 0 }}><X size={18} /></button>}
          </div>
            <div className="modal-body" style={{ padding: '20px 28px' }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <AlertCircle size={20} style={{ color: dupBlocked ? 'var(--rojo)' : '#f59e0b', flexShrink: 0, marginTop: 2 }} />
                <div>
                  <p style={{ fontSize: '14px', fontWeight: 700, color: '#fff', marginBottom: 6 }}>{dupRecord.nombre}</p>
                  <p style={{ fontSize: '13px', color: 'var(--fg-muted)', marginBottom: 10 }}>
                    CUIL: {dupRecord.cuil} &nbsp;·&nbsp; Estado: <strong style={{ color: '#fff' }}>{STATUS_LABEL[dupRecord.estado] ?? dupRecord.estado}</strong>
                  </p>
                  {dupBlocked
                    ? <p style={{ fontSize: '13px', color: 'var(--fg-muted)', lineHeight: 1.6 }}>Este cliente ya tiene un registro activo en ese estado. No se puede crear un duplicado. Modificá el registro existente para continuar.</p>
                    : <p style={{ fontSize: '13px', color: 'var(--fg-muted)', lineHeight: 1.6 }}>Ya existe un registro con este CUIL o nombre. ¿Deseás guardar de todas formas?</p>
                  }
                </div>
              </div>
            </div>
            <div className="modal-footer">
              {dupBlocked
                ? <button className="btn-primary" onClick={() => setShowDupModal(false)} style={{ background: '#fff', color: '#000', border: 'none', fontWeight: 800, padding: '10px 24px', borderRadius: '10px', fontSize: '13px' }}>ENTENDIDO</button>
                : <>
                  <button className="btn-secondary" onClick={() => setShowDupModal(false)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--fg-muted)', fontWeight: 700, padding: '10px 20px', borderRadius: '10px', fontSize: '13px' }}>CANCELAR</button>
                  <button className="btn-primary" onClick={() => { setShowDupModal(false); guardar(true); }} style={{ background: '#fff', color: '#000', border: 'none', fontWeight: 900, padding: '10px 24px', borderRadius: '10px', fontSize: '13px' }}>GUARDAR DE TODAS FORMAS</button>
                </>
              }
            </div>
          </motion.div>
        </div>
        </ModalPortal>
      )}
    </>
  );
});

// ── Modal: Recordatorio ───────────────────────────────────────────────────────

const RecordatorioModal = memo(function RecordatorioModal({
  registro, onClose,
}: { registro: Registro | null; onClose: (saved: boolean, newRec?: Recordatorio) => void }) {
  const [recForm, setRecForm] = useState({ nota: '', fecha: '', hora: '09:00' });
  const [saving, setSaving] = useState(false);
  const { pushRecordatorioChange } = useRecordatorios();

  useEffect(() => {
    if (registro) {
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
      setRecForm({ nota: '', fecha: tomorrow.toISOString().split('T')[0], hora: '09:00' });
    }
  }, [registro]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(false); };
    if (registro) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [registro, onClose]);

  if (!registro) return null;

  const save = async () => {
    setSaving(true);
    const { data, error } = await supabase.from('recordatorios').insert({
      registro_id: registro.id, nombre: registro.nombre, cuil: registro.cuil,
      analista: registro.analista, estado: registro.estado, nota: recForm.nota,
      fecha_hora: `${recForm.fecha}T${recForm.hora}:00-03:00`,
      creado_por: registro.analista || 'Sistema', mostrado: false,
    }).select().single();

    if (error) {
      setSaving(false);
      return;
    }

    logAudit({ id_registro: registro.id, nombre: registro.nombre, cuil: registro.cuil, analista: registro.analista, accion: 'Recordatorio creado', campo_modificado: 'Recordatorio', valor_nuevo: `${registro.nombre} | ${recForm.fecha} ${recForm.hora}${recForm.nota ? ' | ' + recForm.nota : ''}` });
    // Broadcast a otros usuarios
    pushRecordatorioChange('INSERT', data as Recordatorio);
    setSaving(false); onClose(true, data as Recordatorio);
  };

  return (
    <div className="modal-overlay" onClick={() => onClose(false)}>
      <motion.div drag dragMomentum={false} className="modal-content" style={{ maxWidth: '460px' }} onClick={e => e.stopPropagation()}>
        <div style={{
            background: 'rgba(14, 14, 18, 0.96)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '16px 16px 0 0',
            padding: '20px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '16px',
          }}>
            <div>
              <h3 style={{
                fontSize: '13px', fontWeight: 800, color: '#fff', margin: '0 0 6px 0',
                textTransform: 'uppercase', letterSpacing: '0.5px',
                display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                <Bell size={16} strokeWidth={2.5} style={{ color: '#f59e0b' }} />
                Recordatorio & seguimiento
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--fg-dim)', margin: 0, lineHeight: 1.4 }}>
                Agendá un recordatorio para hacer seguimiento de este cliente
              </p>
            </div>
            <button className="btn-icon" onClick={() => onClose(false)} style={{ color: 'var(--fg-muted)', background: 'rgba(255,255,255,0.03)', borderRadius: '50%', padding: '6px', flexShrink: 0 }}><X size={18} /></button>
          </div>
        <div className="modal-body">
          <p style={{ fontSize: '13px', color: 'var(--fg-muted)', marginBottom: '20px' }}>{registro.nombre}</p>
          <div className="form-row">
            <Field label="Fecha *"><input className="form-input" type="date" value={recForm.fecha} onChange={e => setRecForm(p => ({ ...p, fecha: e.target.value }))} /></Field>
            <Field label="Hora *"><input className="form-input" type="time" value={recForm.hora} onChange={e => setRecForm(p => ({ ...p, hora: e.target.value }))} /></Field>
          </div>
          <Field label="Nota"><textarea className="form-textarea" value={recForm.nota} onChange={e => setRecForm(p => ({ ...p, nota: e.target.value }))} /></Field>

          <p className="modal-required-legend" style={{ color: 'var(--rojo)' }}>
            <span style={{ fontWeight: 700 }}>*</span> CAMPOS OBLIGATORIOS
          </p>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={() => onClose(false)} style={{
            background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', color: 'var(--fg-muted)',
            fontWeight: 700, padding: '10px 20px', borderRadius: '8px', fontSize: '12px', letterSpacing: '0.5px'
          }}>CANCELAR</button>
          <button className="btn-primary" onClick={save} disabled={saving || !recForm.fecha || !recForm.hora} style={{
            background: 'var(--green)', color: '#000', border: 'none', fontWeight: 800,
            padding: '10px 24px', borderRadius: '8px', fontSize: '12px', letterSpacing: '0.5px'
          }}>AGENDAR</button>
        </div>
      </motion.div>
    </div>
  );
});

// ── Modal: Comentarios ───────────────────────────────────────────────────────

const ComentariosModal = memo(function ComentariosModal({
  registro, onClose,
}: { registro: Registro | null; onClose: (saved: boolean, updatedComentarios?: string) => void }) {
  const [comentarios, setComentarios] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (registro) {
      setComentarios(registro.comentarios || '');
      setSaving(false);
    }
  }, [registro]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(false); };
    if (registro) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [registro, onClose]);

  if (!registro) return null;

  const save = async () => {
    setSaving(true);
    onClose(true, comentarios);
  };

  return (
    <div className="modal-overlay" onClick={() => onClose(false)}>
      <motion.div drag dragMomentum={false} className="modal-content" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
        <div style={{
            background: 'rgba(14, 14, 18, 0.96)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '16px 16px 0 0',
            padding: '20px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '16px',
          }}>
            <div>
              <h3 style={{
                fontSize: '13px', fontWeight: 800, color: '#fff', margin: '0 0 6px 0',
                textTransform: 'uppercase', letterSpacing: '0.5px',
                display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                <MessageSquare size={16} strokeWidth={2.5} style={{ color: '#818cf8' }} />
                Comentarios
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--fg-dim)', margin: 0, lineHeight: 1.4 }}>
                {registro?.nombre}
              </p>
            </div>
            <button className="btn-icon" onClick={() => onClose(false)} style={{ color: 'var(--fg-muted)', background: 'rgba(255,255,255,0.03)', borderRadius: '50%', padding: '6px', flexShrink: 0 }}><X size={18} /></button>
          </div>
        <div className="modal-body">
          <p style={{ fontSize: '13px', color: 'var(--fg-muted)', marginBottom: '16px', fontWeight: 600 }}>{registro.nombre}</p>
          <Field label="Comentarios">
            <textarea
              className="form-input"
              value={comentarios}
              onChange={e => setComentarios(corregirTildes(e.target.value))}
              rows={6}
              style={{ resize: 'vertical', fontFamily: 'inherit' }}
              placeholder="Sin comentarios..."
              autoFocus
            />
          </Field>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={() => onClose(false)} style={{
            background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', color: 'var(--fg-muted)',
            fontWeight: 700, padding: '10px 20px', borderRadius: '8px', fontSize: '12px', letterSpacing: '0.5px'
          }}>CANCELAR</button>
          <button className="btn-primary" onClick={save} disabled={saving} style={{
            background: 'var(--green)', color: '#000', border: 'none', fontWeight: 800,
            padding: '10px 24px', borderRadius: '8px', fontSize: '12px', letterSpacing: '0.5px'
          }}>{saving ? 'GUARDANDO…' : 'GUARDAR'}</button>
        </div>
      </motion.div>
    </div>
  );
});



// ── Modal: Confirmar borrado ──────────────────────────────────────────────────

const DeleteModal = memo(function DeleteModal({
  registro, onConfirm, onCancel,
}: { registro: Registro | null; onConfirm: () => void; onCancel: () => void }) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    if (registro) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [registro, onCancel]);

  if (!registro) return null;
  return (
    <ModalPortal>
    <div className="modal-overlay" onClick={onCancel}>
      <motion.div drag dragMomentum={false} className="modal-content modal-content--danger" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
        <div style={{
            background: 'rgba(14, 14, 18, 0.96)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '16px 16px 0 0',
            padding: '20px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '16px',
          }}>
            <div>
              <h3 style={{
                fontSize: '13px', fontWeight: 800, color: '#ef4444', margin: '0 0 6px 0',
                textTransform: 'uppercase', letterSpacing: '0.5px',
                display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                <AlertTriangle size={16} strokeWidth={2.5} />
                Eliminar registro
              </h3>
              <p style={{ fontSize: '12px', color: '#fca5a5', margin: 0, lineHeight: 1.4 }}>
                Esta acción es permanente y no se puede deshacer
              </p>
            </div>
            <button className="btn-icon" onClick={onCancel} style={{ color: 'var(--fg-muted)', background: 'rgba(255,255,255,0.03)', borderRadius: '50%', padding: '6px', flexShrink: 0 }}><X size={18} /></button>
          </div>
        <div className="modal-body" style={{ padding: '32px 28px' }}>
          <p style={{ fontSize: '14px', color: 'var(--fg-muted)', lineHeight: 1.8 }}>
            ¿Confirmar eliminación de <strong style={{ color: '#fff' }}>{registro.nombre}</strong>?<br />
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginTop: '10px', display: 'block' }}>La acción es permanente.</span>
          </p>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onCancel} style={{
            background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', color: 'var(--fg-muted)',
            fontWeight: 700, padding: '10px 20px', borderRadius: '8px', fontSize: '12px', letterSpacing: '0.5px'
          }}>CANCELAR</button>
          <button className="btn-danger" onClick={onConfirm} style={{
            background: '#ef4444', color: '#fff', border: 'none', fontWeight: 800,
            padding: '10px 24px', borderRadius: '8px', fontSize: '12px', letterSpacing: '0.5px'
          }}>
            ELIMINAR AHORA
          </button>
        </div>
      </motion.div>
    </div>
    </ModalPortal>
  );
});

// ── StatusBadge ───────────────────────────────────────────────────────────────

const StatusBadge = memo(function StatusBadge({ estado }: { estado: string }) {
  const label = STATUS_LABEL[estado?.toLowerCase()] ?? estado;
  
  // Custom styles for each status type
  let color = 'var(--fg-muted)';
  let bg = 'rgba(255,255,255,0.02)';
  let border = '1px solid rgba(255,255,255,0.05)';
  
  const estLower = estado?.toLowerCase();
  if (estLower === 'venta') {
    color = '#6ee7b7'; // Bright Emerald
    bg = 'rgba(16,185,129,0.18)';
    border = '1px solid rgba(16,185,129,0.35)';
  } else if (estLower === 'proyeccion') {
    color = '#fcd34d'; // Bright Amber
    bg = 'rgba(251,191,36,0.18)';
    border = '1px solid rgba(251,191,36,0.35)';
  } else if (estLower === 'en seguimiento') {
    color = '#7dd3fc'; // Bright Sky Blue
    bg = 'rgba(0, 212, 255, 0.18)';
    border = '1px solid rgba(0, 212, 255, 0.35)';
  } else if (estLower === 'derivado / aprobado cc') {
    color = '#86efac'; // Bright Mint Green
    bg = 'rgba(52,211,153,0.18)';
    border = '1px solid rgba(52,211,153,0.35)';
  } else if (estLower === 'derivado / rechazado cc' || estLower === 'no califica') {
    color = '#fca5a5'; // Bright Red
    bg = 'rgba(248,113,113,0.18)';
    border = '1px solid rgba(248,113,113,0.35)';
  } else if (estLower === 'score bajo') {
    color = '#fdba74'; // Bright Orange
    bg = 'rgba(249,115,22,0.18)';
    border = '1px solid rgba(249,115,22,0.35)';
  } else if (estLower === 'afectaciones') {
    color = '#d8b4fe'; // Bright Violet
    bg = 'rgba(178,102,255,0.18)';
    border = '1px solid rgba(178,102,255,0.35)';
  }

  return (
    <span style={{
      display: 'inline-block',
      padding: '4px 10px',
      borderRadius: '6px',
      fontSize: '11px',
      fontWeight: 700,
      letterSpacing: '0.3px',
      background: bg,
      color: color,
      border: border,
      whiteSpace: 'nowrap',
      textTransform: 'uppercase',
    }}>
      {label}
    </span>
  );
});

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RegistrosPage() {
  const { isAdmin } = useAuth();
  const { registros, applyRegistroChange, pushRegistroChange, loading, refresh } = useRegistros();
  const { alertasConfig, permisosConfig } = useSettings();
  const { nombres: ANALISTAS } = useAnalistas();
  const searchParams = useSearchParams();

  const canDeleteRegistros = useMemo(() => {
    if (isAdmin) return true;
    const perm = permisosConfig.find(p => p.rol === 'analista' && p.permiso === 'eliminar_registros');
    return perm ? perm.activo : true; // default true
  }, [isAdmin, permisosConfig]);

  const canEditRegistros = useMemo(() => {
    if (isAdmin) return true;
    const perm = permisosConfig.find(p => p.rol === 'analista' && p.permiso === 'editar_registros');
    return perm ? perm.activo : true; // default true
  }, [isAdmin, permisosConfig]);

  const canSeeComentarios = useMemo(() => {
    if (isAdmin) return true;
    const perm = permisosConfig.find(p => p.rol === 'analista' && p.permiso === 'ver_comentarios');
    return perm ? perm.activo : true; // default true
  }, [isAdmin, permisosConfig]);

  const canSeeRecordatorios = useMemo(() => {
    if (isAdmin) return true;
    const perm = permisosConfig.find(p => p.rol === 'analista' && p.permiso === 'ver_recordatorios');
    return perm ? perm.activo : true; // default true
  }, [isAdmin, permisosConfig]);

  const canSeeBitacora = useMemo(() => {
    if (isAdmin) return true;
    const perm = permisosConfig.find(p => p.rol === 'analista' && p.permiso === 'ver_bitacora');
    return perm ? perm.activo : true; // default true
  }, [isAdmin, permisosConfig]);

  const {
    filters, setFilter, toggleEtiqueta, limpiarFiltros, hayFiltros,
    isCreationModalOpen, setIsCreationModalOpen,
    pageSize,
    currentPage, setCurrentPage, setTotalResults,
    showFilters, setShowFilters,
  } = useFilter();

  const [showInlineFilters, setShowInlineFilters] = useState(false);

  useEffect(() => {
    if (searchParams.get('create') === 'true') {
      setIsCreationModalOpen(true);
      const url = new URL(window.location.href);
      url.searchParams.delete('create');
      window.history.replaceState({}, '', url.pathname + url.search);
    }
  }, [searchParams, setIsCreationModalOpen]);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [modalInitialData, setModalInitialData] = useState<Partial<Registro>>(initialForm);

  // Sync modal data when registros update externally (e.g. bulk empleador assign)
  // Guarded: skip when modal is closed to avoid unnecessary work on every realtime update
  const prevRegistrosRef = useRef(registros);
  useEffect(() => {
    if (!modalOpen || !editingId) return;
    if (prevRegistrosRef.current === registros) return;
    prevRegistrosRef.current = registros;
    const updated = registros.find(r => r.id === editingId);
    if (updated) {
      setModalInitialData({ ...updated, fecha: updated.fecha || '', fecha_score: updated.fecha_score || '' });
    }
  }, [registros, modalOpen, editingId]);

  const [recordatorioTarget, setRecordatorioTarget] = useState<Registro | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Registro | null>(null);
  const [whatsappTarget, setWhatsappTarget] = useState<Registro | null>(null);
  const [comentariosTarget, setComentariosTarget] = useState<Registro | null>(null);
  const [bitacoraTarget, setBitacoraTarget] = useState<Registro | null>(null);
  const [etiquetasTarget, setEtiquetasTarget] = useState<Registro | null>(null);
  const [recordatorios, setRecordatorios] = useState<Recordatorio[]>([]);

  // Fetch recordatorios
  useEffect(() => {
    const fetchRecordatorios = async () => {
      const { data, error } = await supabase
        .from('recordatorios')
        .select('*')
        .eq('mostrado', false);
      if (error) {
        console.error('Error fetching recordatorios:', error);
        return;
      }
      if (data) {
        setRecordatorios(data);
      }
    };
    fetchRecordatorios();

    // Realtime subscription for recordatorios - escucha cambios de TODOS los usuarios
    const channel = supabase
      .channel('recordatorios-realtime-registros')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recordatorios' }, async () => {
        const { data } = await supabase
          .from('recordatorios')
          .select('*')
          .eq('mostrado', false);
        if (data) setRecordatorios(data);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Pre-computar IDs con recordatorio vencido / hoy (🔴) y próximos 48h (🟡)
  const { vencidoOIngresoHoyIds, proximoIds } = useMemo(() => {
    const hoyFin = new Date();
    hoyFin.setHours(23, 59, 59, 999);
    const hoyFinTime = hoyFin.getTime();

    const venceHoySet = new Set<string>();
    const proximoSet = new Set<string>();

    for (const r of recordatorios) {
      if (!r.registro_id) continue;
      const t = new Date(r.fecha_hora).getTime();
      if (t <= hoyFinTime) {
        venceHoySet.add(r.registro_id);
      } else if (t <= hoyFinTime + 48 * 60 * 60 * 1000) {
        proximoSet.add(r.registro_id);
      }
    }
    return { vencidoOIngresoHoyIds: venceHoySet, proximoIds: proximoSet };
  }, [recordatorios]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (modalOpen) {
          return;
        }
        if (showInlineFilters) {
          setShowInlineFilters(false);
          return;
        }
        if (hayFiltros) {
          limpiarFiltros();
        } else if (showFilters) {
          setShowFilters(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hayFiltros, limpiarFiltros, showFilters, setShowFilters, modalOpen, showInlineFilters]);



  // ── Animaciones ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'warning') =>
    setToast({ message, type }), []);

  useEffect(() => {
    if (isCreationModalOpen) {
      setEditingId(null);
      setModalInitialData({ ...initialForm, analista: ANALISTAS[0] ?? '' });
      setModalOpen(true);
      setIsCreationModalOpen(false);
    }
  }, [isCreationModalOpen, setIsCreationModalOpen]);

  // Pre-computed search index: one lowercase string per record (built once when registros change)
  const searchIndex = useMemo(() => {
    return registros.map(r => {
      const cuilPlano = (r.cuil || '').replace(/[-.\s]/g, '');
      const tagsStr = (r.etiquetas || []).join('|');
      return (
        `${r.nombre}|${r.cuil}|${cuilPlano}|${r.analista}|${r.empleador || ''}|${r.estado}|${r.localidad || ''}|${r.dependencia || ''}|${r.comentarios}|${tagsStr}`
      ).toLowerCase();
    });
  }, [registros]);

  // Debounced search term to avoid re-filtering on every keystroke
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => setDebouncedSearch(filters.search), 200);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [filters.search]);

  const baseFilteredRegistros = useMemo(() => {
    const nowTime = new Date().getTime();
    const s = debouncedSearch.toLowerCase();
    const sPlano = s.replace(/[-.\s]/g, '');
    const hasSearch = s.length > 0;
    const hasEstados = filters.estados.length > 0;
    const hasAcuerdo = filters.acuerdoPrecios.length > 0;
    const montoMin = filters.montoMin ? Number(filters.montoMin) : 0;
    const montoMax = filters.montoMax ? Number(filters.montoMax) : 0;
    const scoreMin = filters.scoreMin ? Number(filters.scoreMin) : 0;
    const scoreMax = filters.scoreMax ? Number(filters.scoreMax) : 0;

    const list = registros.filter((r, idx) => {
      if (r.fijado) return false;
      if (hasSearch && !searchIndex[idx].includes(s) && !(sPlano && searchIndex[idx].includes(sPlano))) return false;
      if (hasEstados && !filters.estados.includes(r.estado)) return false;
      if (filters.analista && r.analista !== filters.analista) return false;
      if (filters.fechaDesde && (!r.fecha || r.fecha < filters.fechaDesde)) return false;
      if (filters.fechaHasta && (!r.fecha || r.fecha > filters.fechaHasta)) return false;
      if (filters.montoMin && Number(r.monto) < montoMin) return false;
      if (filters.montoMax && Number(r.monto) > montoMax) return false;
      if (filters.scoreMin && (r.puntaje == null || Number(r.puntaje) < scoreMin)) return false;
      if (filters.scoreMax && (r.puntaje == null || Number(r.puntaje) > scoreMax)) return false;
      if (filters.esRe && (filters.esRe === 'si' ? !r.es_re : r.es_re)) return false;
      if (hasAcuerdo && (!r.acuerdo_precios || !filters.acuerdoPrecios.includes(r.acuerdo_precios))) return false;

      if (filters.etiquetas && filters.etiquetas.length > 0) {
        const rTags = r.etiquetas || [];
        if (!filters.etiquetas.some(t => rTags.includes(t))) return false;
      }

      if (filters.soloRecontactosHoy) {
        if (!vencidoOIngresoHoyIds.has(r.id)) return false;
      }

      if (filters.soloAlertasVencidas) {
        const config = alertasConfig?.find(a => a.estado.toLowerCase() === r.estado?.toLowerCase());
        const diasLimite = config?.dias ?? 0;
        const dateStr = r.fecha || r.created_at;
        if (dateStr) {
          const daysDiff = Math.floor((nowTime - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
          if (daysDiff < diasLimite) return false;
        }
      }

      return true;
    });

    // Data is already sorted by fecha desc from the provider. Only re-sort if needed for
    // the secondary priority sort (ventas/aprobados first within same date).
    return list.sort((a, b) => {
      const dA = a.fecha || '', dB = b.fecha || '';
      if (dA !== dB) return dA > dB ? -1 : 1;
      const priA = a.estado === 'venta' || a.estado === 'derivado / aprobado cc';
      const priB = b.estado === 'venta' || b.estado === 'derivado / aprobado cc';
      return priA === priB ? 0 : priA ? -1 : 1;
    });
  }, [registros, searchIndex, debouncedSearch, filters.estados, filters.analista, filters.fechaDesde, filters.fechaHasta, filters.montoMin, filters.montoMax, filters.scoreMin, filters.scoreMax, filters.esRe, filters.soloAlertasVencidas, filters.acuerdoPrecios, alertasConfig]);

  // Modo revisión: solo cuando se entra desde "Clientes en revisión" (no al filtrar la tabla por estado)
  const isRevisionState = filters.revisionMode && filters.estados.length === 1 && (alertasConfig?.some(a => a.estado.toLowerCase() === filters.estados[0].toLowerCase()) ?? false);
  const activeConfig = isRevisionState ? (alertasConfig?.find(a => a.estado.toLowerCase() === filters.estados[0].toLowerCase()) ?? null) : null;

  // En vista de revisión solo se muestran los registros que superan el límite de días configurado
  const filteredRegistros = useMemo(() => {
    if (!activeConfig) return baseFilteredRegistros;
    const nowTime = new Date().getTime();
    return baseFilteredRegistros.filter(r => {
      const dateStr = r.fecha || r.created_at;
      if (!dateStr) return false;
      const daysDiff = Math.floor((nowTime - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
      return daysDiff >= activeConfig.dias;
    });
  }, [baseFilteredRegistros, activeConfig]);

  useEffect(() => { setTotalResults(filteredRegistros.length); }, [filteredRegistros.length, setTotalResults]);

  const totales = useMemo(() => {
    let suma = 0;
    filteredRegistros.forEach(r => suma += (Number(r.monto) || 0));
    return { cantidad: filteredRegistros.length, monto: suma };
  }, [filteredRegistros]);



  const totalPages = Math.ceil(filteredRegistros.length / pageSize) || 1;
  const paginatedRegistros = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRegistros.slice(start, start + pageSize);
  }, [filteredRegistros, currentPage, pageSize]);

  // Registros fijados: se muestran en su propia pestaña, sin importar filtros/paginación
  const registrosFijados = useMemo(() => {
    return registros
      .filter(r => r.fijado)
      .sort((a, b) => {
        const dA = a.fecha || '', dB = b.fecha || '';
        return dA === dB ? 0 : dA > dB ? -1 : 1;
      });
  }, [registros]);

  // Pestaña activa de la tabla (registros normales vs fijados)
  const [activeTab, setActiveTab] = useState<'registros' | 'fijados'>('registros');
  useEffect(() => {
    if (activeTab === 'fijados' && registrosFijados.length === 0) setActiveTab('registros');
  }, [activeTab, registrosFijados.length]);


  const openEdit = useCallback((reg: Registro) => {
    setEditingId(reg.id);
    setModalInitialData({ ...reg, fecha: reg.fecha || '', fecha_score: reg.fecha_score || '' });
    setModalOpen(true);
  }, []);

  const handleWhatsApp = useCallback((reg: Registro) => {
    setWhatsappTarget(reg);
  }, []);


  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    const reg = deleteTarget;
    setDeleteTarget(null);
    await supabase.from('registros').delete().eq('id', reg.id);
    logAudit({ id_registro: reg.id, nombre: reg.nombre, cuil: reg.cuil, analista: reg.analista, accion: 'Eliminación', campo_modificado: 'Registro', valor_anterior: `${reg.nombre} | ${reg.estado} | $${reg.monto}` });
    applyRegistroChange('DELETE', reg);
    pushRegistroChange('DELETE', reg);
    showToast('Registro eliminado', 'success');
    refresh(true);
  }, [deleteTarget, applyRegistroChange, pushRegistroChange, showToast, refresh]);

  const handleSaved = useCallback((reg: Registro) => {
    const isNew = !registros.find(r => r.id === reg.id);
    const type = isNew ? 'INSERT' : 'UPDATE';
    applyRegistroChange(type, reg);
    pushRegistroChange(type, reg);
    refresh(true);
  }, [applyRegistroChange, pushRegistroChange, refresh, registros]);

  const handleSavedWithRecordatorio = useCallback((reg: Registro) => {
    const isNew = !registros.find(r => r.id === reg.id);
    const type = isNew ? 'INSERT' : 'UPDATE';
    applyRegistroChange(type, reg);
    pushRegistroChange(type, reg);
    showToast('Guardado', 'success');
    refresh(true);
    setBitacoraTarget(reg);
  }, [applyRegistroChange, pushRegistroChange, refresh, registros, showToast]);

  const handleRecordatorioClose = useCallback((saved: boolean, newRec?: Recordatorio) => {
    setRecordatorioTarget(null);
    if (saved) {
      showToast('Recordatorio agendado', 'success');
      if (newRec) setRecordatorios(prev => [...prev, newRec]);
    }
  }, [showToast]);

  const handleComentariosClose = useCallback(async (saved: boolean, updatedComentarios?: string) => {
    if (saved && comentariosTarget && updatedComentarios !== undefined) {
      const { error } = await supabase
        .from('registros')
        .update({ comentarios: updatedComentarios })
        .eq('id', comentariosTarget.id);

      if (error) {
        showToast('Error al guardar comentarios', 'error');
      } else {
        showToast('Comentarios guardados', 'success');
        setComentariosTarget(null);
        applyRegistroChange('UPDATE', { ...comentariosTarget, comentarios: updatedComentarios });
        pushRegistroChange('UPDATE', { ...comentariosTarget, comentarios: updatedComentarios });
        refresh(true);
      }
    } else {
      setComentariosTarget(null);
    }
  }, [comentariosTarget, showToast, refresh, applyRegistroChange, pushRegistroChange]);

  const handleToggleFijado = useCallback(async (reg: Registro) => {
    const nuevo = !reg.fijado;
    const { error } = await supabase.from('registros').update({ fijado: nuevo }).eq('id', reg.id);
    if (error) { showToast('Error al fijar el registro', 'error'); return; }
    applyRegistroChange('UPDATE', { ...reg, fijado: nuevo });
    pushRegistroChange('UPDATE', { ...reg, fijado: nuevo });
    refresh(true);
    showToast(nuevo ? 'Registro fijado' : 'Registro desfijado', 'success');
  }, [applyRegistroChange, pushRegistroChange, refresh, showToast]);

  const handleSaveEtiquetas = useCallback(async (registroId: string, nuevasEtiquetas: string[]) => {
    const reg = registros.find(r => r.id === registroId);
    if (!reg) return;
    setEtiquetasTarget(null);
    const { error } = await supabase.from('registros').update({ etiquetas: nuevasEtiquetas }).eq('id', registroId);
    if (!error) {
      applyRegistroChange('UPDATE', { ...reg, etiquetas: nuevasEtiquetas });
      pushRegistroChange('UPDATE', { ...reg, etiquetas: nuevasEtiquetas });
      showToast('Etiquetas actualizadas', 'success');
      refresh(true);
    } else {
      showToast('Error al guardar etiquetas', 'error');
    }
  }, [registros, applyRegistroChange, pushRegistroChange, showToast, refresh]);

  // Render de una fila de la tabla. Se reutiliza en la tabla principal y en el panel de fijados.
  const renderFila = useCallback((reg: Registro) => {
    const isVencidoOIngresoHoy = vencidoOIngresoHoyIds.has(reg.id);
    const isProximo = proximoIds.has(reg.id);

    return (
      <tr
        key={reg.id}
        className="hover-row"
        style={{
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          borderLeft: isVencidoOIngresoHoy
            ? '4px solid #ef4444'
            : isProximo
            ? '4px solid #f59e0b'
            : '4px solid transparent',
          background: isVencidoOIngresoHoy
            ? 'rgba(239, 68, 68, 0.03)'
            : isProximo
            ? 'rgba(245, 158, 11, 0.02)'
            : 'transparent',
          transition: 'all 0.1s ease',
          cursor: 'default',
        }}
      >
        {/* Cliente */}
        <td style={{ padding: '18px 24px', minWidth: 260, textAlign: 'left' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '15.5px', fontWeight: 600, color: '#fff', letterSpacing: '-0.1px' }}>{reg.nombre}</span>
              {reg.cuil && (
                <>
                  <span style={{ fontSize: '13.5px', color: '#64748b', fontWeight: 400 }}>|</span>
                  <span className="cuil-text" style={{ fontSize: '13.5px', color: '#94a3b8', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{formatearCuil(reg.cuil)}</span>
                </>
              )}
              {reg.es_re && (
                <span style={{
                  fontSize: '9px', fontWeight: 800, padding: '1px 5px', borderRadius: '3px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: 'var(--green)', border: '1px solid rgba(16, 185, 129, 0.25)',
                  letterSpacing: '0.5px'
                }}>RE</span>
              )}
              {(reg.etiquetas || []).map(t => (
                <TagBadge key={t} tag={t} />
              ))}
            </div>

            {isVencidoOIngresoHoy && (
              <span style={{
                fontSize: '10px', fontWeight: 700, color: 'var(--rojo)',
                background: 'rgba(220,53,69,0.08)', padding: '2px 6px',
                borderRadius: '4px', border: '1px solid rgba(220,53,69,0.2)',
                display: 'inline-flex', alignItems: 'center', gap: '5px', width: 'fit-content',
                marginTop: '3px'
              }}>
                🔴 Re-contacto Hoy / Vencido
                <button
                  type="button"
                  onClick={async (e) => {
                    e.stopPropagation();
                    await supabase.from('recordatorios').update({ mostrado: true }).eq('registro_id', reg.id);
                    setRecordatorios(prev => prev.filter(r => r.registro_id !== reg.id));
                  }}
                  title="Marcar recordatorio como atendido / quitar vencido"
                  style={{
                    background: 'rgba(239, 68, 68, 0.2)', border: 'none', color: '#fca5a5',
                    cursor: 'pointer', padding: '1px 3px', fontSize: '9px', borderRadius: '3px',
                    display: 'inline-flex', alignItems: 'center', lineHeight: 1
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.5)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)')}
                >
                  <X size={10} />
                </button>
              </span>
            )}
            {isProximo && !isVencidoOIngresoHoy && (
              <span style={{
                fontSize: '10px', fontWeight: 700, color: '#fbbf24',
                background: 'rgba(251,191,36,0.08)', padding: '2px 6px',
                borderRadius: '4px', border: '1px solid rgba(251,191,36,0.2)',
                display: 'inline-flex', alignItems: 'center', gap: '5px', width: 'fit-content',
                marginTop: '3px'
              }}>
                🟡 Re-contacto Próximo
                <button
                  type="button"
                  onClick={async (e) => {
                    e.stopPropagation();
                    await supabase.from('recordatorios').update({ mostrado: true }).eq('registro_id', reg.id);
                    setRecordatorios(prev => prev.filter(r => r.registro_id !== reg.id));
                  }}
                  title="Marcar recordatorio como atendido / quitar"
                  style={{
                    background: 'rgba(251, 191, 36, 0.2)', border: 'none', color: '#fcd34d',
                    cursor: 'pointer', padding: '1px 3px', fontSize: '9px', borderRadius: '3px',
                    display: 'inline-flex', alignItems: 'center', lineHeight: 1
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(251, 191, 36, 0.5)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(251, 191, 36, 0.2)')}
                >
                  <X size={10} />
                </button>
              </span>
            )}
          </div>
        </td>

        {/* Analista */}
        <td style={{ padding: '18px 24px', fontSize: '15.5px', color: '#fff', fontWeight: 600, textAlign: 'center' }}>
          {displayAnalista(reg.analista)}
        </td>

        {/* Fecha */}
        <td style={{ padding: '18px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: '15.5px', color: '#ededed', fontWeight: 500 }}>{formatDate(reg.fecha)}</div>
        </td>

        {/* Score */}
        <td style={{ padding: '18px 24px', textAlign: 'center' }}>
          {reg.puntaje ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: Number(reg.puntaje) >= 700 ? 'var(--green)' :
                            Number(reg.puntaje) >= 600 ? '#60a5fa' :
                            Number(reg.puntaje) >= 500 ? '#fbbf24' : '#ef4444'
              }} />
              <span style={{ fontSize: '15.5px', fontWeight: 600, color: '#fff' }}>{reg.puntaje}</span>
            </div>
          ) : (
            <span style={{ color: '#46464e', fontSize: 15.5 }}>—</span>
          )}
        </td>

        {/* Monto */}
        <td style={{ padding: '18px 24px', fontSize: '15.5px', fontWeight: 600, color: reg.monto == null ? '#46464e' : '#fff', textAlign: 'center', whiteSpace: 'nowrap' }}>
          {reg.monto == null ? '—' : formatCurrency(Number(reg.monto))}
        </td>

        {/* Estado */}
        <td style={{ padding: '18px 24px', textAlign: 'center' }}>
          <StatusBadge estado={reg.estado} />
        </td>

        {/* Tipo / Acuerdo */}
        <td style={{ padding: '18px 24px', textAlign: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
            <span style={{ fontSize: '15.5px', fontWeight: 600, color: reg.tipo_cliente ? '#fff' : '#46464e' }}>{reg.tipo_cliente || '—'}</span>
            <span style={{
              fontSize: '12px',
              fontWeight: 700,
              color:
                reg.acuerdo_precios?.toUpperCase().includes('RIESGO BAJO') ? 'var(--green)' :
                  reg.acuerdo_precios?.toUpperCase().includes('RIESGO MEDIO') ? '#f87171' :
                    reg.acuerdo_precios?.toUpperCase().includes('PREMIUM') ? '#60a5fa' :
                      'var(--fg-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.4px'
            }}>
              {reg.acuerdo_precios || '—'}
            </span>
          </div>
        </td>

        {/* Acciones */}
        <td style={{ padding: '18px 24px' }}>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
            <button
              onClick={() => handleToggleFijado(reg)}
              className="table-action-btn"
              data-label={reg.fijado ? 'Desfijar' : 'Fijar arriba'}
              style={{ color: reg.fijado ? '#34d399' : 'var(--fg-muted)' }}
            ><Pin size={16} fill={reg.fijado ? 'currentColor' : 'none'} /></button>
            <button
              onClick={() => handleWhatsApp(reg)}
              className="table-action-btn"
              data-label={reg.telefono ? 'Abrir WhatsApp' : 'Agregar Teléfono'}
              style={{ color: reg.telefono ? '#25D366' : 'var(--fg-muted)' }}
            ><WhatsAppIcon size={16} /></button>
            {canSeeBitacora && (
              <button
                onClick={() => setBitacoraTarget(reg)}
                className={`table-action-btn ${isVencidoOIngresoHoy ? 'btn-alert-active' : ''}`}
                data-label="Recordatorio & Seguimiento"
                style={{ color: isVencidoOIngresoHoy ? '#ef4444' : '#60a5fa' }}
              ><Bell size={16} /></button>
            )}
            {canSeeComentarios && reg.comentarios && reg.comentarios.trim() !== '' && (
              <button
                onClick={() => setComentariosTarget(reg)}
                className="table-action-btn"
                data-label="Ver comentarios"
              ><MessageSquare size={16} /></button>
            )}
                          {canEditRegistros && (
                            <button
                              onClick={() => openEdit(reg)}
                              className="table-action-btn"
                              data-label="Editar"
                            ><Edit2 size={16} /></button>
                          )}
                          {canDeleteRegistros && (
                            <button
                              onClick={() => setDeleteTarget(reg)}
                              className="table-action-btn btn-delete"
                              data-label="Eliminar"
                            ><Trash2 size={16} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
    );
  }, [vencidoOIngresoHoyIds, proximoIds, canSeeComentarios, canSeeRecordatorios, canSeeBitacora, canEditRegistros, canDeleteRegistros, handleToggleFijado, handleWhatsApp, openEdit]);

  const rangeEnd = Math.min(currentPage * pageSize, filteredRegistros.length);

  // ── Render ──────────────────────────────────────────────────────────────────

  // Panel superior: modo "full" cuando hay un solo estado con config de alertas (muestra
  // vencidos/salud), modo "lite" para cualquier otro filtro (mismo diseño, solo Total y Monto).
  type PanelFull = { mode: 'full'; estado: string; diasLimite: number; total: number; montoTotal: number; vencidos: number; montoVencidos: number; salud: number };
  type PanelLite = { mode: 'lite'; total: number; montoTotal: number };
  let panelData: PanelFull | PanelLite | null = null;

  const singleConfig = filters.estados.length === 1
    ? (alertasConfig?.find(a => a.estado.toLowerCase() === filters.estados[0].toLowerCase()) ?? null)
    : null;

  if (singleConfig) {
    // Estadísticas sobre todos los registros que cumplen los filtros; en modo revisión la
    // tabla muestra solo los vencidos, pero el panel siempre cuenta el total del estado.
    const total = baseFilteredRegistros.length;
    let montoTotal = 0;
    let vencidos = 0;
    let montoVencidos = 0;
    const nowTime = new Date().getTime();

    baseFilteredRegistros.forEach(r => {
      montoTotal += Number(r.monto) || 0;
      const dateStr = r.fecha || r.created_at;
      if (dateStr) {
        const daysDiff = Math.floor((nowTime - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff >= singleConfig.dias) {
          vencidos++;
          montoVencidos += Number(r.monto) || 0;
        }
      }
    });

    const salud = total > 0 ? Math.round(((total - vencidos) / total) * 100) : 100;

    panelData = {
      mode: 'full',
      estado: filters.estados[0],
      diasLimite: singleConfig.dias,
      total,
      montoTotal,
      vencidos,
      montoVencidos,
      salud
    };
  } else if (hayFiltros) {
    panelData = { mode: 'lite', total: filteredRegistros.length, montoTotal: totales.monto };
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, width: '100%' }}>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: toast.type === 'success' ? 'rgba(16,185,129,0.15)' : toast.type === 'error' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
            border: `1px solid ${toast.type === 'success' ? 'rgba(16,185,129,0.3)' : toast.type === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`,
            color: toast.type === 'success' ? '#34d399' : toast.type === 'error' ? '#f87171' : '#fbbf24',
          }}>
            <AlertCircle size={15} />
            {toast.message}
          </div>
        </div>
      )}

      {/* Revision Panel */}
      {panelData && panelData.mode === 'full' && (() => {
        const hColor = panelData.salud === 100 ? '#10b981' : panelData.salud >= 80 ? '#fbbf24' : '#ef4444';
        const hBg = panelData.salud === 100 ? 'rgba(16,185,129,0.15)' : panelData.salud >= 80 ? 'rgba(251,191,36,0.15)' : 'rgba(239,68,68,0.15)';
        const r = 26;
        const circ = 2 * Math.PI * r;
        const offset = circ - (panelData.salud / 100) * circ;
        const isBad = panelData.vencidos > 0;

        return (
          <div style={{
            background: 'var(--bg-elev-1)',
            backgroundImage: `radial-gradient(ellipse at top left, ${hBg}, transparent 50%), radial-gradient(ellipse at bottom right, rgba(255,255,255,0.02), transparent 40%)`,
            border: '1px solid var(--border)',
            borderTop: `1px solid ${hColor}50`,
            borderRadius: '16px',
            padding: '20px 32px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '32px',
            boxShadow: `0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05), 0 0 20px ${hColor}15`,
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Health Ring */}
            <div style={{ position: 'relative', width: 68, height: 68, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="68" height="68" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="34" cy="34" r={r} fill="transparent" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
                <circle cx="34" cy="34" r={r} fill="transparent" stroke={hColor} strokeWidth="6" strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1.5s cubic-bezier(0.4, 0, 0.2, 1)' }} />
              </svg>
              <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '16px', fontWeight: 800, color: '#fff', lineHeight: 1 }}>{panelData.salud}%</span>
              </div>
            </div>

            {/* Info */}
            <div style={{ flex: 1, zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0, textTransform: 'uppercase', letterSpacing: '1px', background: 'linear-gradient(90deg, #fff, #a0a0a0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  {panelData.estado}
                </h2>
                <div style={{ background: isBad ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', border: `1px solid ${isBad ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}`, padding: '4px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: 800, color: isBad ? '#f87171' : '#34d399', letterSpacing: '0.5px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {isBad ? <AlertTriangle size={12} strokeWidth={3} /> : <CheckCircle2 size={12} strokeWidth={3} />}
                  {isBad ? 'Requiere Atención' : 'OK'}
                </div>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--fg-muted)', margin: 0, fontWeight: 500, letterSpacing: '0.2px', opacity: 0.8 }}>
                Límite de gestión: <strong style={{ color: '#fff' }}>{panelData.diasLimite} {panelData.diasLimite === 1 ? 'día' : 'días'}</strong>. Supervisión de tiempos en curso.
              </p>
            </div>

            {/* Metrics */}
            <div style={{ display: 'flex', gap: '16px', zIndex: 1, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'rgba(0,0,0,0.25)', padding: '12px 20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.03)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '10px', fontWeight: 800, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Registros</span>
                  <span style={{ fontSize: '24px', fontWeight: 800, color: '#fff', lineHeight: 1 }}>{panelData.total}</span>
                </div>
                <Hash size={24} strokeWidth={1.5} style={{ color: 'rgba(255,255,255,0.15)' }} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'rgba(0,0,0,0.25)', padding: '12px 20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.03)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '10px', fontWeight: 800, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Monto Total</span>
                  <span style={{ fontSize: '24px', fontWeight: 800, color: '#fff', lineHeight: 1 }}>{formatCurrency(panelData.montoTotal)}</span>
                </div>
                <DollarSign size={24} strokeWidth={1.5} style={{ color: 'rgba(255,255,255,0.15)' }} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: isBad ? 'rgba(239,68,68,0.08)' : 'rgba(0,0,0,0.25)', padding: '12px 20px', borderRadius: '12px', border: `1px solid ${isBad ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.03)'}`, boxShadow: isBad ? 'inset 0 0 20px rgba(239,68,68,0.05)' : 'none' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '10px', fontWeight: 800, color: isBad ? '#f87171' : '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Vencidos</span>
                  <span style={{ fontSize: '24px', fontWeight: 800, color: isBad ? '#f87171' : '#fff', lineHeight: 1 }}>{panelData.vencidos}</span>
                </div>
                <Timer size={24} strokeWidth={1.5} style={{ color: isBad ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.15)' }} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: isBad ? 'rgba(239,68,68,0.08)' : 'rgba(0,0,0,0.25)', padding: '12px 20px', borderRadius: '12px', border: `1px solid ${isBad ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.03)'}`, boxShadow: isBad ? 'inset 0 0 20px rgba(239,68,68,0.05)' : 'none' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '10px', fontWeight: 800, color: isBad ? '#f87171' : '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Monto Vencidos</span>
                  <span style={{ fontSize: '24px', fontWeight: 800, color: isBad ? '#f87171' : '#fff', lineHeight: 1 }}>{formatCurrency(panelData.montoVencidos)}</span>
                </div>
                <DollarSign size={24} strokeWidth={1.5} style={{ color: isBad ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.15)' }} />
              </div>

            </div>
          </div>
        );
      })()}

      {/* Filtered Panel (lite) — mismo diseño, sin vencidos/salud */}
      {panelData && panelData.mode === 'lite' && (
        <div style={{
          background: 'var(--bg-elev-1)',
          backgroundImage: 'radial-gradient(ellipse at top left, rgba(16,185,129,0.12), transparent 50%), radial-gradient(ellipse at bottom right, rgba(255,255,255,0.02), transparent 40%)',
          border: '1px solid var(--border)',
          borderTop: '1px solid #10b98150',
          borderRadius: '16px',
          padding: '20px 32px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '32px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05), 0 0 20px rgba(16,185,129,0.08)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Info */}
          <div style={{ flex: 1, zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0, textTransform: 'uppercase', letterSpacing: '1px', background: 'linear-gradient(90deg, #fff, #a0a0a0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Registros Filtrados
              </h2>
              <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', padding: '4px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: 800, color: '#34d399', letterSpacing: '0.5px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <SlidersHorizontal size={12} strokeWidth={3} />
                Filtro Activo
              </div>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--fg-muted)', margin: 0, fontWeight: 500, letterSpacing: '0.2px', opacity: 0.8 }}>
              Resultados según los filtros aplicados.
            </p>
          </div>

          {/* Metrics */}
          <div style={{ display: 'flex', gap: '16px', zIndex: 1, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'rgba(0,0,0,0.25)', padding: '12px 20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.03)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '10px', fontWeight: 800, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Registros</span>
                <span style={{ fontSize: '24px', fontWeight: 800, color: '#fff', lineHeight: 1 }}>{panelData.total}</span>
              </div>
              <Hash size={24} strokeWidth={1.5} style={{ color: 'rgba(255,255,255,0.15)' }} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'rgba(0,0,0,0.25)', padding: '12px 20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.03)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '10px', fontWeight: 800, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Monto Total</span>
                <span style={{ fontSize: '24px', fontWeight: 800, color: '#fff', lineHeight: 1 }}>{formatCurrency(panelData.montoTotal)}</span>
              </div>
              <DollarSign size={24} strokeWidth={1.5} style={{ color: 'rgba(255,255,255,0.15)' }} />
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{
        width: '100%',
        background: 'var(--bg-elev-1)',
        border: '1px solid var(--border)',
        borderRadius: '16px', overflow: 'hidden',
        boxShadow: '0 4px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)'
      }}>
        {/* Pestañas: Registros / Fijados (solo si hay alguno fijado) */}
        {registrosFijados.length > 0 && (
          <div style={{ display: 'flex', gap: 4, padding: '12px 16px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            {([['registros', 'Registros'], ['fijados', `Fijados (${registrosFijados.length})`]] as const).map(([key, label]) => {
              const active = activeTab === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '10px 18px', fontSize: 12, fontWeight: 800,
                    textTransform: 'uppercase', letterSpacing: '0.5px',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: active ? '#34d399' : 'var(--fg-muted)',
                    borderBottom: `2px solid ${active ? '#34d399' : 'transparent'}`,
                    marginBottom: -1,
                  }}
                >
                  {key === 'fijados' && <Pin size={13} fill={active ? 'currentColor' : 'none'} />}
                  {label}
                </button>
              );
            })}
          </div>
        )}
        {(activeTab === 'fijados' ? registrosFijados.length === 0 : filteredRegistros.length === 0) && !loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, gap: 12 }}>
            <span style={{ fontSize: 40, color: '#64748b' }}>—</span>
            <p style={{ fontSize: 16, color: 'var(--fg-muted)', fontWeight: 600 }}>No se encontraron registros coincidentes</p>
            {hayFiltros && (
              <button onClick={limpiarFiltros} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--fg-muted)', padding: '10px 20px', borderRadius: '10px', fontSize: '13px', cursor: 'pointer', marginTop: '12px' }}>
                <X size={14} style={{ verticalAlign: 'middle', marginRight: '8px' }} /> LIMPIAR FILTROS
              </button>
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto', display: 'flex', flexDirection: 'column' }}>
            {hayFiltros && isRevisionState && (
              <div style={{
                background: isRevisionState ? 'transparent' : hayFiltros ? 'linear-gradient(90deg, rgba(16, 185, 129, 0.04) 0%, rgba(16, 185, 129, 0) 100%)' : 'rgba(255, 255, 255, 0.01)',
                borderBottom: isRevisionState ? '1px solid rgba(255, 255, 255, 0.03)' : `1px solid ${hayFiltros ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.03)'}`,
                display: 'flex', flexDirection: 'column'
              }}>
                <div style={{ padding: '12px 24px', display: 'flex', gap: '32px', alignItems: 'center', minHeight: isRevisionState ? '56px' : 'auto' }}>
                  {isRevisionState ? null : hayFiltros ? (
                    <>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--fg-muted)', letterSpacing: '1px', textTransform: 'uppercase' }}>
                        Registros filtrados <span style={{ color: '#10b981', fontSize: '14px', fontWeight: 700, marginLeft: '8px' }}>{totales.cantidad}</span>
                      </span>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--fg-muted)', letterSpacing: '1px', textTransform: 'uppercase' }}>
                        Total acumulado <span style={{ color: '#10b981', fontSize: '14px', fontWeight: 700, marginLeft: '8px' }}>
                          {formatCurrency(totales.monto)}
                        </span>
                      </span>
                    </>
                  ) : (
                    <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--fg-muted)', letterSpacing: '1px', textTransform: 'uppercase' }}>
                      Todos los registros <span style={{ color: '#fff', fontSize: '14px', fontWeight: 700, marginLeft: '8px' }}>{totales.cantidad}</span>
                    </span>
                  )}
                  <div style={{ flex: 1 }} />
                  
                  {isRevisionState && (
                    <button
                      onClick={() => setShowInlineFilters(p => !p)}
                      style={{
                        background: showInlineFilters ? 'rgba(255,255,255,0.1)' : 'transparent', border: '1px solid rgba(255,255,255,0.08)', color: showInlineFilters ? '#fff' : 'var(--fg-muted)', fontSize: '10px', fontWeight: 800, borderRadius: '6px',
                        cursor: 'pointer', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase', transition: '0.2s'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
                      onMouseLeave={e => { if(!showInlineFilters){ e.currentTarget.style.color = 'var(--fg-muted)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; } }}
                    >
                      <SlidersHorizontal size={12} strokeWidth={3} /> {showInlineFilters ? 'Ocultar Filtros' : 'Filtros Avanzados'}
                    </button>
                  )}
                </div>
                
                {/* INLINE FILTERS EXPANDABLE AREA */}
                {isRevisionState && showInlineFilters && (
                  <div style={{
                    padding: '0 24px 20px 24px',
                    display: 'flex', gap: '24px', flexWrap: 'wrap',
                    animation: 'selectFade 0.2s ease-out'
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: '1 1 200px' }}>
                      <label style={{ fontSize: '9px', fontWeight: 800, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Búsqueda General</label>
                      <input placeholder="Nombre, CUIL..." value={filters.search} onChange={e => setFilter('search', e.target.value)} style={{ width: '100%', padding: '10px', fontSize: '12px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', outline: 'none' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: '1 1 200px' }}>
                      <label style={{ fontSize: '9px', fontWeight: 800, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Analista</label>
                      <PremiumSelect 
                        value={filters.analista} 
                        onChange={v => setFilter('analista', v)} 
                        options={ANALISTAS} 
                        placeholder="Todos los analistas" 
                        style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', minHeight: '36px' }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: '1 1 220px' }}>
                      <label style={{ fontSize: '9px', fontWeight: 800, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Etiquetas Lead</label>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {['Presupuestado'].map(t => {
                          const isSel = filters.etiquetas.includes(t);
                          return (
                            <button
                              key={t}
                              type="button"
                              onClick={() => toggleEtiqueta(t)}
                              style={{
                                padding: '4px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700,
                                background: isSel ? 'rgba(99,102,241,0.25)' : 'rgba(0,0,0,0.2)',
                                color: isSel ? '#818cf8' : '#94a3b8',
                                border: `1px solid ${isSel ? '#6366f1' : 'rgba(255,255,255,0.1)'}`,
                                cursor: 'pointer', transition: '0.2s'
                              }}
                            >
                              {t}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        onClick={() => setFilter('soloRecontactosHoy', !filters.soloRecontactosHoy)}
                        style={{
                          padding: '8px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 700,
                          background: filters.soloRecontactosHoy ? 'rgba(239,68,68,0.25)' : 'rgba(0,0,0,0.2)',
                          color: filters.soloRecontactosHoy ? '#f87171' : '#94a3b8',
                          border: `1px solid ${filters.soloRecontactosHoy ? '#ef4444' : 'rgba(255,255,255,0.1)'}`,
                          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: '0.2s'
                        }}
                      >
                        🔴 Re-contactos Hoy / Vencidos
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', flex: '1 1 200px' }}>
                       <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                         <label style={{ fontSize: '9px', fontWeight: 800, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Fecha Desde</label>
                         <input type="date" value={filters.fechaDesde} onChange={e => setFilter('fechaDesde', e.target.value)} style={{ width: '100%', padding: '10px', fontSize: '11px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', outline: 'none' }} />
                       </div>
                       <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                         <label style={{ fontSize: '9px', fontWeight: 800, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Fecha Hasta</label>
                         <input type="date" value={filters.fechaHasta} onChange={e => setFilter('fechaHasta', e.target.value)} style={{ width: '100%', padding: '10px', fontSize: '11px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', outline: 'none' }} />
                       </div>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', flex: '1 1 200px' }}>
                       <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                         <label style={{ fontSize: '9px', fontWeight: 800, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Score Mín</label>
                         <input type="number" value={filters.scoreMin} onChange={e => setFilter('scoreMin', e.target.value)} style={{ width: '100%', padding: '10px', fontSize: '11px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', outline: 'none' }} />
                       </div>
                       <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                         <label style={{ fontSize: '9px', fontWeight: 800, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Score Máx</label>
                         <input type="number" value={filters.scoreMax} onChange={e => setFilter('scoreMax', e.target.value)} style={{ width: '100%', padding: '10px', fontSize: '11px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', outline: 'none' }} />
                       </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.01)' }}>
                  {['Cliente | CUIL', 'Gestión', 'Fecha', 'Score', 'Monto', 'Calif.', 'Tipo / Acuerdo', 'Acciones'].map((h, i) => (
                    <th key={i} style={{
                      padding: '20px 24px',
                      fontSize: 12, fontWeight: 800,
                      color: '#fff',
                      textTransform: 'uppercase',
                      letterSpacing: '1.5px',
                      textAlign: (i === 0) ? 'left' : 'center',
                      whiteSpace: 'nowrap',
                      borderBottom: '1px solid var(--border)',
                      borderTopLeftRadius: i === 0 ? 16 : 0,
                      borderTopRightRadius: i === 7 ? 16 : 0,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(activeTab === 'fijados' ? registrosFijados : paginatedRegistros).map(renderFila)}
              </tbody>
            </table>

            {/* Paginación: Primera, Anterior, Página, Siguiente, Última */}
            {activeTab === 'registros' && filteredRegistros.length > pageSize && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 20px',
                borderTop: '1px solid rgba(255,255,255,0.04)',
                background: 'transparent',
              }}>
                {/* Info de registros */}
                <div style={{ fontSize: '13px', color: 'var(--fg-muted)', fontWeight: 600 }}>
                  Mostrando {rangeEnd} de {filteredRegistros.length} registros
                </div>

                {/* Botones de paginación */}
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="btn-pagination"
                  >
                    Primera
                  </button>

                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="btn-pagination"
                  >
                    ← Anterior
                  </button>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--fg-muted)', fontWeight: 600 }}>Página</span>
                    <input
                      type="number"
                      min="1"
                      max={totalPages}
                      value={currentPage}
                      onChange={e => {
                        const val = parseInt(e.target.value);
                        if (val >= 1 && val <= totalPages) {
                          setCurrentPage(val);
                        }
                      }}
                      className="pagination-input"
                    />
                    <span style={{ fontSize: '13px', color: 'var(--fg-muted)', fontWeight: 600 }}>de {totalPages}</span>
                  </div>

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="btn-pagination"
                  >
                    Siguiente →
                  </button>

                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="btn-pagination"
                  >
                    Última
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <RegistroModal
        isOpen={modalOpen} editingId={editingId} initialData={modalInitialData}
        isAdmin={isAdmin} onClose={() => setModalOpen(false)}
        onSaved={handleSaved} onSavedWithRecordatorio={handleSavedWithRecordatorio}
      />
      <ComentariosModal registro={comentariosTarget} onClose={handleComentariosClose} />
      <DeleteModal registro={deleteTarget} onConfirm={handleDeleteConfirm} onCancel={() => setDeleteTarget(null)} />
      <WhatsappModal 
        registro={whatsappTarget} 
        onConfirm={async (telefono, action) => {
          if (!whatsappTarget) return;
          const reg = whatsappTarget;
          setWhatsappTarget(null);
          
          const cleanNum = telefono ? telefono.replace(/\D/g, '') : '';
          const { error } = await supabase.from('registros').update({ telefono: cleanNum || null }).eq('id', reg.id);
          if (!error) {
            applyRegistroChange('UPDATE', { ...reg, telefono: cleanNum });
            pushRegistroChange('UPDATE', { ...reg, telefono: cleanNum });
            showToast('Teléfono guardado', 'success');
            
            if (action === 'send' && cleanNum) {
              // Si tiene 10 dígitos (ej: 3434538564), le agregamos el código de país y de celular de Argentina (549)
              const waNum = cleanNum.length === 10 ? `549${cleanNum}` : cleanNum;
              window.open(`https://web.whatsapp.com/send?phone=${waNum}`, '_blank');
            } else {
              refresh(true);
            }
          }
        }} 
        onCancel={() => setWhatsappTarget(null)} 
      />
      <BitacoraModal registro={bitacoraTarget} isOpen={!!bitacoraTarget} onClose={() => setBitacoraTarget(null)} onSavedEtiquetas={handleSaveEtiquetas} />
      <EtiquetasModal registro={etiquetasTarget} isOpen={!!etiquetasTarget} onClose={() => setEtiquetasTarget(null)} onSave={handleSaveEtiquetas} />
    </div>
  );
}
