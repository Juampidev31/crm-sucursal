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

  const { fechaDesde, fechaHasta, empleador, estados, analista } = await req.json() as {
    fechaDesde?: string;
    fechaHasta?: string;
    empleador?: string;
    estados?: string[];
    analista?: string;
  };

  const buildQuery = () => {
    let q = supabase
      .from('registros')
      .select('nombre,cuil,analista,estado,monto,fecha,puntaje,es_re,tipo_cliente,acuerdo_precios,cuotas,rango_etario,sexo,empleador,dependencia,localidad,comentarios')
      .order('fecha', { ascending: false });
    if (fechaDesde) q = q.gte('fecha', fechaDesde);
    if (fechaHasta) q = q.lte('fecha', fechaHasta);
    if (empleador?.trim()) q = q.ilike('empleador', `%${empleador.trim()}%`);
    if (estados && estados.length > 0) q = q.in('estado', estados);
    if (analista?.trim()) q = q.eq('analista', analista.trim());
    return q;
  };

  const PAGE = 1000;
  const SAFETY_LIMIT = 100000;
  const all: Record<string, unknown>[] = [];
  let from = 0;
  while (from < SAFETY_LIMIT) {
    const { data: chunk, error } = await buildQuery().range(from, from + PAGE - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!chunk || chunk.length === 0) break;
    all.push(...chunk);
    if (chunk.length < PAGE) break;
    from += PAGE;
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
