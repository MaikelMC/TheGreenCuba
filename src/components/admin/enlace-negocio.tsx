"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Un nombre de negocio que abre su ficha 360.
 *
 * La ficha vive en la URL (`?negocio=<id>`), así que este enlace conserva la
 * ruta y los parámetros actuales y solo cambia ese. Se usa en las listas para
 * que el mismo gesto funcione en Negocios, Solicitudes y Publicaciones.
 *
 * `stopPropagation` es necesario en las tarjetas que ya abren su propio detalle
 * al tocarlas: sin esto, el clic en el nombre dispararía las dos cosas.
 */
export function EnlaceNegocio({
  id,
  children,
  className,
  title,
}: {
  id: string;
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = new URLSearchParams(searchParams.toString());
  params.set("negocio", id);

  return (
    <Link
      href={`${pathname}?${params.toString()}`}
      scroll={false}
      className={className}
      title={title}
      onClick={(event) => event.stopPropagation()}
    >
      {children}
    </Link>
  );
}
