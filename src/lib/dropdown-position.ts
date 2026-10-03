// Posición de un panel desplegable que se renderiza en un portal sobre <body>.
//
// Los selects viven dentro de modales cuyo cuerpo tiene `overflow-y: auto` y el
// contenedor `overflow: hidden`: un panel `position: absolute` queda recortado
// por esos ancestros, y subirle el z-index no ayuda porque el recorte no es un
// problema de apilado. Por eso el panel se saca del modal y se posiciona fijo
// contra la pantalla, con estas coordenadas.

export type RectTrigger = { top: number; bottom: number; left: number; width: number };
export type Viewport = { ancho: number; alto: number };

export type PosicionDropdown = {
  top: number;
  left: number;
  width: number;
  /** Si es true el panel se ancla por abajo (se dibuja hacia arriba del trigger). */
  haciaArriba: boolean;
  /** Alto máximo que puede ocupar la lista sin salirse de la pantalla. */
  maxAlto: number;
};

const MARGEN = 8;          // aire contra los bordes de la pantalla
const SEPARACION = 4;      // separación entre el trigger y el panel
const ALTO_BUSCADOR = 56;  // el campo de búsqueda come lugar de la lista
const MIN_ALTO = 120;      // por debajo de esto el panel no se puede usar

export function calcularPosicionDropdown(
  trigger: RectTrigger,
  viewport: Viewport,
  { conBuscador }: { conBuscador: boolean },
): PosicionDropdown {
  const espacioAbajo = viewport.alto - trigger.bottom - MARGEN - SEPARACION;
  const espacioArriba = trigger.top - MARGEN - SEPARACION;

  // Se abre hacia abajo salvo que no entre y arriba haya más lugar.
  const haciaArriba = espacioAbajo < MIN_ALTO && espacioArriba > espacioAbajo;
  const disponible = haciaArriba ? espacioArriba : espacioAbajo;

  const width = Math.min(trigger.width, viewport.ancho - MARGEN * 2);
  const left = Math.min(Math.max(trigger.left, MARGEN), viewport.ancho - width - MARGEN);

  return {
    top: haciaArriba ? trigger.top - SEPARACION : trigger.bottom + SEPARACION,
    left,
    width,
    haciaArriba,
    maxAlto: Math.max(MIN_ALTO, disponible - (conBuscador ? ALTO_BUSCADOR : 0)),
  };
}
