'use client';

import React, { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { motion } from 'framer-motion';
import { formatCurrency, formatDate, capitalizarNombre, capitalizarTexto, sanitizarCuil, formatearCuil, displayAnalista, STATUS_LABEL, parsePastedNumber } from '@/lib/utils';
import { Registro, Recordatorio } from '@/types';
import { Edit2, Trash2, X, Save, AlertCircle, AlertTriangle, Bell, FileText, DollarSign, Hash, SlidersHorizontal, MessageSquare, Search, ChevronDown, CheckCircle2, Plus, Minus, Timer, Pin, User, ArrowUpDown, List, Grid2X2, Rows3, MoreHorizontal } from 'lucide-react';
import CustomSelect from '@/components/CustomSelect';
import { useAuth } from '@/context/AuthContext';
import { useRegistros } from '@/features/registros/RegistrosProvider';
import { useSettings } from '@/features/settings/SettingsProvider';
import { useFilter, ESTADOS } from '@/context/FilterContext';
import { useAnalistas } from '@/features/settings/SettingsProvider';
import { logAudit } from '@/lib/audit';
import { corregirTildes } from '@/lib/correccion-tildes';
import { ACUERDOS, acuerdoSugeridoPorScore, validarAcuerdoVsScore } from '@/lib/acuerdo-precios';
import { requiereChequeoDuplicado } from '@/lib/duplicados';
import ModalPortal from '@/components/ModalPortal';
import BitacoraModal from '@/components/BitacoraModal';
import { TagBadge } from '@/components/EtiquetasSelector';
import { getLocalidadesByCP, getCPByLocalidad, addCustomMapping } from '@/lib/codigos-postales';
import { useSearchParams } from 'next/navigation';
import { PremiumSelect } from '@/components/PremiumSelect';
import { CorporateDateRangePicker } from '@/components/CorporateDateRangePicker';
import styles from './RegistrosPage.module.css';

// ── Constants ─────────────────────────────────────────────────────────────────

const WhatsAppIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.031 0C5.385 0 0 5.383 0 12.029c0 2.124.553 4.195 1.603 6.012L.117 23.518l5.626-1.476a11.97 11.97 0 0 0 6.288 1.765h.005c6.645 0 12.033-5.383 12.033-12.029C24.068 5.383 18.681 0 12.031 0zm0 21.802h-.004a9.982 9.982 0 0 1-5.088-1.385l-.365-.216-3.784.992.996-3.69-.237-.377a9.969 9.969 0 0 1-1.523-5.31c0-5.508 4.484-9.99 9.992-9.99 5.511 0 9.995 4.482 9.995 9.99s-4.484 9.99-9.992 9.99zm5.48-7.502c-.3-.15-1.776-.877-2.052-.978-.276-.1-.477-.15-.678.15-.201.3-.777.978-.952 1.178-.175.2-.35.226-.65.076-1.401-.703-2.529-1.36-3.486-2.923-.175-.302.176-.277.752-1.428.1-.2.05-.376-.025-.526-.075-.15-.678-1.633-.928-2.235-.244-.591-.492-.511-.678-.521-.175-.01-.376-.01-.577-.01-.2 0-.526.075-.802.376-.276.3-1.053 1.028-1.053 2.508 0 1.48 1.078 2.912 1.228 3.113.15.201 2.124 3.245 5.143 4.549 2.058.887 2.802.952 3.805.803 1.002-.15 3.211-1.312 3.662-2.583.451-1.272.451-2.361.316-2.583-.135-.226-.511-.35-.812-.501z"/>
  </svg>
);

const ESTADOS_PERMITIDOS_DUPLICADO = ['venta', 'derivado / aprobado cc'];

