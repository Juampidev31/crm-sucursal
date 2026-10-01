import { Outfit } from 'next/font/google';

export const outfit = Outfit({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-outfit',
});

/** Canvas charts cannot resolve CSS custom properties in `ctx.font`. */
export const UI_FONT_FAMILY = `"App Numeric", ${outfit.style.fontFamily}, sans-serif`;
