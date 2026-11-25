import { History } from "lucide-react";
import {
  contarActividad,
  listarActividad,
  type RangoActividad,
} from "@/lib/admin-actividad";
import { ChapitaEstado } from "@/components/admin/ui/chapita";
import {
  EstadoVacioAdmin,
  FilaLista,
  TarjetaAdmin,
  TarjetaKpi,
} from "@/components/admin/ui/tarjeta";
import { FiltroRangoActividad } from "@/components/admin/actividad/filtro-rango";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Actividad · Administración",
  robots: { index: false, follow: false },
};

const ETIQUETA_OBJETO: Record<string, string> = {
  negocio: "Negocio",
  publicacion: "Publicación",
  usuario: "Usuario",
  soporte: "Soporte",
  plan: "Plan",
  suscripcion: "Suscripción",
  afiliado: "Afiliado",
  cobro_afiliado: "Afiliado",
  proyecto: "Proyecto",
  categoria: "Categoría",
  proveedor_ia: "Proveedor IA",
  vinculo: "Vínculo",
  sistema: "Sistema",
};

const RANGO_TEXTO: Record<RangoActividad, string> = {
  "24h": "las últimas 24 horas",
  "7d": "los últimos 7 días",
  todo: "todo el registro",
};

const formatoFecha = new Intl.DateTimeFormat("es-CU", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Havana",
});

/**
 * El registro de actividad del panel.
 *
 * La Fase 17 añadirá los filtros por administrador, tipo y fecha; aquí está la
 * lista que hace visible lo que la Fase 1 registra, con el rango en la URL. Sin
 * entradas no se pinta una tabla vacía: se explica qué escribe en ella.
 */
export default async function ActividadPage({
  searchParams,
}: {
  searchParams: Promise<{ rango?: string }>;
}) {
  const params = await searchParams;
  const rango: RangoActividad =
    params.rango === "7d" || params.rango === "todo" ? params.rango : "24h";

  const [entradas, total] = await Promise.all([
    listarActividad({ rango }),
    contarActividad(rango),
  ]);

  return (
    <>
      <div className="mb-gap-md flex flex-wrap items-end justify-between gap-gap-sm">
        <div>
          <h1 className="font-lv-display text-h3 font-bold tracking-[-0.02em] text-ink">
            Actividad
          </h1>
          <p className="mt-gap-xs text-small text-ink-soft/75">
            Quién cambió qué, con fecha y hora de La Habana.
          </p>
        </div>
        <FiltroRangoActividad />
      </div>

      <div className="mb-gap-md grid grid-cols-2 gap-gap-sm sm:max-w-[420px]">
        <TarjetaKpi
          etiqueta="Entradas"
          valor={total}
          detalle={`En ${RANGO_TEXTO[rango]}`}
          icono={History}
        />
        <TarjetaKpi
          etiqueta="¿Quién?"
          valor={
            <span className="text-body leading-tight break-words">
              {entradas[0]?.adminNombre ?? "—"}
            </span>
          }
          detalle={
            entradas[0] ? "Última acción registrada" : "Sin actividad todavía"
          }
        />
      </div>

      <TarjetaAdmin className="p-0">
        {entradas.length === 0 ? (
          <EstadoVacioAdmin
            icono={History}
            titulo="Sin actividad en este rango"
            descripcion="Aprobar, rechazar, cambiar un plan o enviar un aviso deja una entrada aquí. Prueba con un rango más amplio."
          />
        ) : (
          <div className="px-gap-md">
            {entradas.map((entrada) => (
              <FilaLista
                key={entrada.id}
                inicio={
                  <span className="grid size-9 place-items-center rounded-full bg-verde-50 text-verde-700">
                    <History size={16} strokeWidth={1.8} aria-hidden />
                  </span>
                }
                titulo={entrada.resumen}
                detalle={`${entrada.adminNombre} · ${formatoFecha.format(entrada.creadoEn)}`}
                fin={
                  <ChapitaEstado tono="info" punto={false}>
                    {ETIQUETA_OBJETO[entrada.objetoTipo] ?? entrada.objetoTipo}
                  </ChapitaEstado>
                }
              />
            ))}
          </div>
        )}
      </TarjetaAdmin>
    </>
  );
}