const initialForm: Partial<Registro> = {
  cuil: '', nombre: '', puntaje: 0, es_re: false,
  analista: '', fecha: '', fecha_score: '', monto: undefined, interes: undefined,
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

/**
 * Abre el chat de WhatsApp del número. Si tiene 10 dígitos (ej. 3434538564) se
 * le antepone el código de país y de celular de Argentina (549).
 * Estaba repetido en las tres ramas que ofrecen "guardar y enviar".
 */
function abrirWhatsApp(telefono: string) {
  const waNum = telefono.length === 10 ? `549${telefono}` : telefono;
  window.open(`https://web.whatsapp.com/send?phone=${waNum}`, '_blank');
}

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
  const errs: Record<string, string> = {};

  // Autorización especial de CC: la operación se autorizó por fuera de las
  // condiciones habituales, así que no se valida nada y se puede guardar igual.
  if (form.autorizacion_cc) return errs;

  // Regla de Score bajo: sólo permitido para scores de 0 a 549.
  // No debe permitir guardar si el score está en 550 a 600 (Riesgo MEDIO), 601 a 700 (Riesgo BAJO), o +700 (PREMIUM)
  if ((form.estado || '').trim().toLowerCase() === 'score bajo') {
    if (form.puntaje !== undefined && form.puntaje !== null && String(form.puntaje).trim() !== '') {
      const score = Number(form.puntaje);
      if (score >= 550) {
        errs.estado = 'No coincide estado con Score';
      }
    }
  }

  // Validación de Score vs Acuerdo de precios. Con autorización especial de CC
  // el aviso no bloquea: el combo del formulario lo muestra igual.
  if (form.puntaje !== undefined && form.puntaje !== null && String(form.puntaje).trim() !== '') {
    const aviso = validarAcuerdoVsScore(Number(form.puntaje), form.acuerdo_precios ?? '', form.autorizacion_cc ?? false);
    if (aviso?.bloquea) errs.acuerdo_precios = aviso.mensaje;
  }

  if (isAdmin) return errs;
  if (!form.nombre?.trim()) errs.nombre = 'Requerido';
  else if (form.nombre.trim().length < 2) errs.nombre = 'Mín. 2 caracteres';
  else if (!REGEX_NOMBRE.test(form.nombre.trim())) errs.nombre = 'Solo letras';

  if (!form.cuil?.trim()) errs.cuil = 'Requerido';
  else if (form.cuil.length !== 11) errs.cuil = '11 dígitos';

  if (!form.analista?.trim()) errs.analista = 'Requerido';
  if (!form.estado) errs.estado = 'Requerido';
  const requiereTipoYAcuerdo = form.estado === 'venta' || form.estado === 'derivado / aprobado cc';
  if (requiereTipoYAcuerdo) {
    if (!form.tipo_cliente) errs.tipo_cliente = 'Requerido';
    if (!form.acuerdo_precios) errs.acuerdo_precios = 'Requerido';
    if (!form.cuotas?.trim()) errs.cuotas = 'Requerido';
    if (!form.rango_etario) errs.rango_etario = 'Requerido';
    if (!form.sexo) errs.sexo = 'Requerido';
    if (!form.empleador?.trim()) errs.empleador = 'Requerido';
    if (!form.localidad?.trim()) errs.localidad = 'Requerido';
    if (form.monto === undefined || form.monto === null || String(form.monto).trim() === '') {
      errs.monto = 'Requerido';
    } else if (isNaN(Number(form.monto)) || Number(form.monto) <= 0) {
      errs.monto = 'Debe ser mayor a 0';
    }
  }
  
  if (requiereDependencia(form.empleador) && !form.dependencia?.trim()) {
    errs.dependencia = 'Requerido';
  }

  if (form.estado === 'derivado / rechazado cc' && !form.comentarios?.trim())
    errs.comentarios = 'Requerido — ingresá el motivo de rechazo';

  const requiereInteres = form.estado === 'venta' || form.estado === 'derivado / aprobado cc';
  if (requiereInteres) {
    if (form.interes === undefined || form.interes === null || String(form.interes).trim() === '') {
      errs.interes = 'Requerido';
    } else if (isNaN(Number(form.interes))) {
      errs.interes = 'Inválido';
    } else if (Number(form.interes) <= 0) {
      errs.interes = 'Debe ser mayor a 0';
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

const Field = memo(function Field({ label, error, aviso, children, transparentLabel }: { label: string; error?: string; aviso?: string; children: React.ReactNode; transparentLabel?: boolean }) {
  const isRequired = label.includes('*');
  const cleanLabel = label.replace('*', '').trim();

  return (
    <div className="form-group">
      <label className={`form-label ${transparentLabel ? styles.fieldLabelTransparent : ''}`}>
        {cleanLabel || '—'}
        {isRequired && <span className={`form-label__required ${styles.fieldRequired}`}>*</span>}
        {error && <span className={`form-label__error ${styles.fieldError}`}>— {error}</span>}
        {!error && aviso && <span className={styles.fieldAviso}>— {aviso}</span>}
      </label>
      {children}
    </div>
  );
});

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
      <div className={`modal-overlay ${styles.phoneOverlay}`} onClick={onCancel}>
        <motion.div className={`modal-content ${styles.phoneModal}`} onClick={e => e.stopPropagation()}>
          <div className={styles.phoneHeader}>
            <div className={styles.phoneHeaderCopy}>
              <span className={styles.phoneIcon} aria-hidden="true">
                <WhatsAppIcon size={20} />
              </span>
              <div>
                <h3 className={styles.phoneTitle}>WhatsApp y teléfono</h3>
                <p className={styles.phoneSubtitle}>Guardá el número o iniciá una conversación.</p>
              </div>
            </div>
            <button type="button" className={styles.phoneClose} onClick={onCancel} aria-label="Cerrar modal">
              <X size={19} />
            </button>
          </div>
          <div className={styles.phoneBody}>
            {registro.nombre ? (
              <div className={styles.phoneContact}>
                <span className={styles.phoneContactLabel}>Cliente</span>
                <strong>{registro.nombre}</strong>
              </div>
            ) : null}
            <label className={styles.phoneLabel} htmlFor="whatsapp-phone">Número de teléfono</label>
            <input
              id="whatsapp-phone"
              autoFocus
              type="tel"
              inputMode="numeric"
              value={telefono}
              onChange={e => { setTelefono(e.target.value.replace(/\D/g, '').slice(0, 10)); setErrorVisible(false); }}
              placeholder="Ej: 3434538564"
              className={`form-input ${styles.phoneInput} ${errorVisible ? styles.phoneInputError : ''}`}
              aria-invalid={errorVisible}
              aria-describedby={errorVisible ? 'whatsapp-phone-error' : 'whatsapp-phone-hint'}
            />
            {errorVisible ? (
              <motion.div
                id="whatsapp-phone-error"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className={styles.phoneError}
              >
                El teléfono es obligatorio.
              </motion.div>
            ) : (
              <p id="whatsapp-phone-hint" className={styles.phoneHint}>Ingresá 10 dígitos, sin 0 ni 15.</p>
            )}
          </div>
          <div className={styles.phoneFooter}>
            <button type="button" className={styles.phoneCancel} onClick={onCancel}>Cancelar</button>
            <button type="button" className={styles.phoneSave} onClick={() => handleConfirm('save')}>
              Guardar
            </button>
            <button type="button" className={styles.phoneSend} onClick={() => handleConfirm('send')}>
              <WhatsAppIcon size={17} />
              Enviar por WhatsApp
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
  const [modalZoom, setModalZoom] = useState(1);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const savedZoom = window.localStorage.getItem('crm_modal_edit_zoom_level_v1');
      const parsedZoom = savedZoom ? Number.parseFloat(savedZoom) : 1;
      if (Number.isFinite(parsedZoom)) setModalZoom(Math.min(1.3, Math.max(0.7, parsedZoom)));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const updateModalZoom = useCallback((nextZoom: number) => {
    const normalizedZoom = Math.min(1.3, Math.max(0.7, Math.round(nextZoom * 100) / 100));
    setModalZoom(normalizedZoom);
    window.localStorage.setItem('crm_modal_edit_zoom_level_v1', String(normalizedZoom));
  }, []);
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
      const isMismatch = (initialData.estado || '').trim().toLowerCase() === 'score bajo' &&
        initialData.puntaje !== undefined && initialData.puntaje !== null &&
        Number(initialData.puntaje) >= 550;
      setErrors(isMismatch ? { estado: 'No coincide estado con Score' } : {});
      setShowPhoneModal(false);
      setShowDupModal(false);
      setDupRecord(null);
      setDupBlocked(false);
      setAgendarRecordatorio(false);
    }
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
    let estadoMismatch = false;

    setForm(prev => {
      const next = { ...prev, [field]: value };

      // Auto-actualizar acuerdo_precios según el score. Con autorización
      // especial de CC el acuerdo lo elige la persona y no se pisa.
      if (field === 'puntaje' && value !== undefined && value !== '' && !next.autorizacion_cc) {
        const score = Number(value);
        next.acuerdo_precios = acuerdoSugeridoPorScore(score) || undefined;

        // Si el estado actual es 'score bajo' y el nuevo puntaje es >= 550,
        // no corresponde dejarlo como 'score bajo' porque el estado cambia.
        // Se resetea el estado para solicitar que el usuario elija el estado correspondiente.
        if (score >= 550 && (next.estado || '').trim().toLowerCase() === 'score bajo') {
          next.estado = '';
          estadoMismatch = true;
        }
      }

      if (field === 'estado') {
        const est = String(value || '').trim().toLowerCase();
        const score = Number(next.puntaje);
        if (est === 'score bajo' && !isNaN(score) && score >= 550) {
          estadoMismatch = true;
        }
      }

      // Ya no limpiamos el empleador automáticamente al cambiar de estado
      return next;
    });

    if (errors[field]) setErrors(prev => { const e = { ...prev }; delete e[field]; return e; });
    if (field === 'puntaje' && errors.acuerdo_precios) {
      setErrors(prev => { const e = { ...prev }; delete e.acuerdo_precios; return e; });
    }

    if (estadoMismatch) {
      setErrors(prev => ({ ...prev, estado: 'No coincide estado con Score' }));
    } else if ((field === 'puntaje' || field === 'estado') && errors.estado) {
      setErrors(prev => { const e = { ...prev }; delete e.estado; return e; });
    }
  };

  const handleNumberPaste = (field: keyof Registro) => (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text');
    const parsed = parsePastedNumber(text);
    if (parsed !== null) {
      e.preventDefault();
      set(field, parsed);
    }
  };

  // Venta / Aprobado CC exigen los campos demográficos completos e Interés
  const esVentaOAprobado = form.estado === 'venta' || form.estado === 'derivado / aprobado cc';

  // Aviso no bloqueante del acuerdo vs score (el bloqueante va por `errors`).
  const avisoAcuerdo = useMemo(() => {
    if (form.puntaje === undefined || form.puntaje === null || String(form.puntaje).trim() === '') return undefined;
    const aviso = validarAcuerdoVsScore(Number(form.puntaje), form.acuerdo_precios ?? '', form.autorizacion_cc ?? false);
    return aviso && !aviso.bloquea ? aviso.mensaje : undefined;
  }, [form.puntaje, form.acuerdo_precios, form.autorizacion_cc]);
  const requiereInteres = form.estado === 'venta' || form.estado === 'derivado / aprobado cc';
  // Venta / Aprobado CC / Proyección exigen Teléfono
  const requiereTelefono = form.estado === 'venta' || form.estado === 'derivado / aprobado cc' || form.estado === 'proyeccion';

  const guardar = async (bypassDupCheck = false) => {
    const errs = validarForm(form, isAdmin);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    if (!bypassDupCheck && requiereChequeoDuplicado(editingId, form, initialData)) {
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
      monto: form.monto === undefined || form.monto === null || (form.monto as unknown as string) === '' ? null : Number(form.monto),
      interes: form.interes === undefined || form.interes === null || (form.interes as unknown as string) === '' ? null : Number(form.interes),
      puntaje: form.puntaje === undefined || form.puntaje === null || (form.puntaje as unknown as string) === '' ? 0 : Number(form.puntaje),
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

      if (action === 'send' && cleanTel) abrirWhatsApp(cleanTel);
    } else {
      const { data: newReg, error } = await supabase.from('registros').insert(payload).select().single();
      if (error) { setErrors({ _: error.message }); setSaving(false); return; }
      logAudit({ id_registro: (newReg as Registro).id, nombre: String(payload.nombre ?? ''), cuil: String(payload.cuil ?? ''), analista: String(payload.analista ?? ''), accion: 'Creación', campo_modificado: 'Nuevo registro', valor_nuevo: `${payload.nombre} | ${payload.estado} | $${payload.monto}` });
      onClose();
      if (agendarRecordatorio && onSavedWithRecordatorio && newReg) onSavedWithRecordatorio(newReg as Registro);
      else onSaved(newReg as Registro);

      if (action === 'send' && cleanTel) abrirWhatsApp(cleanTel);
    }
    setSaving(false);
  };

  if (!isOpen) return null;

  return (
    <>
      <ModalPortal>
      <div className={`modal-overlay ${styles.editOverlay}`} onClick={onClose}>
        <motion.div
          className={`modal-content ${styles.editModal}`}
          style={{ '--modal-scale': modalZoom } as React.CSSProperties}
          onClick={e => e.stopPropagation()}
        >
          <div className={`modal-header ${styles.canonicalModalHeader}`}>
            <div>
              <h3 className={styles.editTitle}>
                {editingId ? <Edit2 className={styles.editTitleIcon} size={16} strokeWidth={2.5} /> : <Plus className={styles.editTitleIcon} size={16} strokeWidth={2.5} />}
                {editingId ? 'Editar' : 'Nuevo'} registro
              </h3>
              <p className={styles.editSubtitle}>
                {editingId ? 'Modificá los datos del registro seleccionado' : 'Completá los campos para crear un nuevo registro'}
              </p>
            </div>
            <div className={styles.modalHeaderActions}>
              <div className={styles.modalZoomControls} aria-label="Tamaño del modal">
                <button
                  type="button"
                  className={styles.modalZoomButton}
                  onClick={() => updateModalZoom(modalZoom - 0.05)}
                  disabled={modalZoom <= 0.7}
                  aria-label="Achicar modal"
                  title="Achicar modal"
                >
                  <Minus size={14} strokeWidth={2.5} />
                </button>
                <button
                  type="button"
                  className={`${styles.modalZoomValue} ${modalZoom !== 1 ? styles.modalZoomValueChanged : ''}`}
                  onClick={() => updateModalZoom(1)}
                  aria-label="Restablecer tamaño del modal al 100%"
                  title="Restablecer al 100%"
                >
                  {Math.round(modalZoom * 100)}%
                </button>
                <button
                  type="button"
                  className={styles.modalZoomButton}
                  onClick={() => updateModalZoom(modalZoom + 0.05)}
                  disabled={modalZoom >= 1.3}
                  aria-label="Agrandar modal"
                  title="Agrandar modal"
                >
                  <Plus size={14} strokeWidth={2.5} />
                </button>
              </div>
              <button type="button" aria-label="Cerrar" className={`btn-icon ${styles.canonicalModalClose}`} onClick={onClose}><X size={18} /></button>
            </div>
          </div>
          <div className={`modal-body ${styles.editBody}`}>
            <div className={styles.editGrid}>
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
              <Field label="Estado *" error={errors.estado}>
                <PremiumSelect
                  value={form.estado ?? ''}
                  onChange={val => set('estado', val)}
                  options={ESTADOS}
                  placeholder="Seleccionar estado..."
                  error={errors.estado}
                  maxHeight="none"
                />
              </Field>
              <Field label={`Monto${(esVentaOAprobado && !isAdmin) ? ' *' : ''}`} error={errors.monto}>
                <input
                  className="form-input"
                  type="number"
                  step="any"
                  value={form.monto ?? ''}
                  onChange={e => set('monto', e.target.value === '' ? '' : Number(e.target.value))}
                  onPaste={handleNumberPaste('monto')}
                  placeholder="$"
                />
              </Field>
              <Field label={`Interés${(requiereInteres && !isAdmin) ? ' *' : ''}`} error={errors.interes}>
                <input
                  className="form-input"
                  type="number"
                  step="any"
                  value={form.interes ?? ''}
                  onChange={e => set('interes', e.target.value === '' ? '' : Number(e.target.value))}
                  onPaste={handleNumberPaste('interes')}
                  placeholder="$"
                />
              </Field>
              <Field label="Fecha" error={errors.fecha}>
                <input className="form-input" type="date" value={form.fecha || ''} onChange={e => set('fecha', e.target.value)} max={new Date().toISOString().split('T')[0]} />
              </Field>
              <Field label="Fecha Score">
                <input className="form-input" type="date" value={form.fecha_score || ''} onChange={e => set('fecha_score', e.target.value)} />
              </Field>
              <Field label="Score">
                <input
                  className="form-input"
                  type="number"
                  step="any"
                  value={form.puntaje ?? ''}
                  onChange={e => set('puntaje', e.target.value === '' ? '' : Number(e.target.value))}
                  onPaste={handleNumberPaste('puntaje')}
                  placeholder="0"
                />
              </Field>
              <Field label={`Tipo de cliente${esVentaOAprobado ? ' *' : ''}`} error={errors.tipo_cliente}>
                <PremiumSelect
                  value={form.tipo_cliente || ''}
                  onChange={val => set('tipo_cliente', val)}
                  options={['Apertura', 'Renovacion']}
                  placeholder="— Sin especificar —"
                />
              </Field>
              <Field label={`Acuerdo de precios${esVentaOAprobado ? ' *' : ''}`} error={errors.acuerdo_precios} aviso={avisoAcuerdo}>
                <PremiumSelect
                  value={form.acuerdo_precios || ''}
                  onChange={val => set('acuerdo_precios', val)}
                  options={[...ACUERDOS]}
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
                  <div className={styles.fieldInline}>
                    <input
                      className={`form-input ${styles.fieldGrow}`}
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
                      className={`btn-icon ${styles.fieldIconButton}`}
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
                      <div className={styles.locationResult}>
                        📍 {matches[0]}
                      </div>
                    );
                  }
                  if (matches.length > 1) {
                    return (
                      <div className={styles.locationSelect}>
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
                    <div className={styles.locationMissing}>
                      <div className={styles.locationWarning}>Sin coincidencia</div>
                      {isAdmin && !cpAddOpen && (
                        <button type="button" className={`btn-secondary ${styles.locationAddButton}`}
                          onClick={() => { setCpAddOpen(true); setCpAddLoc(''); }}>
                          + Agregar localidad
                        </button>
                      )}
                      {isAdmin && cpAddOpen && (
                        <div className={styles.locationAddRow}>
                          <input value={cpAddLoc}
                            onChange={e => setCpAddLoc(corregirTildes(capitalizarTexto(e.target.value)))}
                            placeholder="Nombre" className={`form-input ${styles.locationAddInput}`} autoFocus />
                          <button type="button" className={`btn-primary ${styles.locationSaveButton}`}
                            disabled={!cpAddLoc.trim()}
                            onClick={() => {
                              const name = cpAddLoc.trim();
                              if (!name) return;
                              addCustomMapping(cp, name);
                              set('localidad', name);
                              setCpAddOpen(false); setCpAddLoc('');
                              setCpMapVersion(v => v + 1);
                            }}>Guardar</button>
                          <button type="button" className={`btn-icon ${styles.locationCancelButton}`}
                            onClick={() => { setCpAddOpen(false); setCpAddLoc(''); }}
                          >
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
                    <div className={styles.fieldInline}>
                      <input
                        value={form.dependencia || ''}
                        onChange={e => set('dependencia', e.target.value)}
                        placeholder="Nombre de la dependencia"
                        className={`form-input ${styles.fieldGrow}`}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => { setDependenciaCustom(false); set('dependencia', ''); }}
                        className={`btn-icon ${styles.fieldIconButton}`}
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
            <div className={styles.editSupplementalGrid}>
              <Field label={`Comentarios${form.estado === 'derivado / rechazado cc' ? ' *' : ''}`} error={errors.comentarios}>
                <textarea
                  value={form.comentarios || ''}
                  onChange={e => set('comentarios', corregirTildes(e.target.value))}
                  rows={1}
                  className={`form-input ${styles.editComments}`}
                  placeholder={form.estado === 'derivado / rechazado cc' ? 'Motivo de rechazo (obligatorio)...' : ''}
                />
              </Field>
              <Field label="Resumen ejecutivo">
                <label 
                  className={`modal-check-action ${styles.editCheckAction} ${form.es_re ? styles.editCheckSuccess : ''}`}
                >
                  <input type="checkbox" checked={!!form.es_re} onChange={e => set('es_re', e.target.checked)} className={styles.visuallyHidden} />
                  {form.es_re ? <CheckCircle2 size={15} strokeWidth={2.5} /> : <FileText size={15} />}
                  <span>Resumen Ejecutivo (RE)</span>
                </label>
              </Field>
              <Field label="Recordatorio">
                <label 
                  className={`modal-check-action ${styles.editCheckAction} ${agendarRecordatorio ? styles.editCheckWarning : ''}`}
                >
                  <input type="checkbox" checked={agendarRecordatorio} onChange={e => setAgendarRecordatorio(e.target.checked)} className={styles.visuallyHidden} />
                  {agendarRecordatorio ? <CheckCircle2 size={15} strokeWidth={2.5} /> : <Bell size={15} />}
                  <span>Agendar Recordatorio</span>
                </label>
              </Field>
            </div>
            <p className={`modal-required-legend ${styles.requiredLegend}`}>
              <span className={styles.requiredMark}>*</span> CAMPOS OBLIGATORIOS
            </p>
          </div>
          <div className={`modal-footer ${styles.editFooter}`}>
            {errors._ && <span className={styles.editFooterError}><AlertTriangle size={13} />{errors._}</span>}
            {!errors._ && (
              <div className={styles.editFooterInfo}>
                Registro creado con fecha {initialData.created_at ? new Date(initialData.created_at).toLocaleDateString('es-AR') : new Date().toLocaleDateString('es-AR')} y hora {initialData.created_at ? new Date(initialData.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
            <button
              type="button"
              className={`btn-secondary modal-btn-cancel ${styles.editCancel} ${styles.autorizacionCC}${form.autorizacion_cc ? ` ${styles.autorizacionCCOn}` : ''}`}
              onClick={() => set('autorizacion_cc', !form.autorizacion_cc)}
              aria-pressed={!!form.autorizacion_cc}
              title="Permite guardar aunque el registro no cumpla las condiciones"
            >
              {form.autorizacion_cc
                ? <CheckCircle2 size={13} strokeWidth={2.5} />
                : <AlertTriangle size={13} strokeWidth={2.5} />}
              AUTORIZACIÓN ESPECIAL
            </button>
            <button className={`btn-secondary modal-btn-cancel ${styles.editCancel}`} onClick={onClose}>CANCELAR</button>
            <button className={`btn-primary modal-btn-save ${styles.editSave}`} onClick={() => guardar()} disabled={saving}>
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
        <div className={`modal-overlay ${styles.duplicateOverlay}`} onClick={() => { if (!dupBlocked) setShowDupModal(false); }}>
          <motion.div drag dragMomentum={false} className={`modal-content ${styles.duplicateModal}`} onClick={e => e.stopPropagation()}>
        <div className={styles.compactModalHeader}>
            <div>
              <h3 className={`${styles.compactModalTitle} ${dupBlocked ? styles.duplicateTitleBlocked : styles.duplicateTitleWarning}`}>
                <AlertCircle size={16} strokeWidth={2.5} />
                {dupBlocked ? 'Registro duplicado' : 'Registro existente'}
              </h3>
              <p className={`${styles.compactModalSubtitle} ${dupBlocked ? styles.duplicateSubtitleBlocked : ''}`}>
                {dupBlocked ? 'Ya existe un registro activo para este cliente' : 'Ya existe un registro con este CUIL o nombre'}
              </p>
            </div>
            {!dupBlocked && <button type="button" aria-label="Cerrar" className={`btn-icon ${styles.compactModalClose}`} onClick={() => setShowDupModal(false)}><X size={18} /></button>}
          </div>
            <div className={`modal-body ${styles.duplicateBody}`}>
              <div className={styles.duplicateMessage}>
                <AlertCircle size={20} className={dupBlocked ? styles.duplicateTitleBlocked : styles.duplicateTitleWarning} />
                <div>
                  <p className={styles.duplicateName}>{dupRecord.nombre}</p>
                  <p className={styles.duplicateMeta}>
                    CUIL: {dupRecord.cuil} &nbsp;·&nbsp; Estado: <strong className={styles.compactModalStrong}>{STATUS_LABEL[dupRecord.estado] ?? dupRecord.estado}</strong>
                  </p>
                  {dupBlocked
                    ? <p className={styles.duplicateDescription}>Este cliente ya tiene un registro activo en ese estado. No se puede crear un duplicado. Modificá el registro existente para continuar.</p>
                    : <p className={styles.duplicateDescription}>Ya existe un registro con este CUIL o nombre. ¿Deseás guardar de todas formas?</p>
                  }
                </div>
              </div>
            </div>
            <div className={`modal-footer ${styles.duplicateFooter}`}>
              {dupBlocked
                ? <button className={`btn-primary ${styles.duplicatePrimary}`} onClick={() => setShowDupModal(false)}>Entendido</button>
                : <>
                  <button className={`btn-secondary ${styles.duplicateCancel}`} onClick={() => setShowDupModal(false)}>Cancelar</button>
                  <button className={`btn-primary ${styles.duplicatePrimary} ${styles.duplicatePrimaryStrong}`} onClick={() => { setShowDupModal(false); guardar(true); }}>Guardar de todas formas</button>
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

// ── Modal: Comentarios ───────────────────────────────────────────────────────

const ComentariosModal = memo(function ComentariosModal({
  registro, onClose,
}: {
  registro: Registro | null;
  /** Devuelve `true` si la operación terminó bien. En `false` el modal sigue abierto y se rehabilita. */
  onClose: (saved: boolean, updatedComentarios?: string) => Promise<boolean>;
}) {
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
    // El padre resuelve a `false` si el write falló: el modal queda abierto y se rehabilita
    // para reintentar. El toast lo muestra el padre, no se duplica acá.
    const ok = await onClose(true, comentarios);
    if (!ok) setSaving(false);
  };

  return (
    <ModalPortal>
    <div className="modal-overlay" onClick={() => onClose(false)}>
      <motion.div className={`modal-content ${styles.commentsModal}`} onClick={e => e.stopPropagation()}>
        <div className={`modal-header ${styles.canonicalModalHeader}`}>
            <div>
              <h3 className={styles.editTitle}>
                <MessageSquare size={16} strokeWidth={2.5} className={styles.commentsIcon} />
                Comentarios
              </h3>
              <p className={styles.editSubtitle}>
                {registro?.nombre}
              </p>
            </div>
            <button type="button" aria-label="Cerrar" className={`btn-icon ${styles.canonicalModalClose}`} onClick={() => onClose(false)}><X size={18} /></button>
          </div>
        <div className={`modal-body ${styles.commentsBody}`}>
          <Field label="Comentarios">
            <textarea
              value={comentarios}
              onChange={e => setComentarios(corregirTildes(e.target.value))}
              rows={6}
              className={`form-input ${styles.commentsTextarea}`}
              placeholder="Sin comentarios..."
              autoFocus
            />
          </Field>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary modal-btn-cancel" onClick={() => onClose(false)}>CANCELAR</button>
          <button className="btn-primary modal-btn-save" onClick={save} disabled={saving}>{saving ? 'GUARDANDO…' : 'GUARDAR'}</button>
        </div>
      </motion.div>
    </div>
    </ModalPortal>
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
      <motion.div drag dragMomentum={false} className={`modal-content modal-content--danger ${styles.deleteModal}`} onClick={e => e.stopPropagation()}>
        <div className={styles.compactModalHeader}>
            <div>
              <h3 className={`${styles.compactModalTitle} ${styles.deleteTitle}`}>
                <AlertTriangle size={16} strokeWidth={2.5} />
                Eliminar registro
              </h3>
              <p className={`${styles.compactModalSubtitle} ${styles.deleteSubtitle}`}>
                Esta acción es permanente y no se puede deshacer
              </p>
            </div>
            <button className={`btn-icon ${styles.compactModalClose}`} onClick={onCancel}><X size={18} /></button>
          </div>
        <div className={`modal-body ${styles.deleteBody}`}>
          <p className={styles.deleteCopy}>
            ¿Confirmar eliminación de <strong className={styles.compactModalStrong}>{registro.nombre}</strong>?<br />
            <span className={styles.deleteWarning}>La acción es permanente.</span>
          </p>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary modal-btn-cancel" onClick={onCancel}>CANCELAR</button>
          <button className={`btn-danger ${styles.deleteConfirm}`} onClick={onConfirm}>
            ELIMINAR AHORA
          </button>
        </div>
      </motion.div>
    </div>
    </ModalPortal>
  );
});

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RegistrosPage() {
  const { isAdmin, simulatedAnalista, setSimulatedAnalista, user } = useAuth();
  const { registros, applyRegistroChange, pushRegistroChange, loading, refresh } = useRegistros();
  const { alertasConfig, hasPermiso } = useSettings();
  const { nombres: ANALISTAS } = useAnalistas();
  const searchParams = useSearchParams();

  const {
    filters, setFilter, toggleEtiqueta, limpiarFiltros, hayFiltros,
    isCreationModalOpen, setIsCreationModalOpen,
    pageSize, setPageSize,
    currentPage, setCurrentPage,
  } = useFilter();

  const canPerform = useCallback((permiso: string, recordAnalista?: string) => {
    if (isAdmin) return true;
    const target = simulatedAnalista || user?.username || recordAnalista || (filters?.analista && filters.analista !== 'todos' ? filters.analista : null);
    return hasPermiso(permiso, target);
  }, [isAdmin, simulatedAnalista, user?.username, filters?.analista, hasPermiso]);

  const [showInlineFilters, setShowInlineFilters] = useState(false);
  const [filtersPanelOpen, setFiltersPanelOpen] = useState(false);
  const [sortMode, setSortMode] = useState<'fecha-desc' | 'fecha-asc' | 'monto-desc' | 'score-desc' | 'nombre-asc'>('fecha-desc');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

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

  const [deleteTarget, setDeleteTarget] = useState<Registro | null>(null);
  const [whatsappTarget, setWhatsappTarget] = useState<Registro | null>(null);
  const [comentariosTarget, setComentariosTarget] = useState<Registro | null>(null);
  const [bitacoraTarget, setBitacoraTarget] = useState<Registro | null>(null);
  const [actionMenu, setActionMenu] = useState<{ registro: Registro; top: number; left: number } | null>(null);
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
        if (actionMenu) {
          setActionMenu(null);
          return;
        }
        if (modalOpen) {
          return;
        }
        if (showInlineFilters) {
          setShowInlineFilters(false);
          return;
        }
        if (hayFiltros) {
          limpiarFiltros();
        } else if (filtersPanelOpen) {
          setFiltersPanelOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [actionMenu, hayFiltros, limpiarFiltros, filtersPanelOpen, modalOpen, showInlineFilters]);



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
      if (!canPerform('crear_registros')) {
        showToast('No tenés permisos para crear registros', 'error');
        setIsCreationModalOpen(false);
        return;
      }
      setEditingId(null);
      setModalInitialData({ ...initialForm, analista: simulatedAnalista || (ANALISTAS[0] ?? '') });
      setModalOpen(true);
      setIsCreationModalOpen(false);
    }
  }, [isCreationModalOpen, setIsCreationModalOpen, canPerform, showToast, simulatedAnalista, ANALISTAS]);

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

    return list.sort((a, b) => {
      if (sortMode === 'fecha-asc') return (a.fecha || '').localeCompare(b.fecha || '');
      if (sortMode === 'monto-desc') return Number(b.monto || 0) - Number(a.monto || 0);
      if (sortMode === 'score-desc') return Number(b.puntaje || 0) - Number(a.puntaje || 0);
      if (sortMode === 'nombre-asc') return (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' });
      const dA = a.fecha || '', dB = b.fecha || '';
      if (dA !== dB) return dA > dB ? -1 : 1;
      const priA = a.estado === 'venta' || a.estado === 'derivado / aprobado cc';
      const priB = b.estado === 'venta' || b.estado === 'derivado / aprobado cc';
      return priA === priB ? 0 : priA ? -1 : 1;
    });
    // `filters.etiquetas`, `filters.soloRecontactosHoy` y `vencidoOIngresoHoyIds`
    // se leen en el cuerpo (filtros de Etiquetas Lead y Re-contactos Hoy) y
    // faltaban aquí. Como `setFilters` actualiza de forma inmutable conservando
    // la referencia del resto de propiedades, al cambiar sólo una de ellas
    // NINGUNA dependencia listada cambiaba y el memo devolvía la lista cacheada:
    // el filtro no surtía efecto hasta que se tocaba otro filtro.
  }, [registros, searchIndex, debouncedSearch, filters.estados, filters.analista, filters.fechaDesde, filters.fechaHasta, filters.montoMin, filters.montoMax, filters.scoreMin, filters.scoreMax, filters.esRe, filters.soloAlertasVencidas, filters.acuerdoPrecios, filters.etiquetas, filters.soloRecontactosHoy, vencidoOIngresoHoyIds, alertasConfig, sortMode]);

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

  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent('crm:page-zoom-scope', {
        detail: { pathname: '/registros', scope: `seccion:${activeTab}:vista:${viewMode}` },
      }));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeTab, viewMode]);


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
    // El error se comprobaba: supabase-js no lanza ante un fallo de PostgREST. Sin esto se
    // auditaba una eliminación que no ocurrió, se quitaba la fila de la UI propia y se
    // emitía un broadcast de DELETE a las demás sesiones, todo con un toast de éxito.
    const { error } = await supabase.from('registros').delete().eq('id', reg.id);
    if (error) {
      showToast('Error al eliminar el registro', 'error');
      return; // el modal sigue abierto para reintentar o cancelar
    }
    setDeleteTarget(null);
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

  const handleComentariosClose = useCallback(async (saved: boolean, updatedComentarios?: string): Promise<boolean> => {
    if (saved && comentariosTarget && updatedComentarios !== undefined) {
      const { error } = await supabase
        .from('registros')
        .update({ comentarios: updatedComentarios })
        .eq('id', comentariosTarget.id);

      if (error) {
        showToast('Error al guardar comentarios', 'error');
        // El modal sigue montado con la misma referencia de `registro`, así que es él
        // quien debe rehabilitarse: se lo indicamos devolviendo `false`.
        return false;
      }
      showToast('Comentarios guardados', 'success');
      setComentariosTarget(null);
      applyRegistroChange('UPDATE', { ...comentariosTarget, comentarios: updatedComentarios });
      pushRegistroChange('UPDATE', { ...comentariosTarget, comentarios: updatedComentarios });
      refresh(true);
      return true;
    }
    setComentariosTarget(null);
    return true;
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

  const openActionMenu = useCallback((reg: Registro, event: React.MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 196;
    const hasBitacora = canPerform('ver_bitacora', reg.analista);
    const hasComentarios = canPerform('ver_comentarios', reg.analista) && !!reg.comentarios?.trim();
    const hasDelete = canPerform('eliminar_registros', reg.analista);
    const visibleActions = 2 + Number(hasBitacora) + Number(hasComentarios) + Number(hasDelete);
    const menuHeight = visibleActions * 36 + 10 + (hasDelete ? 4 : 0);
    const gap = 6;
    const left = Math.min(Math.max(8, rect.right - menuWidth), window.innerWidth - menuWidth - 8);
    const top = rect.bottom + menuHeight + gap <= window.innerHeight
      ? rect.bottom + gap
      : Math.max(8, rect.top - menuHeight - gap);

    setActionMenu(prev => prev?.registro.id === reg.id ? null : { registro: reg, top, left });
  }, [canPerform]);

  // Render de una fila de la tabla. Se reutiliza en la tabla principal y en el panel de fijados.
  const renderFila = useCallback((reg: Registro) => {
    const isVencidoOIngresoHoy = vencidoOIngresoHoyIds.has(reg.id);
    const isProximo = proximoIds.has(reg.id);

    return (
      <tr
        key={reg.id}
        className={`hover-row records-row${isVencidoOIngresoHoy ? ' is-overdue' : isProximo ? ' is-upcoming' : ''}`}
      >
        {/* Cliente */}
        <td className="records-cell records-cell--client">
          <div className="records-client">
            <div className="records-client__identity">
              <span className="records-client__name">{reg.nombre}</span>
              {reg.cuil && (
                <>
                  <span className="records-client__separator">|</span>
                  <span className="cuil-text">{formatearCuil(reg.cuil)}</span>
                </>
              )}
              {reg.es_re && (
                <span className="records-client__re">RE</span>
              )}
              {(reg.etiquetas || []).map(t => (
                <TagBadge key={t} tag={t} />
              ))}
            </div>

            {isVencidoOIngresoHoy && (
              <span className="records-reminder is-overdue">
                🔴 Re-contacto Hoy / Vencido
                <button
                  type="button"
                  onClick={async (e) => {
                    e.stopPropagation();
                    // Se quita de la lista sólo si el write tuvo éxito: antes desaparecía de
                    // pantalla aunque la base siguiera con `mostrado = false`.
                    const { error } = await supabase.from('recordatorios').update({ mostrado: true }).eq('registro_id', reg.id);
                    if (error) { showToast('No se pudo marcar el recordatorio', 'error'); return; }
                    setRecordatorios(prev => prev.filter(r => r.registro_id !== reg.id));
                  }}
                  title="Marcar recordatorio como atendido / quitar vencido"
                  className="records-reminder__dismiss"
                >
                  <X size={10} />
                </button>
              </span>
            )}
            {isProximo && !isVencidoOIngresoHoy && (
              <span className="records-reminder is-upcoming">
                🟡 Re-contacto Próximo
                <button
                  type="button"
                  onClick={async (e) => {
                    e.stopPropagation();
                    // Se quita de la lista sólo si el write tuvo éxito: antes desaparecía de
                    // pantalla aunque la base siguiera con `mostrado = false`.
                    const { error } = await supabase.from('recordatorios').update({ mostrado: true }).eq('registro_id', reg.id);
                    if (error) { showToast('No se pudo marcar el recordatorio', 'error'); return; }
                    setRecordatorios(prev => prev.filter(r => r.registro_id !== reg.id));
                  }}
                  title="Marcar recordatorio como atendido / quitar"
                  className="records-reminder__dismiss"
                >
                  <X size={10} />
                </button>
              </span>
            )}
          </div>
        </td>

        {/* Analista */}
        <td className="records-cell records-cell--center records-cell--analyst">
          {displayAnalista(reg.analista)}
        </td>

        {/* Fecha */}
        <td className="records-cell records-cell--center">
          <div className="records-cell__date">{formatDate(reg.fecha)}</div>
        </td>

        {/* Score */}
        <td className="records-cell records-cell--center">
          {reg.puntaje ? (
            <div className="records-score">
              <span className={`records-score-dot is-${Number(reg.puntaje) > 700 ? 'alta' : Number(reg.puntaje) >= 550 ? 'media' : 'baja'}`} />
              <span>{reg.puntaje}</span>
            </div>
          ) : (
            <span className="records-cell__empty">—</span>
          )}
        </td>

        {/* Monto */}
        <td className={`records-cell records-cell--center records-cell--amount${reg.monto == null ? ' is-empty' : ''}`}>
          {reg.monto == null ? '—' : formatCurrency(Number(reg.monto))}
        </td>

        {/* Calif. — el estado del registro, en columna propia. Antes se perdía: la celda
            combinada mostraba `tipo_cliente || estado`, de modo que el estado quedaba
            invisible en los registros que tienen ambos campos. */}
        <td className="records-cell records-cell--center">
          {reg.estado ? (
            <span className="status-badge table-calif-badge">
              {reg.estado.toLowerCase().replace(/(^|\s|\/)([a-záéíóúñ])/g, (_m, p1, p2) => `${p1}${p2.toUpperCase()}`)}
            </span>
          ) : (
            <span className="records-cell__empty">—</span>
          )}
        </td>

        {/* Tipo / Acuerdo */}
        <td className="records-cell records-cell--state">
          {(() => {
            const score = Number(reg.puntaje || 0);
            const level = score > 700 ? 'alta' : score >= 550 ? 'media' : 'baja';
            return (
              <div className={`records-state-type is-${level}`}>
                <span className="records-state-type__primary">{reg.tipo_cliente || '—'}</span>
                <span className="records-state-type__secondary">{reg.acuerdo_precios || 'Sin acuerdo'}</span>
              </div>
            );
          })()}
        </td>

        {/* Acciones */}
        <td className="records-cell records-cell--actions">
          <div className="records-actions">
            {canPerform('editar_registros', reg.analista) && (
              <button
                onClick={() => openEdit(reg)}
                className="records-action-edit"
              ><Edit2 size={16} /><span>Editar</span></button>
            )}
            <button
              type="button"
              onClick={(event) => openActionMenu(reg, event)}
              className={`records-action-more${actionMenu?.registro.id === reg.id ? ' is-active' : ''}`}
              aria-label={`Más acciones para ${reg.nombre}`}
              aria-haspopup="menu"
              aria-expanded={actionMenu?.registro.id === reg.id}
            ><MoreHorizontal size={18} /></button>
          </div>
        </td>
      </tr>
    );
  }, [vencidoOIngresoHoyIds, proximoIds, canPerform, openEdit, openActionMenu, actionMenu, showToast]);

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
    <div className={`records-reference-page ${styles.page}`}>

      {/* Toast */}
      {toast && (
        <div className={styles.toastRegion}>
          <div className={`${styles.toast} ${toast.type === 'success' ? styles.toastSuccess : toast.type === 'error' ? styles.toastError : styles.toastWarning}`}>
            <AlertCircle size={15} />
            {toast.message}
          </div>
        </div>
      )}

      {/* Banner de Modo Simulación Activo */}
      {simulatedAnalista && (
        <div className={styles.simulationBanner}>
          <div className={styles.simulationIdentity}>
            <div className={styles.simulationIcon}>
              <User size={16} color="#c084fc" />
            </div>
            <div>
              <span className={styles.simulationTitle}>
                Modo Simulación: Viendo la app con los permisos de <span className={styles.simulationAnalyst}>{simulatedAnalista}</span>
              </span>
              <span className={styles.simulationHint}>
                (Las acciones y visibilidad de íconos responden a su rol)
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSimulatedAnalista(null)}
            className={styles.simulationExit}
          >
            ✕ Salir de Simulación
          </button>
        </div>
      )}

      {/* Revision Panel */}
      {panelData && panelData.mode === 'full' && (() => {
        const healthClass = panelData.salud === 100 ? styles.summaryHealthGood : panelData.salud >= 80 ? styles.summaryHealthWarning : styles.summaryHealthDanger;
        const r = 26;
        const circ = 2 * Math.PI * r;
        const offset = circ - (panelData.salud / 100) * circ;
        const isBad = panelData.vencidos > 0;

        return (
          <div className={`records-filtered-summary ${styles.summaryPanel} ${styles.summaryPanelFull} ${healthClass}`}>
            {/* Health Ring */}
            <div className={styles.summaryHealthRing}>
              <svg width="68" height="68" className={styles.summaryHealthSvg}>
                <circle cx="34" cy="34" r={r} fill="transparent" stroke="#e8edf3" strokeWidth="6" />
                <circle className={styles.summaryHealthProgress} cx="34" cy="34" r={r} fill="transparent" stroke="currentColor" strokeWidth="6" strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
              </svg>
              <div className={styles.summaryHealthValueWrap}>
                <span className={styles.summaryHealthValue}>{panelData.salud}%</span>
              </div>
            </div>

            {/* Info */}
            <div className={styles.summaryInfo}>
              <div className={styles.summaryHeadingRow}>
                <h2 className={styles.summaryTitle}>
                  {panelData.estado}
                </h2>
                <div className={`${styles.summaryBadge} ${isBad ? styles.summaryBadgeDanger : styles.summaryBadgeSuccess}`}>
                  {isBad ? <AlertTriangle size={12} strokeWidth={3} /> : <CheckCircle2 size={12} strokeWidth={3} />}
                  {isBad ? 'Requiere Atención' : 'OK'}
                </div>
              </div>
              <p className={styles.summaryDescription}>
                Límite de gestión: <strong className={styles.summaryStrong}>{panelData.diasLimite} {panelData.diasLimite === 1 ? 'día' : 'días'}</strong>. Supervisión de tiempos en curso.
              </p>
            </div>

            {/* Metrics */}
            <div className={styles.summaryMetrics}>
              <div className={`${styles.summaryMetric} ${styles.summaryMetricLight}`}>
                <div className={styles.summaryMetricCopy}>
                  <span className={styles.summaryMetricLabel}>Total Registros</span>
                  <span className={`${styles.summaryMetricValue} ${styles.summaryMetricValueDark}`}>{panelData.total}</span>
                </div>
                <Hash size={24} strokeWidth={1.5} className={styles.summaryMetricIconLight} />
              </div>

              <div className={`${styles.summaryMetric} ${styles.summaryMetricLight}`}>
                <div className={styles.summaryMetricCopy}>
                  <span className={styles.summaryMetricLabel}>Monto Total</span>
                  <span className={`${styles.summaryMetricValue} ${styles.summaryMetricValueDark}`}>{formatCurrency(panelData.montoTotal)}</span>
                </div>
                <DollarSign size={24} strokeWidth={1.5} className={styles.summaryMetricIconLight} />
              </div>

              <div className={`${styles.summaryMetric} ${isBad ? styles.summaryMetricDanger : styles.summaryMetricDark}`}>
                <div className={styles.summaryMetricCopy}>
                  <span className={`${styles.summaryMetricLabel} ${isBad ? styles.summaryMetricDangerText : ''}`}>Vencidos</span>
                  <span className={`${styles.summaryMetricValue} ${isBad ? styles.summaryMetricDangerText : ''}`}>{panelData.vencidos}</span>
                </div>
                <Timer size={24} strokeWidth={1.5} className={isBad ? styles.summaryMetricIconDanger : styles.summaryMetricIconDark} />
              </div>

              <div className={`${styles.summaryMetric} ${isBad ? styles.summaryMetricDanger : styles.summaryMetricDark}`}>
                <div className={styles.summaryMetricCopy}>
                  <span className={`${styles.summaryMetricLabel} ${isBad ? styles.summaryMetricDangerText : ''}`}>Monto Vencidos</span>
                  <span className={`${styles.summaryMetricValue} ${isBad ? styles.summaryMetricDangerText : ''}`}>{formatCurrency(panelData.montoVencidos)}</span>
                </div>
                <DollarSign size={24} strokeWidth={1.5} className={isBad ? styles.summaryMetricIconDanger : styles.summaryMetricIconDark} />
              </div>

            </div>
          </div>
        );
      })()}

      {/* Filtered Panel (lite) — mismo diseño, sin vencidos/salud */}
      {panelData && panelData.mode === 'lite' && (
        <div className={`records-filtered-summary ${styles.summaryPanel} ${styles.summaryPanelLite}`}>
          {/* Info */}
          <div className={styles.summaryInfo}>
            <div className={styles.summaryHeadingRow}>
              <h2 className={`${styles.summaryTitle} ${styles.summaryTitleLite}`}>
                Registros Filtrados
              </h2>
              <div className={`${styles.summaryBadge} ${styles.summaryBadgeSuccess}`}>
                <SlidersHorizontal size={12} strokeWidth={3} />
                Filtro Activo
              </div>
            </div>
            <p className={styles.summaryDescription}>
              Resultados según los filtros aplicados.
            </p>
          </div>

          {/* Metrics */}
          <div className={styles.summaryMetrics}>
            <div className={`${styles.summaryMetric} ${styles.summaryMetricDark}`}>
              <div className={styles.summaryMetricCopy}>
                <span className={styles.summaryMetricLabel}>Total Registros</span>
                <span className={styles.summaryMetricValue}>{panelData.total}</span>
              </div>
              <Hash size={24} strokeWidth={1.5} className={styles.summaryMetricIconDark} />
            </div>

            <div className={`${styles.summaryMetric} ${styles.summaryMetricDark}`}>
              <div className={styles.summaryMetricCopy}>
                <span className={styles.summaryMetricLabel}>Monto Total</span>
                <span className={styles.summaryMetricValue}>{formatCurrency(panelData.montoTotal)}</span>
              </div>
              <DollarSign size={24} strokeWidth={1.5} className={styles.summaryMetricIconDark} />
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="records-table-card">
        {/* Pestañas: Registros / Fijados (solo si hay alguno fijado) */}
        <div className="records-tabs">
            {([['registros', 'Registros'], ['fijados', `Fijados (${registrosFijados.length})`]] as const).map(([key, label]) => {
              const active = activeTab === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={active ? 'is-active' : undefined}
                >
                  {key === 'registros' ? <FileText size={14} /> : <Pin size={13} fill={active ? 'currentColor' : 'none'} />}
                  {label}
                </button>
              );
            })}
          </div>
        <div className="records-toolbar">
          <label className="records-search"><Search size={18} /><input value={filters.search} onChange={e => setFilter('search', e.target.value)} placeholder="Buscar cliente, CUIL o gestor..." /></label>
          <button type="button" className={`records-toolbar-btn${hayFiltros || filtersPanelOpen ? ' is-active' : ''}`} onClick={() => setFiltersPanelOpen(open => !open)} aria-expanded={filtersPanelOpen}><SlidersHorizontal size={17} /> Filtros <ChevronDown size={14} /></button>
          <CorporateDateRangePicker
            compact
            fromValue={filters.fechaDesde}
            toValue={filters.fechaHasta}
            onChange={({ from, to }) => {
              setFilter('fechaDesde', from);
              setFilter('fechaHasta', to);
            }}
          />
          <span className="records-toolbar-spacer" />
          <span className="records-count">{activeTab === 'fijados' ? registrosFijados.length : filteredRegistros.length} registros</span>
          <i className="records-toolbar-divider" />
          <div className="records-sort-control">
            <ArrowUpDown size={17} />
            <CustomSelect
              width="118px"
              value={sortMode}
              onChange={value => setSortMode(String(value) as typeof sortMode)}
              options={[
                { value: 'fecha-desc', label: 'Más recientes' },
                { value: 'fecha-asc', label: 'Más antiguos' },
                { value: 'monto-desc', label: 'Mayor monto' },
                { value: 'score-desc', label: 'Mayor score' },
                { value: 'nombre-asc', label: 'Nombre A–Z' },
              ]}
            />
          </div>
          <div className="records-view-toggle">
            <button type="button" className={viewMode === 'list' ? 'is-active' : ''} aria-label="Vista de lista" onClick={() => setViewMode('list')}><List size={18} /></button>
            <button type="button" className={viewMode === 'grid' ? 'is-active' : ''} aria-label="Vista de cuadrícula" onClick={() => setViewMode('grid')}><Grid2X2 size={17} /></button>
          </div>
          {/* Filas por página. Ciclo [25, 50, 100, 200], igual que el selector del Sidebar
              retirado en la migración. No hace falta acotar la página: FilterContext ya
              resetea a la 1 cuando cambia `pageSize`. */}
          <button
            type="button"
            className="records-toolbar-btn"
            onClick={() => {
              const sizes = [25, 50, 100, 200];
              setPageSize(sizes[(sizes.indexOf(pageSize || 25) + 1) % sizes.length]);
            }}
            title={`Mostrando ${pageSize || 25} filas por página. Hacé clic para cambiar a 25, 50, 100 o 200.`}
            aria-label={`Filas por página: ${pageSize || 25}. Cambiar.`}
          >
            <Rows3 size={16} /> {pageSize || 25}
          </button>
          {canPerform('crear_registros') && (
            <button
              type="button"
              className="btn-primary records-new-btn"
              onClick={() => setIsCreationModalOpen(true)}
              aria-label="Nuevo registro"
            >
              <Plus size={16} /> Nuevo registro
            </button>
          )}
        </div>
        {filtersPanelOpen && (
          <div className="records-filters-panel">
            <div className="records-filter-field">
              <span>Analista</span>
              <CustomSelect width="100%" value={filters.analista} onChange={value => setFilter('analista', String(value))} options={[{ value: '', label: 'Todos los analistas' }, ...ANALISTAS.map(nombre => ({ value: nombre, label: nombre }))]} />
            </div>
            <div className="records-filter-field">
              <span>Estado</span>
              <CustomSelect width="100%" value={filters.estados[0] || ''} onChange={value => setFilter('estados', value ? [String(value)] : [])} options={[{ value: '', label: 'Todos los estados' }, ...ESTADOS.map(estado => ({ value: estado, label: capitalizarTexto(estado) }))]} />
            </div>
            <div className="records-filter-field is-date-range">
              <span>Período</span>
              <CorporateDateRangePicker
                fromValue={filters.fechaDesde}
                toValue={filters.fechaHasta}
                onChange={({ from, to }) => {
                  setFilter('fechaDesde', from);
                  setFilter('fechaHasta', to);
                }}
              />
            </div>
            <label className="records-filter-field">
              <span>Score mínimo</span>
              <input type="number" min="0" value={filters.scoreMin} onChange={e => setFilter('scoreMin', e.target.value)} placeholder="0" />
            </label>
            <label className="records-filter-field">
              <span>Score máximo</span>
              <input type="number" min="0" value={filters.scoreMax} onChange={e => setFilter('scoreMax', e.target.value)} placeholder="999" />
            </label>
            <button type="button" className="records-clear-filters" onClick={limpiarFiltros} disabled={!hayFiltros}><X size={15} /> Limpiar</button>
          </div>
        )}
        {(activeTab === 'fijados' ? registrosFijados.length === 0 : filteredRegistros.length === 0) && !loading ? (
          <div className="records-empty">
            <span className="records-empty__mark">—</span>
            <p>No se encontraron registros coincidentes</p>
            {hayFiltros && (
              <button onClick={limpiarFiltros}>
                <X size={14} /> LIMPIAR FILTROS
              </button>
            )}
          </div>
        ) : (
          <>
          <div className="records-table-scroll">
            {hayFiltros && isRevisionState && (
              <div className={styles.revisionFilters}>
                <div className={styles.revisionFiltersHeader}>
                  {isRevisionState ? null : hayFiltros ? (
                    <>
                      <span className={styles.revisionStat}>
                        Registros filtrados <span className={styles.revisionStatValue}>{totales.cantidad}</span>
                      </span>
                      <span className={styles.revisionStat}>
                        Total acumulado <span className={styles.revisionStatValue}>
                          {formatCurrency(totales.monto)}
                        </span>
                      </span>
                    </>
                  ) : (
                    <span className={styles.revisionStat}>
                      Todos los registros <span className={`${styles.revisionStatValue} ${styles.revisionStatValueNeutral}`}>{totales.cantidad}</span>
                    </span>
                  )}
                  <div className={styles.revisionSpacer} />
                  
                  {isRevisionState && (
                    <button
                      onClick={() => setShowInlineFilters(p => !p)}
                      className={`${styles.inlineFiltersToggle} ${showInlineFilters ? styles.inlineFiltersToggleActive : ''}`}
                    >
                      <SlidersHorizontal size={12} strokeWidth={3} /> {showInlineFilters ? 'Ocultar Filtros' : 'Filtros Avanzados'}
                    </button>
                  )}
                </div>
                
                {/* INLINE FILTERS EXPANDABLE AREA */}
                {isRevisionState && showInlineFilters && (
                  <div className={styles.inlineFiltersPanel}>
                    <div className={styles.inlineFilterField}>
                      <label className={styles.inlineFilterLabel}>Búsqueda General</label>
                      <input className={`${styles.inlineFilterInput} ${styles.inlineFilterSearch}`} placeholder="Nombre, CUIL..." value={filters.search} onChange={e => setFilter('search', e.target.value)} />
                    </div>
                    <div className={styles.inlineFilterField}>
                      <label className={styles.inlineFilterLabel}>Analista</label>
                      <PremiumSelect 
                        value={filters.analista} 
                        onChange={v => setFilter('analista', v)} 
                        options={ANALISTAS} 
                        placeholder="Todos los analistas" 
                      />
                    </div>
                    <div className={`${styles.inlineFilterField} ${styles.inlineFilterTags}`}>
                      <label className={styles.inlineFilterLabel}>Etiquetas Lead</label>
                      <div className={styles.inlineFilterChipList}>
                        {['Presupuestado'].map(t => {
                          const isSel = filters.etiquetas.includes(t);
                          return (
                            <button
                              key={t}
                              type="button"
                              onClick={() => toggleEtiqueta(t)}
                              className={`${styles.inlineFilterChip} ${isSel ? styles.inlineFilterChipActive : ''}`}
                            >
                              {t}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className={styles.inlineFilterRecontacts}>
                      <button
                        type="button"
                        onClick={() => setFilter('soloRecontactosHoy', !filters.soloRecontactosHoy)}
                        className={`${styles.inlineFilterRecontactButton} ${filters.soloRecontactosHoy ? styles.inlineFilterRecontactButtonActive : ''}`}
                      >
                        🔴 Re-contactos Hoy / Vencidos
                      </button>
                    </div>
                    <div className={styles.inlineFilterPair}>
                       <div className={styles.inlineFilterPairField}>
                         <label className={styles.inlineFilterLabel}>Fecha Desde</label>
                         <input className={styles.inlineFilterInput} type="date" value={filters.fechaDesde} onChange={e => setFilter('fechaDesde', e.target.value)} />
                       </div>
                       <div className={styles.inlineFilterPairField}>
                         <label className={styles.inlineFilterLabel}>Fecha Hasta</label>
                         <input className={styles.inlineFilterInput} type="date" value={filters.fechaHasta} onChange={e => setFilter('fechaHasta', e.target.value)} />
                       </div>
                    </div>
                    <div className={styles.inlineFilterPair}>
                       <div className={styles.inlineFilterPairField}>
                         <label className={styles.inlineFilterLabel}>Score Mín</label>
                         <input className={styles.inlineFilterInput} type="number" value={filters.scoreMin} onChange={e => setFilter('scoreMin', e.target.value)} />
                       </div>
                       <div className={styles.inlineFilterPairField}>
                         <label className={styles.inlineFilterLabel}>Score Máx</label>
                         <input className={styles.inlineFilterInput} type="number" value={filters.scoreMax} onChange={e => setFilter('scoreMax', e.target.value)} />
                       </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            {viewMode === 'list' ? (
            <table className="records-data-table">
              <thead>
                <tr>
                  {['Cliente | CUIL', 'Gestión', 'Fecha', 'Score', 'Monto', 'Calif.', 'Tipo / Acuerdo', 'Acciones'].map((h, i) => (
                    <th key={i}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(activeTab === 'fijados' ? registrosFijados : paginatedRegistros).map(renderFila)}
              </tbody>
            </table>
            ) : (
              <div className="records-grid">
                {(activeTab === 'fijados' ? registrosFijados : paginatedRegistros).map(reg => {
                  const score = Number(reg.puntaje || 0);
                  const level = score > 700 ? 'alta' : score >= 550 ? 'media' : 'baja';
                  return (
                    <article className="records-grid-card" key={reg.id}>
                      <div className="records-grid-card__head">
                        <div><strong>{reg.nombre}</strong><span>{reg.cuil ? formatearCuil(reg.cuil) : 'Sin CUIL'}</span></div>
                        <button type="button" onClick={() => openEdit(reg)} aria-label={`Editar ${reg.nombre}`}><Edit2 size={15} /></button>
                      </div>
                      <div className="records-grid-card__metrics">
                        <span><small>Gestión</small><b>{displayAnalista(reg.analista)}</b></span>
                        <span><small>Fecha</small><b>{formatDate(reg.fecha)}</b></span>
                        <span><small>Score</small><b>{reg.puntaje || '—'}</b></span>
                        <span><small>Monto</small><b>{reg.monto == null ? '—' : formatCurrency(Number(reg.monto))}</b></span>
                      </div>
                      <div className={`records-grid-card__status is-${level}`}>
                        <strong>{reg.tipo_cliente || capitalizarTexto(reg.estado || 'Sin estado')}</strong>
                        <span>{reg.acuerdo_precios || 'Sin acuerdo'}</span>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>

            {/* Footer fijo de la tabla: no participa del scroll de las filas. */}
            {activeTab === 'registros' && filteredRegistros.length > pageSize && (
              <div className="records-pagination">
                {/* Info de registros */}
                <div className="records-pagination__text">
                  Mostrando {rangeEnd} de {filteredRegistros.length} registros
                </div>

                {/* Botones de paginación */}
                <div className="records-pagination__controls">
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

                  <div className="records-pagination__page">
                    <span>Página</span>
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
                    <span>de {totalPages}</span>
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
          </>
        )}
      </div>

      {actionMenu && (
        <ModalPortal>
          <div className="records-action-menu-layer" onClick={() => setActionMenu(null)}>
            <div
              className="records-action-menu"
              role="menu"
              aria-label={`Acciones para ${actionMenu.registro.nombre}`}
              style={{ top: actionMenu.top, left: actionMenu.left }}
              onClick={event => event.stopPropagation()}
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  const reg = actionMenu.registro;
                  setActionMenu(null);
                  void handleToggleFijado(reg);
                }}
              >
                <Pin size={15} fill={actionMenu.registro.fijado ? 'currentColor' : 'none'} />
                <span>{actionMenu.registro.fijado ? 'Desfijar registro' : 'Fijar arriba'}</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  const reg = actionMenu.registro;
                  setActionMenu(null);
                  handleWhatsApp(reg);
                }}
              >
                <WhatsAppIcon size={15} />
                <span>{actionMenu.registro.telefono ? 'Abrir WhatsApp' : 'Agregar teléfono'}</span>
              </button>
              {canPerform('ver_bitacora', actionMenu.registro.analista) && (
                <button
                  type="button"
                  role="menuitem"
                  className={vencidoOIngresoHoyIds.has(actionMenu.registro.id) ? 'has-alert' : ''}
                  onClick={() => {
                    const reg = actionMenu.registro;
                    setActionMenu(null);
                    setBitacoraTarget(reg);
                  }}
                >
                  <Bell size={15} />
                  <span>Recordatorio y seguimiento</span>
                </button>
              )}
              {canPerform('ver_comentarios', actionMenu.registro.analista) && actionMenu.registro.comentarios?.trim() && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    const reg = actionMenu.registro;
                    setActionMenu(null);
                    setComentariosTarget(reg);
                  }}
                >
                  <MessageSquare size={15} />
                  <span>Ver comentarios</span>
                </button>
              )}
              {canPerform('eliminar_registros', actionMenu.registro.analista) && (
                <button
                  type="button"
                  role="menuitem"
                  className="is-danger"
                  onClick={() => {
                    const reg = actionMenu.registro;
                    setActionMenu(null);
                    setDeleteTarget(reg);
                  }}
                >
                  <Trash2 size={15} />
                  <span>Eliminar registro</span>
                </button>
              )}
            </div>
          </div>
        </ModalPortal>
      )}

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
              abrirWhatsApp(cleanNum);
            } else {
              refresh(true);
            }
          }
        }} 
        onCancel={() => setWhatsappTarget(null)} 
      />
      <BitacoraModal registro={bitacoraTarget} isOpen={!!bitacoraTarget} onClose={() => setBitacoraTarget(null)} onSavedEtiquetas={handleSaveEtiquetas} />
    </div>
  );
}
