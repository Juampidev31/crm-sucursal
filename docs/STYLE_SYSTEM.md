# Sistema visual

## Dirección adoptada

La interfaz usa un tema editorial claro: fondo marfil, tarjetas de papel,
texto azul tinta, acento azul petróleo y un acento secundario terracota.
Newsreader se reserva para títulos, Outfit para la interfaz y Geist Mono para
datos monoespaciados.

## Fuente de verdad

`src/app/tokens.css` contiene las primitivas y los tokens semánticos. Los
componentes deben elegir tokens por intención:

- superficies: `--surface-*`;
- texto: `--text-*`;
- bordes y elevación: `--border-*`, `--shadow-*`;
- acciones y feedback: `--accent-*`, `--success-*`, `--warning-*`, `--danger-*`;
- gráficos: `--chart-*`;
- tipografía y geometría: `--font-*`, `--space-*`, `--radius-*`.

Los aliases del sistema anterior se conservan temporalmente para compatibilidad,
pero apuntan al tema claro. No se deben agregar nuevos colores literales en los
componentes salvo colores de datos externos o APIs Canvas.

Canvas no interpreta `var(--token)`. Antes de entregar un token a
`CanvasGradient.addColorStop`, debe resolverse con
`resolveCssColor` desde `src/lib/css-color.ts`.
