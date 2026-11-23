"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Search, Store } from "lucide-react";
import { clsx } from "clsx";
import { puedeSalir } from "@/lib/unsaved-guard";
import { INPUT_NATIVO_HOLGADO } from "./ui/clases";
import type { Destino } from "./panel-nav";

/**
 * Un negocio que se puede abrir en el panel.
 *
 * `esPrueba` distingue el negocio de prueba de los reales. No es decoración: el
 * fixture no está en `places` y sus datos no son de nadie, así que confundirlo
 * con un negocio propio al editar sería escribir en la ficha equivocada.
 *
 * `esPropio` dice si la cuenta es dueña de verdad. Una cuenta administradora
 * recibe aquí **todos** los negocios de la app (puede abrirlos y editarlos sin
 * asignarse como dueño), y sin esta marca el selector le diría «Tu negocio» a
 * cincuenta negocios ajenos.
 */
export interface NegocioPanel {
  id: string;
  nombre: string;
  esPrueba: boolean;
  esPropio: boolean;
}

/** Cuántos negocios caben a la vista antes de que la lista tenga scroll. */
const FILAS_VISIBLES = 5;

/**
 * Cuántos negocios se consultan para el contador de pedidos.
 *
 * Se pregunta uno por negocio al abrir la hoja. Con la lista entera de la
 * plataforma —la de una cuenta administradora— serían cientos de peticiones de
 * golpe, así que por encima de este tope la hoja solo sirve para cambiar: el
 * contador es para la lista corta de un dueño.
 */
const CONSULTAR_PENDIENTES_HASTA = 12;

