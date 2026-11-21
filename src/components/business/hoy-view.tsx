"use client";

/**
 * «Hoy»: la pantalla de entrada del panel. Sustituye al dashboard.
 *
 * De arriba abajo, lo que un dueño con prisa viene a resolver:
 * 1. **Necesita tu atención** — avisos calculados en el servidor (`avisosHoy`),
 *    cada uno con la acción que lo resuelve. Sin avisos, «Todo al día».
 * 2. **Acciones rápidas** — tasa del día, «Hoy hay», dar sello y nueva oferta,
 *    cada una en su hoja. Solo las que la cuenta puede usar.
 * 3. **Este mes** — las cifras de siempre, compactas; los 7 días, plegados.
 * 4. **Tu menú online** — compartir, ver la carta y descargar el QR.
 *
 * Tras cada acción se pide `router.refresh()` para que los avisos se recalculen.
 */

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  ChevronDown,
  ClipboardList,
  Coins,
  Eye,
  Gift,
  Megaphone,
  MousePointerClick,
  Package,
  PackageX,
  Pencil,
  Search,
  Sparkles,
  Stamp,
  Tag,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { clsx } from "clsx";
import type { Funcion } from "@/lib/plans";
import type { PermisoNegocio } from "@/lib/permisos-negocio";
import type { UserPlace } from "@/lib/places-store";
import type { VisitasPanel } from "@/lib/eventos";
import type { AvisoHoy } from "@/lib/hoy-server";
import { estaAgotado } from "@/lib/disponibilidad";
import { DashboardStats } from "./dashboard-stats";
import { MenuLinkCard } from "./menu-link-card";
import { TasaDelDiaCard } from "./tasa-del-dia-card";
import { DarSello } from "./dar-sello";
import { OfertaRapida } from "./oferta-rapida";
import { BotonSecundario } from "./ui/botones";
import { Chapita, TarjetaPanel } from "./ui/tarjeta";
import { HojaPanel } from "./ui/hoja-panel";
import { usePanelNav, type Destino } from "./panel-shell";

const FECHA = new Intl.DateTimeFormat("es-CU", {
  timeZone: "America/Havana",
  weekday: "long",
  day: "numeric",
  month: "long",
});

/** «hace 5 min», «hace 2 h», «hace 3 días». */
function haceCuanto(desdeIso: string, ahora: number): string {
  const min = Math.max(0, Math.round((ahora - new Date(desdeIso).getTime()) / 60_000));
  if (min < 1) return "ahora mismo";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return `hace ${d} ${d === 1 ? "día" : "días"}`;
}

interface FilaAviso {
  clave: string;
  icono: LucideIcon;
  titulo: string;
  detalle: string;
  accion: { texto: string; destino?: Destino; onClick?: () => void };
  ambar?: boolean;
}

