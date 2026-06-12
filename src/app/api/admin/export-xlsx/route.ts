import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

function isAdminSession(req: NextRequest): boolean {
  const header = req.headers.get('x-session');
  if (!header) return false;
  try {
    const session = JSON.parse(header);
    return session?.rol === 'admin';
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  if (!isAdminSession(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { fechaDesde, fechaHasta, empleador, estados, analista, preview, search, montoMin, montoMax, fechaScoreDesde, fechaScoreHasta, scoreMin, scoreMax, tipoCliente, acuerdoPrecios, tipoAlerta } = await req.json() as {
    fechaDesde?: string;
    fechaHasta?: string;
    empleador?: string;
    estados?: string[];
    analista?: string;
    preview?: boolean;
    search?: string;
    montoMin?: string;
    montoMax?: string;
    fechaScoreDesde?: string;
    fechaScoreHasta?: string;
    scoreMin?: string;
    scoreMax?: string;
    tipoCliente?: string[];
    acuerdoPrecios?: string[];
    tipoAlerta?: string[];
  };

  const buildQuery = () => {
    let q = supabase
      .from('registros')
      .select('nombre,cuil,analista,estado,monto,fecha,puntaje,tipo_cliente,acuerdo_precios,empleador,dependencia,localidad,comentarios,created_at')
      .order('fecha', { ascending: true });
    if (fechaDesde) q = q.gte('fecha', fechaDesde);
    if (fechaHasta) q = q.lte('fecha', fechaHasta);
    if (empleador?.trim()) q = q.ilike('empleador', `%${empleador.trim()}%`);
    if (estados && estados.length > 0) q = q.in('estado', estados);
    if (analista?.trim()) q = q.eq('analista', analista.trim());
    if (montoMin) q = q.gte('monto', montoMin);
    if (montoMax) q = q.lte('monto', montoMax);
    if (fechaScoreDesde) q = q.gte('fecha_score', fechaScoreDesde);
    if (fechaScoreHasta) q = q.lte('fecha_score', fechaScoreHasta);
    if (scoreMin) q = q.gte('puntaje', scoreMin);
    if (scoreMax) q = q.lte('puntaje', scoreMax);
    if (tipoCliente && tipoCliente.length > 0) q = q.in('tipo_cliente', tipoCliente);
    if (acuerdoPrecios && acuerdoPrecios.length > 0) q = q.in('acuerdo_precios', acuerdoPrecios);
    return q;
  };

  const PAGE = 1000;
  const SAFETY_LIMIT = 100000;
  let all: Record<string, any>[] = [];
  let from = 0;
  while (from < SAFETY_LIMIT) {
    const { data: chunk, error } = await buildQuery().range(from, from + PAGE - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!chunk || chunk.length === 0) break;
    all.push(...chunk);
    if (chunk.length < PAGE) break;
    from += PAGE;
  }

  // Memory filters (Search & Alertas)
  if (search || (tipoAlerta && tipoAlerta.length > 0)) {
    const s = search ? search.toLowerCase() : '';
    let alertasConfig: any[] = [];
    if (tipoAlerta && tipoAlerta.length > 0) {
       const { data } = await supabase.from('alertas_config').select('*');
       if (data) alertasConfig = data;
    }
    const nowTime = new Date().getTime();

    all = all.filter(r => {
      // General Search
      if (s) {
        const text = `${r.nombre || ''}|${r.cuil || ''}|${r.analista || ''}|${r.empleador || ''}|${r.estado || ''}|${r.localidad || ''}|${r.dependencia || ''}|${r.comentarios || ''}`.toLowerCase();
        if (!text.includes(s)) return false;
      }
      
      // Tipo Alerta
      if (tipoAlerta && tipoAlerta.length > 0 && alertasConfig.length > 0) {
        const config = alertasConfig.find(a => a.estado.toLowerCase() === String(r.estado || '').toLowerCase());
        if (!config || !tipoAlerta.includes(config.nombre)) return false;
        const dateStr = (r.fecha || r.created_at) as string;
        if (!dateStr) return false;
        const daysDiff = Math.floor((nowTime - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff < config.dias) return false;
      }

      return true;
    });
  }

  if (preview) {
    const registros = all.map(r => ({
      nombre: r.nombre,
      cuil: r.cuil,
      analista: r.analista,
      estado: r.estado,
      fecha: r.fecha,
      empleador: r.empleador,
      dependencia: r.dependencia,
    }));
    return NextResponse.json({ total: all.length, registros });
  }

  // Generación del Excel con ExcelJS
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Registros');

  // Definir las columnas
  worksheet.columns = [
    { header: 'Fecha', key: 'fecha', width: 25 },
    { header: 'Nombre', key: 'nombre', width: 36.71 },
    { header: 'CUIL', key: 'cuil', width: 25 },
    { header: 'Monto', key: 'monto', width: 25 },
    { header: 'Analista', key: 'analista', width: 25 },
    { header: 'Estado', key: 'estado', width: 25 },
    { header: 'Score', key: 'puntaje', width: 25 },
    { header: 'Empleador', key: 'empleador', width: 25 },
    { header: 'Tipo Cliente', key: 'tipo_cliente', width: 25 },
    { header: 'Acuerdo Precios', key: 'acuerdo_precios', width: 25 },
    { header: 'Comentarios', key: 'comentarios', width: 25 },
  ];

  // Formatear datos antes de agregar
  const formattedData = all.map(r => {
    // Convertir fecha de string a Date object para que Excel lo detecte nativamente
    let fechaFormat: Date | string = r.fecha;
    if (r.fecha && typeof r.fecha === 'string') {
      // Si la fecha incluye hora (ej. de supabase timestamp), solo tomar la parte de fecha
      const datePart = r.fecha.split('T')[0];
      const parts = datePart.split('-');
      if (parts.length === 3) {
        // new Date(year, monthIndex, day)
        fechaFormat = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      }
    }

    return {
      ...r,
      fecha: fechaFormat,
      // Convertir CUIL a Number para evitar advertencia de texto en Excel
      cuil: r.cuil ? Number(r.cuil) : null,
      monto: r.monto ? Number(r.monto) : null,
      puntaje: r.puntaje ? Number(r.puntaje) : null,
    };
  });

  // Agregar filas
  worksheet.addRows(formattedData);

  // Aplicar estilos a las filas
  worksheet.eachRow((row, rowNumber) => {
    row.eachCell((cell, colNumber) => {
      // Fuente Outfit, centrada
      cell.font = { name: 'Outfit', size: 11 };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };

      // Formato de fecha para la primera columna
      if (rowNumber > 1 && colNumber === 1) {
        cell.numFmt = 'dd/mm/yyyy';
      }

      // Formato para evitar notación científica en CUIL (columna 3)
      if (rowNumber > 1 && colNumber === 3) {
        cell.numFmt = '0';
      }

      // Formato de moneda para la columna Monto (columna 4)
      if (rowNumber > 1 && colNumber === 4) {
        cell.numFmt = '"$"#,##0.00';
      }

      // Estilo especial para la cabecera (Fila 1)
      if (rowNumber === 1) {
        cell.font = { name: 'Outfit', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF059669' } // Emerald 600
        };
      }
    });
  });


  const buffer = await workbook.xlsx.writeBuffer();

  const today = new Date().toISOString().slice(0, 10);
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="registros-${today}.xlsx"`,
    },
  });
}

