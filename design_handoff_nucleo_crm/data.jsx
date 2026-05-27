/* eslint-disable */
// Núcleo · CRM Ventas — Mock data

const ANALISTAS = [
  { id: 'a1', nombre: 'Luciana Romero',  role: 'Senior' },
  { id: 'a2', nombre: 'Victoria Suárez', role: 'Semi-Sr' },
];

const EMPLEADORES = [
  'YPF S.A.', 'Banco Galicia', 'Telecom Argentina', 'Mercado Libre',
  'Arcor', 'Coca-Cola FEMSA', 'Techint', 'Cervecería Quilmes',
  'Banco Santander', 'BBVA Argentina', 'Carrefour Arg.', 'Globant',
  'Loma Negra', 'Pampa Energía', 'Edenor', 'Aerolíneas Argentinas',
];

const LOCALIDADES = [
  { cp: '1425', nombre: 'Palermo, CABA' },
  { cp: '1426', nombre: 'Belgrano, CABA' },
  { cp: '1414', nombre: 'Villa Crespo, CABA' },
  { cp: '1407', nombre: 'Mataderos, CABA' },
  { cp: '1828', nombre: 'Banfield, BA' },
  { cp: '1832', nombre: 'Lomas de Zamora, BA' },
  { cp: '5000', nombre: 'Córdoba Capital' },
  { cp: '2000', nombre: 'Rosario, SF' },
  { cp: '8000', nombre: 'Bahía Blanca, BA' },
  { cp: '5500', nombre: 'Mendoza Capital' },
];

const ESTADOS = ['Aprobado', 'En revisión', 'Negociación', 'Pendiente', 'Rechazado', 'Concretado', 'Cancelado'];

const NOMBRES = [
  'Lautaro Bianchi','Florencia Paz','Martín Iglesias','Agustina Vera','Nicolás Ruiz',
  'Valentina Cabrera','Federico Lema','Carolina Suárez','Joaquín Aramburu','Micaela Salinas',
  'Sebastián Coria','Mariana Ferreyra','Ezequiel Maldonado','Antonella Reyes','Tomás Aguirre',
  'Lara Pereyra','Gonzalo Etcheverry','Julieta Domínguez','Hernán Saldívar','Camila Bustos',
  'Andrés Olivera','Ailín Cardozo','Bruno Cattáneo','Rocío Funes','Maximiliano Vega',
  'Belén Mansilla','Ignacio Heredia','Daniela Cufré','Leonardo Pavón','Ornella Carrizo',
  'Mateo Solís','Renata Galván','Franco Brizuela','Magalí Núñez','Esteban Ramos',
  'Yamila Ávila','Cristian Lazarte','Brenda Frizán','Damián Sandoval','Tatiana Cortés',
  'Walter Ojeda','Paula Alvarez','Gustavo Méndez','Natalia Toledo','Ricardo Bordón',
  'Estefanía Roldán','Marcos Garmendia','Vanesa Mansur','Alejo Pinedo','Constanza Bravo',
];

const RANGOS_ETARIOS = ['18-25', '26-35', '36-45', '46-55', '56+'];
const TIPOS_CLIENTE = ['Premium', 'Estándar', 'Corporativo', 'Pyme', 'Particular'];
const ACUERDOS = ['Estándar', 'Preferencial', 'Plata', 'Oro', 'Platino'];
const CUOTAS = [3, 6, 9, 12, 18, 24, 36, 48];

const rand = (seed) => { let s = seed; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; };

const generateCUIL = (r) => {
  const sex = r() > 0.5 ? 20 : 27;
  const dni = String(Math.floor(20000000 + r() * 30000000)).padStart(8, '0');
  const dv = Math.floor(r() * 10);
  return `${sex}-${dni}-${dv}`;
};

