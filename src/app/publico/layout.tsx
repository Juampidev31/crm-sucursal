import type { Metadata } from "next";
import "../../globals.css";
import { supabase } from "@/lib/supabase";
import ResumenMensualPublico from "./ResumenMensualPublico";

export const metadata: Metadata = {
  title: "Resumen Mensual - Sistema de Ventas",
  description: "Reporte mensual de ventas y proyecciones",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