export function HoyView({
  place,
  stats,
  visitas,
  publicaciones,
  menuUrl,
  funciones,
  esDueno,
  permisos,
  avisos,
}: {
  place: UserPlace;
  stats: { aiMatches: number };
  visitas: VisitasPanel;
  publicaciones: { usadas: number; tope: number };
  menuUrl: string;
  funciones: Funcion[];
  esDueno: boolean;
  permisos: PermisoNegocio[];
  avisos: AvisoHoy[];
}) {
  const nav = usePanelNav();
  const router = useRouter();
  const puede = (p: PermisoNegocio) => esDueno || permisos.includes(p);
  const tiene = (f: Funcion) => funciones.includes(f);

  /* La hora del navegador se fija tras montar: con `Date.now()` en el render,
     servidor y cliente pintaban «hace X» distintos. */
  const [ahora, setAhora] = useState<number | null>(null);
  useEffect(() => setAhora(Date.now()), []);

  const [canjeando, setCanjeando] = useState<string | null>(null);

  async function canjear(aviso: Extract<AvisoHoy, { tipo: "premio" }>) {
    const quien = aviso.nombre?.trim() || aviso.telefonoEnmascarado;
    /* El canje no tiene inversa: se pregunta antes, y no hay «Deshacer». */
    if (!window.confirm(`¿Canjear «${aviso.premio}» para ${quien}?`)) return;
    setCanjeando(aviso.clienteId);
    try {
      const res = await fetch(
        `/api/places/${place.id}/clientes-frecuentes/${aviso.clienteId}/canje`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ metaIndice: aviso.metaIndice }),
        },
      );
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        toast.error(data?.error ?? "No se pudo canjear el premio.");
        return;
      }
      toast.success(`Premio canjeado: ${aviso.premio}`);
      router.refresh();
    } catch {
      toast.error("No se pudo canjear. Revisa la conexión.");
    } finally {
      setCanjeando(null);
    }
  }

  const filas: FilaAviso[] = avisos.flatMap((aviso): FilaAviso[] => {
    switch (aviso.tipo) {
      case "pedidos":
        return [
          {
            clave: "pedidos",
            icono: ClipboardList,
            titulo:
              aviso.pendientes === 1
                ? "1 pedido pendiente"
                : `${aviso.pendientes} pedidos pendientes`,
            detalle: ahora
              ? `El más antiguo entró ${haceCuanto(aviso.masAntiguo, ahora)}`
              : "Esperan que los atiendas",
            accion: { texto: "Atender", destino: { seccion: "pedidos", sub: null } },
            ambar: true,
          },
        ];
      case "premio":
        return [
          {
            clave: `premio-${aviso.clienteId}`,
            icono: Gift,
            titulo: `${aviso.nombre?.trim() || aviso.telefonoEnmascarado} tiene un premio listo`,
            detalle: aviso.premio,
            accion: {
              texto: canjeando === aviso.clienteId ? "Canjeando…" : "Canjear",
              onClick: () => void canjear(aviso),
            },
          },
        ];
      case "agotados":
        return [
          {
            clave: "agotados",
            icono: PackageX,
            titulo:
              aviso.total === 1 ? "1 producto agotado" : `${aviso.total} productos agotados`,
            detalle: aviso.nombres.join(", ") + (aviso.total > aviso.nombres.length ? "…" : ""),
            accion: { texto: "Revisar", destino: { seccion: "catalogo", sub: "hoy-hay" } },
          },
        ];
      case "tasa":
        return [
          {
            clave: "tasa",
            icono: Coins,
            titulo: "Tu tasa es de ayer",
            detalle: aviso.tasa
              ? `1 USD = ${aviso.tasa.toLocaleString("es-CU")} CUP`
              : "Todavía no has puesto ninguna",
            accion: { texto: "Actualizar", onClick: () => nav.abrirHoja("tasa") },
          },
        ];
      case "reservas":
        return [
          {
            clave: "reservas",
            icono: CalendarDays,
            titulo: "Reservas de hoy",
            detalle: `${aviso.ocupadas} de ${aviso.cupo} plazas`,
            accion: { texto: "Ver", destino: { seccion: "mas", sub: "reservas" } },
          },
        ];
      case "oferta":
        return [
          {
            clave: "oferta",
            icono: Tag,
            titulo: `La oferta «${aviso.titulo}» termina hoy`,
            detalle: "Después deja de salir en tu ficha",
            accion: { texto: "Ver", destino: { seccion: "ofertas", sub: null } },
          },
        ];
      case "ficha":
        return [
          {
            clave: "ficha",
            icono: Pencil,
            titulo: `Tu ficha está al ${aviso.pct} %`,
            detalle: aviso.falta,
            accion: {
              texto: "Completar",
              destino: { seccion: "editor", sub: aviso.seccion as Destino["sub"] },
            },
          },
        ];
      case "plan":
        return [
          {
            clave: "plan",
            icono: Sparkles,
            titulo:
              aviso.dias > 1
                ? `Tu plan vence en ${aviso.dias} días`
                : aviso.dias === 1
                  ? "Tu plan vence mañana"
                  : aviso.dias === 0
                    ? "Tu plan vence hoy"
                    : "Tu plan venció",
            detalle: "Renuévalo para no perder tus funciones",
            accion: { texto: "Ver plan", destino: { seccion: "planes", sub: null } },
            ambar: aviso.dias <= 1,
          },
        ];
      case "pack":
        return [
          {
            clave: "pack",
            icono: Sparkles,
            titulo: "Tu pack a medida está listo para pagar",
            detalle: `${aviso.precioUsd} USD al mes`,
            accion: { texto: "Ver plan", destino: { seccion: "planes", sub: null } },
          },
        ];
      case "publicada":
        return [
          {
            clave: "publicada",
            icono: Eye,
            titulo: "Tu ficha no está publicada",
            detalle: "No sale en el mapa ni en el catálogo",
            accion: { texto: "Ver qué falta", destino: { seccion: "editor", sub: null } },
          },
        ];
    }
  });
  /* Una acción que esta cuenta no puede abrir no se ofrece: el aviso tampoco. */
  const visibles = filas.filter((f) => !f.accion.destino || nav.puedeAbrir(f.accion.destino));

  const agotadosAhora =
    ahora === null ? null : place.menu.filter((p) => !p.oculto && estaAgotado(p, ahora)).length;

  const rapidas: { clave: string; icono: LucideIcon; titulo: string; detalle: string; onClick: () => void }[] = [
    ...(esDueno && place.tasaActiva
      ? [
          {
            clave: "tasa",
            icono: Coins,
            titulo: "Tasa del día",
            detalle: place.tasaUsdCup
              ? `1 USD = ${place.tasaUsdCup.toLocaleString("es-CU")} CUP`
              : "Pon la de hoy",
            onClick: () => nav.abrirHoja("tasa"),
          },
        ]
      : []),
    ...(puede("catalogo")
      ? [
          {
            clave: "hoy-hay",
            icono: Package,
            titulo: "Hoy hay",
            detalle:
              agotadosAhora === null
                ? "Lo que hay y lo agotado"
                : agotadosAhora === 0
                  ? "Nada agotado ahora"
                  : `${agotadosAhora} ${agotadosAhora === 1 ? "agotado" : "agotados"} ahora`,
            onClick: () => nav.ir({ seccion: "catalogo", sub: "hoy-hay" }),
          },
        ]
      : []),
    ...(tiene("cliente_frecuente") && puede("pedidos")
      ? [
          {
            clave: "sello",
            icono: Stamp,
            titulo: "Dar sello",
            detalle: "Por teléfono o código",
            onClick: () => nav.abrirHoja("sello"),
          },
        ]
      : []),
    ...(tiene("ofertas_flash") && puede("catalogo")
      ? [
          {
            clave: "oferta",
            icono: Tag,
            titulo: "Nueva oferta",
            detalle: "Rebaja un producto",
            onClick: () => nav.abrirHoja("oferta"),
          },
        ]
      : []),
  ];

  const cerrarYRefrescar = () => {
    nav.cerrarHoja();
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-gap-lg">
      <header className="flex flex-wrap items-end justify-between gap-gap-sm">
        <div>
          <p className="font-lv-display text-meta font-semibold text-ink-soft/75 first-letter:uppercase">
            {FECHA.format(new Date())}
          </p>
          <h1 className="mt-gap-2xs font-lv-display text-h2 font-bold text-ink">Hoy</h1>
        </div>
        {place.isActive && <Chapita tono="activa">Publicada en La Verde</Chapita>}
      </header>

      <Bloque titulo="Necesita tu atención">
        {visibles.length === 0 ? (
          <Chapita tono="activa" className="self-start">
            Todo al día
          </Chapita>
        ) : (
          <TarjetaPanel className="!p-0">
            <ul className="divide-y divide-ink/5">
              {visibles.map((fila) => {
                const Icono = fila.icono;
                return (
                  <li
                    key={fila.clave}
                    className={clsx(
                      "flex flex-wrap items-center gap-gap-sm px-gap-md py-gap-sm first:rounded-t-2xl last:rounded-b-2xl",
                      fila.ambar && "bg-lv-amber/10",
                    )}
                  >
                    <span
                      className={clsx(
                        "grid size-10 shrink-0 place-items-center rounded-full",
                        fila.ambar ? "bg-lv-amber/10 text-ink" : "bg-verde-50 text-verde-600",
                      )}
                    >
                      <Icono size={18} strokeWidth={1.8} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-lv-display text-small font-semibold text-ink">
                        {fila.titulo}
                      </p>
                      <p className="text-meta text-ink-soft/75">{fila.detalle}</p>
                    </div>
                    <BotonSecundario
                      onClick={
                        fila.accion.onClick ??
                        (() => fila.accion.destino && nav.ir(fila.accion.destino))
                      }
                      disabled={fila.clave === `premio-${canjeando}`}
                    >
                      {fila.accion.texto}
                    </BotonSecundario>
                  </li>
                );
              })}
            </ul>
          </TarjetaPanel>
        )}
      </Bloque>

      {rapidas.length > 0 && (
        <Bloque titulo="Acciones rápidas">
          <div className="grid grid-cols-2 gap-gap-sm">
            {rapidas.map((r) => {
              const Icono = r.icono;
              return (
                <button
                  key={r.clave}
                  type="button"
                  onClick={r.onClick}
                  className="flex min-h-11 cursor-pointer flex-col items-start gap-gap-xs rounded-2xl border border-ink/5 bg-white p-gap-md text-left transition-colors duration-500 ease-outquint hover:border-verde-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400/40"
                >
                  <span className="grid size-10 place-items-center rounded-full bg-verde-50 text-verde-600">
                    <Icono size={18} strokeWidth={1.8} />
                  </span>
                  <span className="font-lv-display text-small font-semibold text-ink">{r.titulo}</span>
                  <span className="text-meta text-ink-soft/75">{r.detalle}</span>
                </button>
              );
            })}
          </div>
        </Bloque>
      )}

      <Bloque titulo="Este mes">
        <DashboardStats
          stats={[
            {
              label: "Clics a tu negocio",
              value: visitas.resumen.mes.toLocaleString("es-CU"),
              hint: "Ficha y menú, este mes",
              icon: MousePointerClick,
            },
            {
              label: "Búsquedas",
              value: stats.aiMatches.toLocaleString("es-CU"),
              hint: "Apareciste como opción",
              icon: Search,
            },
            {
              label: "Productos",
              value: place.menu.length.toLocaleString("es-CU"),
              hint: "En tu catálogo",
              icon: Package,
            },
            {
              label: "Publicaciones",
              value:
                publicaciones.tope > 0 ? `${publicaciones.usadas} / ${publicaciones.tope}` : "—",
              hint:
                publicaciones.tope > 0
                  ? `Quedan ${Math.max(publicaciones.tope - publicaciones.usadas, 0)} esta semana`
                  : "No incluido en tu plan",
              icon: Megaphone,
              progress:
                publicaciones.tope > 0
                  ? (publicaciones.usadas / publicaciones.tope) * 100
                  : undefined,
              dimmed: publicaciones.tope === 0,
            },
          ]}
        />
        {/* Los 7 días, plegados: se miran a diario, pero no a la primera. */}
        <details className="group rounded-2xl border border-ink/5 bg-white px-gap-md">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-gap-sm font-lv-display text-small font-semibold text-ink [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-gap-xs">
              <MousePointerClick size={18} strokeWidth={1.8} className="text-verde-600" />
              Clics en los últimos 7 días
            </span>
            <ChevronDown
              size={18}
              strokeWidth={1.8}
              className="shrink-0 text-ink-soft/75 transition-transform duration-300 ease-outquint group-open:rotate-180"
            />
          </summary>
          <dl className="grid grid-cols-2 gap-gap-md pb-gap-md">
            <div className="flex flex-col gap-[2px]">
              <dt className="text-meta text-ink-soft/75">Ficha</dt>
              <dd className="font-lv-display text-h3 font-bold tabular-nums leading-none text-ink">
                {visitas.resumen.ficha7.toLocaleString("es-CU")}
              </dd>
            </div>
            <div className="flex flex-col gap-[2px]">
              <dt className="text-meta text-ink-soft/75">Catálogo</dt>
              <dd className="font-lv-display text-h3 font-bold tabular-nums leading-none text-ink">
                {visitas.resumen.catalogo7.toLocaleString("es-CU")}
              </dd>
            </div>
          </dl>
        </details>
      </Bloque>

      <MenuLinkCard
        placeId={place.id}
        placeName={place.name}
        url={menuUrl}
        sinMarca={funciones.includes("qr_sin_marca")}
        compacta
      />

      {/* Las hojas de las acciones rápidas (y de «Tu tasa es de ayer»). */}
      {esDueno && place.tasaActiva && (
        <HojaPanel
          open={nav.hoja === "tasa"}
          onOpenChange={(open) => {
            if (!open) cerrarYRefrescar();
          }}
          titulo="Tasa del día"
        >
          <TasaDelDiaCard
            placeId={place.id}
            tasaInicial={place.tasaUsdCup}
            redondeoInicial={place.tasaRedondeo}
            actualizadaEnInicial={place.tasaActualizadaEn}
            monedas={place.payments}
            tasaEurInicial={place.tasaEurCup}
            tasaMlcInicial={place.tasaMlcCup}
            transferenciaPctInicial={place.transferenciaPct}
            plegable={false}
          />
        </HojaPanel>
      )}
      {tiene("cliente_frecuente") && puede("pedidos") && (
        <HojaPanel
          open={nav.hoja === "sello"}
          onOpenChange={(open) => {
            if (!open) nav.cerrarHoja();
          }}
          titulo="Dar sello"
          descripcion="Busca la tarjeta por teléfono o nombre, o usa el código del pedido."
        >
          <DarSello placeId={place.id} onHecho={cerrarYRefrescar} />
        </HojaPanel>
      )}
      {tiene("ofertas_flash") && puede("catalogo") && (
        <HojaPanel
          open={nav.hoja === "oferta"}
          onOpenChange={(open) => {
            if (!open) nav.cerrarHoja();
          }}
          titulo="Nueva oferta"
          descripcion="Sale en tu ficha y en tu carta con el precio tachado."
        >
          <OfertaRapida place={place} funciones={funciones} onHecho={nav.cerrarHoja} />
        </HojaPanel>
      )}
    </div>
  );
}

function Bloque({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-gap-sm">
      <h2 className="font-lv-display text-body font-semibold text-ink">{titulo}</h2>
      {children}
    </section>
  );
}