/** Sin tildes ni mayúsculas: «cafe» encuentra «Café». */
function sinTildes(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

/**
 * La lista de negocios, que va dentro de la hoja que abre el nombre del negocio
 * en la barra superior.
 *
 * Antes era un desplegable encima de cada vista («Estás en…») y en la cabecera
 * del dashboard. Ahora vive en un solo sitio y solo existe con dos o más
 * negocios: con uno, el nombre de la barra no es tocable.
 *
 * Para una cuenta administradora la lista es la de **toda** la app y lleva un
 * buscador por nombre arriba: en cuanto hay más de cinco negocios, encontrar
 * uno a mano en una lista alfabética de cientos es peor que escribir tres
 * letras. La altura se corta a cinco filas y el resto se recorre con scroll,
 * para que la hoja no se coma la pantalla.
 *
 * La elección viaja en `?negocio=`, no en un estado de React: sobrevive al
 * `router.refresh()` que disparan los guardados y deja el negocio señalado en
 * un marcador. Se conserva la sección (y la subsección) en la que se estaba; si
 * esta cuenta no puede abrirla en el otro negocio, el armazón cae a Hoy.
 *
 * `router.replace` y no `push`: la entrada de la hoja ya está en el historial,
 * y el atrás tiene que volver a la pantalla de antes, no a la hoja.
 */
export function ListaNegocios({
  negocios,
  seleccionado,
  destino,
  onCerrar,
}: {
  negocios: NegocioPanel[];
  seleccionado: string;
  destino: Destino;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const listaRef = useRef<HTMLUListElement>(null);
  const [busqueda, setBusqueda] = useState("");
  const consulta = sinTildes(busqueda);
  const visibles = consulta
    ? negocios.filter((negocio) => sinTildes(negocio.nombre).includes(consulta))
    : negocios;

  /* Lo que espera en cada negocio: sus pedidos pendientes, con el mismo
     endpoint ligero que el contador del dock. Se pregunta al abrir la hoja (la
     lista solo se monta entonces), uno por negocio —una cuenta tiene dos o
     tres—. Sin permiso de pedidos en un negocio, ese no dice nada.

     Con la lista larga de administración no se pregunta: cientos de peticiones
     de golpe al abrir la hoja no compensan un contador que nadie va a mirar. */
  const [pendientes, setPendientes] = useState<Record<string, number>>({});
  useEffect(() => {
    if (negocios.length > CONSULTAR_PENDIENTES_HASTA) return;
    let vivo = true;
    for (const negocio of negocios) {
      void fetch(`/api/pedidos/pendientes?placeId=${encodeURIComponent(negocio.id)}`)
        .then((res) => (res.ok ? (res.json() as Promise<{ pendientes?: number }>) : null))
        .then((data) => {
          if (vivo && data?.pendientes) {
            setPendientes((p) => ({ ...p, [negocio.id]: data.pendientes ?? 0 }));
          }
        })
        .catch(() => {
          /* Sin red, sin cifra: la lista sigue sirviendo para cambiar. */
        });
    }
    return () => {
      vivo = false;
    };
  }, [negocios]);

  const cambiar = (id: string) => {
    if (id === seleccionado) {
      onCerrar();
      return;
    }
    /* Cambiar de negocio desmonta la vista en curso, y las secciones con
       trabajo sin guardar se apagan con ella: la guardia pregunta aquí. */
    if (!puedeSalir()) return;
    const params = new URLSearchParams({ negocio: id });
    if (destino.seccion !== "dashboard") params.set("seccion", destino.seccion);
    if (destino.sub) params.set("sub", destino.sub);
    router.replace(`/business?${params.toString()}`);
  };

  return (
    <div className="flex flex-col gap-gap-sm">
      {/* Con un solo negocio no hay nada que buscar; el buscador es de la
          lista larga, la de administración. */}
      {negocios.length > FILAS_VISIBLES && (
        <div className="relative">
          <Search
            size={16}
            strokeWidth={1.8}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft/50"
            aria-hidden
          />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              /* Si se venía con la lista desplazada, el resultado nuevo se lee
                 desde arriba en vez de a media lista. */
              if (listaRef.current) listaRef.current.scrollTop = 0;
            }}
            placeholder="Buscar negocio por nombre"
            aria-label="Buscar negocio por nombre"
            className={clsx(INPUT_NATIVO_HOLGADO, "pl-10")}
          />
        </div>
      )}

      {visibles.length === 0 ? (
        <p className="rounded-2xl border border-ink/10 bg-white px-gap-md py-gap-sm text-small text-ink-soft/75">
          Ningún negocio se llama «{busqueda.trim()}».
        </p>
      ) : (
        <ul
          ref={listaRef}
          className={clsx(
            "scrollbar-fino flex flex-col gap-gap-xs",
            /* Cinco filas de ~56 px más sus cuatro huecos de 8 px: a partir de
               ahí, scroll dentro de la hoja en vez de una lista sin fondo. */
            visibles.length > FILAS_VISIBLES &&
              "max-h-[312px] overflow-y-auto overscroll-contain pr-[2px]",
          )}
        >
          {visibles.map((negocio) => {
            const activo = negocio.id === seleccionado;
            return (
              <li key={negocio.id}>
                <button
                  type="button"
                  onClick={() => cambiar(negocio.id)}
                  aria-current={activo ? "true" : undefined}
                  className={clsx(
                    "flex min-h-11 w-full cursor-pointer items-center gap-gap-sm rounded-2xl border px-gap-md py-gap-xs text-left transition-colors duration-500 ease-outquint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400/40",
                    activo
                      ? "border-verde-200 bg-verde-50"
                      : "border-ink/10 bg-white hover:border-verde-300",
                  )}
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-verde-50 text-verde-600">
                    <Store size={18} strokeWidth={1.8} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-lv-display text-small font-semibold text-ink">
                      {negocio.nombre}
                    </span>
                    <span className="block text-meta text-ink-soft/75">
                      {negocio.esPrueba
                        ? "Negocio de prueba"
                        : negocio.esPropio
                          ? "Tu negocio"
                          : "Administración"}
                      {pendientes[negocio.id]
                        ? ` · ${pendientes[negocio.id]} ${pendientes[negocio.id] === 1 ? "pedido pendiente" : "pedidos pendientes"}`
                        : ""}
                    </span>
                  </span>
                  {activo && (
                    <Check size={18} strokeWidth={2} className="shrink-0 text-verde-600" aria-hidden />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
