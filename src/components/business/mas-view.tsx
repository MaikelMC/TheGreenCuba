"use client";

/**
 * «Más»: todo lo que no cabe en el dock, agrupado por lo que el dueño viene a
 * hacer, con el estado real de cada cosa debajo de su nombre.
 *
 * Cada fila lleva a su subpantalla, donde vive el control de verdad (el
 * interruptor, el formulario, el «Ver los planes»). Aquí, cuando la función no
 * entra en el plan, la fila enseña la chapita del candado con el texto de
 * `bloqueoDe`: se sabe que existe y con qué se abre sin entrar.
 *
 * Solo se pintan las filas que esta cuenta puede abrir (`puedeAbrir`, los
 * permisos de trabajador). Las pantallas principales que no caben en el dock
 * —Pedidos sin pedidos por WhatsApp, por ejemplo— salen arriba, en «Secciones».
 */

import type { ReactNode } from "react";
import {
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Coins,
  LogOut,
  Mail,
  Megaphone,
  MessageCircle,
  Pencil,
  Bot,
  Sparkles,
  Stamp,
  Tag,
  Users,
  Utensils,
  BellRing,
  type LucideIcon,
} from "lucide-react";
import { whatsappHref } from "@/lib/contact-links";
import { SUPPORT_EMAIL, SUPPORT_WHATSAPP } from "@/lib/legal";
import { logout } from "@/lib/logout";
import { puedeSalir } from "@/lib/unsaved-guard";
import { bloqueoDe, nombreDe, type Funcion, type Plan } from "@/lib/plans";
import { ofertasVigentes } from "@/lib/ofertas";
import { RESERVA_LABEL } from "@/lib/reserva";
import { useCatalogo } from "@/providers/catalogo-provider";
import type { UserPlace } from "@/lib/places-store";
import { KynariCard } from "./kynari-card";
import { Chapita, TarjetaPanel } from "./ui/tarjeta";
import { usePanelNav, type Destino } from "./panel-shell";
import { mismoDestino } from "./panel-nav";

interface Fila {
  destino: Destino;
  icono: LucideIcon;
  titulo: string;
  estado: string;
  /** El texto de `bloqueoDe` cuando la función no entra en el plan. */
  candado?: string | null;
}

