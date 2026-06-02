import { NextRequest, NextResponse } from 'next/server';
import { utils, write } from 'xlsx';
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
      .select('nombre,cuil,analista,estado,monto,fecha,puntaje,es_re,tipo_cliente,acuerdo_precios,cuotas,rango_etario,sexo,empleador,dependencia,localidad,comentarios,fecha_score,created_at')
      .order('fecha', { ascending: false });
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
  let all: Record<string, unknown>[] = [];
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

  const ws = utils.json_to_sheet(all);
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, 'Registros');
  const buffer = write(wb, { type: 'buffer', bookType: 'xlsx' });

  const today = new Date().toISOString().slice(0, 10);
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="registros-${today}.xlsx"`,
    },
  });
}
