"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Logo } from "@/components/layout/logo";

/**
 * La marca de La Verde en la cabecera de la carta.
 *
 * A dónde lleva depende de por dónde se entró, y eso lo dice `?volver`, que
 * ponen los dos sitios que enlazan a la carta:
 *
 * - `panel` — el enlace «Ver mi carta» del panel del negocio. Devuelve al panel
 *   de ese negocio, que es donde estaba quien la abrió.
 * - `home` — el enlace «Ver la carta» de una ficha, **y solo si quien mira
 *   tiene sesión**. Vuelve al inicio.
 * - sin marca — el QR de la mesa o un enlace compartido. A la portada pública:
 *   quien acaba de barrer un QR no tiene panel al que volver, y las dos rutas
 *   de arriba son puertas cerradas que le pedirían una cuenta que no tiene.
 *
 * La carta se sirve cacheada para todos (`revalidate = 300`), así que el
 * servidor no puede saber quién mira. Por eso el aviso viaja en la URL y se lee
 * aquí, en el navegador: leerlo en el servidor convertiría la carta en una
 * página por visita y le quitaría la caché justo a quien la abre desde un QR
 * con datos móviles, que es quien más la necesita.
 *
 * Se lee en un efecto y no en el primer render: el HTML llega del servidor, y
 * leer la URL antes de tiempo descuadra la hidratación. Al cambiar no se ve
 * nada; lo único que cambia es a dónde apunta.
 */
export function MarcaCarta({ panelHref }: { panelHref: string }) {
  const [href, setHref] = useState("/");

  useEffect(() => {
    const volver = new URLSearchParams(window.location.search).get("volver");
    if (volver === "panel") setHref(panelHref);
    else if (volver === "home") setHref("/home");
  }, [panelHref]);

  return (
    <Link
      href={href}
      className="inline-flex shrink-0 items-center gap-gap-xs font-lv-display text-small font-semibold text-verde-700 transition-colors duration-500 ease-outquint hover:text-verde-600"
    >
      <Logo className="h-[20px] w-auto shrink-0" />
      La Verde
      <ArrowUpRight size={13} strokeWidth={2} className="shrink-0" />
    </Link>
  );
}