const REGISTROS = (() => {
  const r = rand(42);
  const out = [];
  for (let i = 0; i < 124; i++) {
    const analista = ANALISTAS[Math.floor(r() * ANALISTAS.length)];
    const estado = ESTADOS[Math.floor(r() * ESTADOS.length)];
    const score = Math.floor(r() * 100);
    const monto = Math.floor((r() * 9 + 0.5) * 1000000);
    const fechaBase = new Date(2026, 0, 1).getTime();
    const fecha = new Date(fechaBase + Math.floor(r() * 140) * 86400000);
    const fechaScore = new Date(fecha.getTime() - Math.floor(r() * 60) * 86400000);
    const loc = LOCALIDADES[Math.floor(r() * LOCALIDADES.length)];
    out.push({
      id: 'R-' + String(1000 + i),
      cuil: generateCUIL(r),
      nombre: NOMBRES[i % NOMBRES.length],
      analistaId: analista.id,
      analista: analista.nombre,
      estado, monto,
      fecha: fecha.toISOString(),
      fechaScore: fechaScore.toISOString(),
      score,
      tipoCliente: TIPOS_CLIENTE[Math.floor(r() * TIPOS_CLIENTE.length)],
      acuerdo: ACUERDOS[Math.floor(r() * ACUERDOS.length)],
      cuotas: CUOTAS[Math.floor(r() * CUOTAS.length)],
      rangoEtario: RANGOS_ETARIOS[Math.floor(r() * RANGOS_ETARIOS.length)],
      sexo: r() > 0.5 ? 'F' : 'M',
      empleador: EMPLEADORES[Math.floor(r() * EMPLEADORES.length)],
      cp: loc.cp,
      localidad: loc.nombre,
      comentarios: r() > 0.7 ? 'Cliente recurrente. Solicita revisión de tasa.' : '',
    });
  }
  return out;
})();

const AUDIT = [
  { ts: '2026-05-24T14:32:00', user: 'Luciana Romero',  action: 'Aprobó',     target: 'R-1087', kind: 'green', desc: 'Operación aprobada — $4.250.000 a 24 cuotas' },
  { ts: '2026-05-24T14:18:00', user: 'Victoria Suárez', action: 'Editó',      target: 'R-1102', kind: 'blue',  desc: 'Actualizó score: 64 → 78' },
  { ts: '2026-05-24T13:55:00', user: 'Sistema',         action: 'Detectó',    target: '3 registros', kind: 'red', desc: 'Posibles duplicados por CUIL' },
  { ts: '2026-05-24T13:42:00', user: 'Luciana Romero',  action: 'Creó',       target: 'R-1115', kind: 'blue',  desc: 'Nuevo registro · Tipo Premium' },
  { ts: '2026-05-24T13:21:00', user: 'Victoria Suárez', action: 'Comentó',    target: 'R-1054', kind: 'blue',  desc: '"Cliente solicita extensión a 36 cuotas"' },
  { ts: '2026-05-24T12:48:00', user: 'Luciana Romero',  action: 'Rechazó',    target: 'R-1098', kind: 'red',   desc: 'Score insuficiente · Riesgo elevado' },
  { ts: '2026-05-24T11:32:00', user: 'Sistema',         action: 'Sincronizó', target: 'Bureau de crédito', kind: 'blue', desc: '42 scores actualizados' },
  { ts: '2026-05-24T10:14:00', user: 'Victoria Suárez', action: 'Exportó',    target: 'Reporte Q2', kind: 'blue',  desc: 'PDF · 247 registros' },
];

const ALERTAS = [
  { id: 'al1', titulo: 'Score vencido en 12 registros',  sub: 'Última actualización hace +60 días',  level: 'red',   read: false, time: 'Hace 8 min',   icon: 'warning' },
  { id: 'al2', titulo: 'Objetivo mensual al 78%',         sub: 'Faltan 6 días para el cierre',         level: 'amber', read: false, time: 'Hace 22 min',  icon: 'target' },
  { id: 'al3', titulo: '3 duplicados detectados por CUIL', sub: 'Revisar en Corrector Masivo',          level: 'red',   read: false, time: 'Hace 1 h',     icon: 'merge' },
  { id: 'al4', titulo: 'Backup automático completado',     sub: '2.4 GB · 124k registros',              level: 'green', read: true,  time: 'Hace 3 h',     icon: 'shield' },
  { id: 'al5', titulo: '5 clientes sin seguimiento +15d',  sub: 'Reasignar a otro analista',            level: 'amber', read: false, time: 'Hace 4 h',     icon: 'user'  },
  { id: 'al6', titulo: 'Riesgo alto · 8 nuevos casos',     sub: 'Score < 35 en operaciones >$3M',       level: 'red',   read: true,  time: 'Ayer 17:22',   icon: 'warning' },
  { id: 'al7', titulo: 'Importación CSV completada',       sub: '482 registros · 12 con error',          level: 'blue',  read: true,  time: 'Ayer 09:14',   icon: 'upload' },
  { id: 'al8', titulo: 'Configuración de feriados',        sub: 'Recordatorio: cargar feriados 2026 H2', level: 'blue',  read: true,  time: 'Hace 2 días',  icon: 'cal' },
];

Object.assign(window, { ANALISTAS, EMPLEADORES, LOCALIDADES, ESTADOS, NOMBRES, RANGOS_ETARIOS, TIPOS_CLIENTE, ACUERDOS, CUOTAS, REGISTROS, AUDIT, ALERTAS });