function GrupoMas({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-gap-xs">
      <h2 className="px-gap-xs font-lv-display text-small font-semibold text-ink-soft/75">
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function ListaFilas({ filas }: { filas: Fila[] }) {
  const nav = usePanelNav();
  const visibles = filas.filter((f) => nav.puedeAbrir(f.destino));
  if (visibles.length === 0) return null;
  return (
    <TarjetaPanel className="!p-0">
      <ul className="divide-y divide-ink/5">
        {visibles.map((fila) => {
          const Icono = fila.icono;
          return (
            <li key={`${fila.destino.seccion}:${fila.destino.sub ?? ""}`}>
              <button
                type="button"
                onClick={() => nav.ir(fila.destino)}
                className="flex min-h-11 w-full cursor-pointer items-center gap-gap-sm px-gap-md py-gap-sm text-left transition-colors duration-500 ease-outquint hover:bg-sand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-verde-400/40"
              >
                <Icono size={20} strokeWidth={1.8} className="shrink-0 text-verde-600" />
                <span className="min-w-0 flex-1">
                  <span className="block font-lv-display text-small font-semibold text-ink">
                    {fila.titulo}
                  </span>
                  <span className="block text-meta text-ink-soft/75" suppressHydrationWarning>
                    {fila.estado}
                  </span>
                </span>
                {fila.candado && <Chapita tono="candado">{fila.candado}</Chapita>}
                <ChevronRight size={18} strokeWidth={1.8} className="shrink-0 text-ink-soft/60" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
    </TarjetaPanel>
  );
}

export function MasView({
  place,
  plan,
  funciones,
  publicaciones,
  enDock,
}: {
  place: UserPlace;
  plan: Plan;
  funciones: Funcion[];
  publicaciones: { usadas: number; tope: number };
  /** Lo que ya está en el dock: no se repite en «Secciones». */
  enDock: Destino[];
}) {
  const cat = useCatalogo();
  const candado = (f: Funcion) => bloqueoDe(funciones, f, cat);
  const vivas = ofertasVigentes(place.ofertas).length;

  const secciones: Fila[] = (
    [
      {
        destino: { seccion: "pedidos", sub: null },
        icono: ClipboardList,
        titulo: "Pedidos",
        estado: "Historial y pedidos por atender",
        candado: candado("whatsapp_pedido"),
      },
      {
        destino: { seccion: "catalogo", sub: null },
        icono: Utensils,
        titulo: "Catálogo",
        estado: `${place.menu.length} ${place.menu.length === 1 ? "producto" : "productos"}`,
      },
      {
        destino: { seccion: "clientes", sub: null },
        icono: Stamp,
        titulo: "Clientes frecuentes",
        estado: "Tarjeta de sellos",
        candado: candado("cliente_frecuente"),
      },
    ] satisfies Fila[]
  ).filter((f) => !enDock.some((d) => mismoDestino(d, f.destino)));

  const reservasActivas = place.aceptaReservas ?? false;
  const tasa = place.tasaUsdCup;

  return (
    <div className="flex flex-col gap-gap-lg">
      <h1 className="sr-only">Más</h1>

      {secciones.length > 0 && (
        <GrupoMas titulo="Secciones">
          <ListaFilas filas={secciones} />
        </GrupoMas>
      )}

      <GrupoMas titulo="Mi negocio">
        <ListaFilas
          filas={[
            {
              destino: { seccion: "editor", sub: null },
              icono: Pencil,
              titulo: "Editar mi ficha",
              estado: [place.category, place.barrio || place.city].filter(Boolean).join(" · "),
            },
            {
              destino: { seccion: "mas", sub: "reservas" },
              icono: CalendarDays,
              titulo: "Reservas",
              estado: reservasActivas
                ? `Activas · ${RESERVA_LABEL[place.tipoReserva ?? "mesa"]}`
                : "Desactivadas",
              candado: candado("reservas_whatsapp"),
            },
            {
              destino: { seccion: "mas", sub: "precios" },
              icono: Coins,
              titulo: "Precios y tasa",
              estado: place.tasaActiva
                ? tasa
                  ? `Precios mixtos · 1 USD = ${tasa.toLocaleString("es-CU")} CUP`
                  : "Precios mixtos, sin tasa puesta"
                : "Precios en una sola moneda",
            },
            {
              destino: { seccion: "mas", sub: "avisos" },
              icono: BellRing,
              titulo: "Avisos a seguidores",
              estado: "Avisa de tus novedades a quien te sigue",
              candado: candado("seguidores"),
            },
          ]}
        />
      </GrupoMas>

      <GrupoMas titulo="Vender más">
        <ListaFilas
          filas={[
            {
              destino: { seccion: "ofertas", sub: null },
              icono: Tag,
              titulo: "Ofertas flash",
              estado:
                vivas === 0
                  ? "Ninguna activa ahora"
                  : `${vivas} ${vivas === 1 ? "activa" : "activas"} ahora`,
              candado: candado("ofertas_flash"),
            },
            {
              destino: { seccion: "publicaciones", sub: null },
              icono: Megaphone,
              titulo: "Publicar en Facebook",
              estado:
                publicaciones.tope > 0
                  ? `${publicaciones.usadas} de ${publicaciones.tope} esta semana`
                  : "No incluido en tu plan",
              candado: candado("publicaciones_fb"),
            },
          ]}
        />
        {/* Marca externa: su tarjeta va tal cual, sin el dibujo del panel. */}
        <KynariCard />
      </GrupoMas>

      <GrupoMas titulo="Herramientas">
        <ListaFilas
          filas={[
            {
              destino: { seccion: "telegram", sub: null },
              icono: Bot,
              titulo: "Asistente de Telegram",
              estado: "Marca agotados y abre el día desde el chat",
              candado: candado("telegram_menu"),
            },
            {
              destino: { seccion: "equipo", sub: null },
              icono: Users,
              titulo: "Equipo",
              estado: "Trabajadores y lo que puede hacer cada uno",
            },
          ]}
        />
      </GrupoMas>

      <GrupoMas titulo="Cuenta">
        <ListaFilas
          filas={[
            {
              destino: { seccion: "planes", sub: null },
              icono: Sparkles,
              titulo: "Tu plan",
              estado: nombreDe(plan, cat),
            },
          ]}
        />
        <TarjetaPanel className="!p-0">
          <ul className="divide-y divide-ink/5">
            <li>
              <a
                href={whatsappHref(SUPPORT_WHATSAPP)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-11 items-center gap-gap-sm px-gap-md py-gap-sm transition-colors duration-500 ease-outquint hover:bg-sand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-verde-400/40"
              >
                <MessageCircle size={20} strokeWidth={1.8} className="shrink-0 text-verde-600" />
                <span className="min-w-0 flex-1">
                  <span className="block font-lv-display text-small font-semibold text-ink">
                    Soporte por WhatsApp
                  </span>
                  <span className="block text-meta text-ink-soft/75">
                    Te contestamos por el chat
                  </span>
                </span>
              </a>
            </li>
            <li>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="flex min-h-11 items-center gap-gap-sm px-gap-md py-gap-sm transition-colors duration-500 ease-outquint hover:bg-sand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-verde-400/40"
              >
                <Mail size={20} strokeWidth={1.8} className="shrink-0 text-verde-600" />
                <span className="min-w-0 flex-1">
                  <span className="block font-lv-display text-small font-semibold text-ink">
                    Soporte por correo
                  </span>
                  <span className="block truncate text-meta text-ink-soft/75">{SUPPORT_EMAIL}</span>
                </span>
              </a>
            </li>
            <li>
              <button
                type="button"
                onClick={() => {
                  if (puedeSalir()) void logout();
                }}
                className="flex min-h-11 w-full cursor-pointer items-center gap-gap-sm px-gap-md py-gap-sm text-left font-lv-display text-small font-semibold text-destructive transition-colors duration-500 ease-outquint hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-verde-400/40"
              >
                <LogOut size={20} strokeWidth={1.8} className="shrink-0" />
                Cerrar sesión
              </button>
            </li>
          </ul>
        </TarjetaPanel>
      </GrupoMas>
    </div>
  );
}
