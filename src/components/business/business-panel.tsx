"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import {
  ArrowUpRight,
  AtSign,
  BellRing,
  Bot,
  CalendarDays,
  ClipboardList,
  Clock,
  Coins,
  CreditCard,
  Ellipsis,
  Eye,
  Image as ImageIcon,
  LayoutDashboard,
  Loader2,
  MapPin,
  Megaphone,
  Package,
  Pencil,
  Save,
  Settings,
  Sparkles,
  Stamp,
  Store,
  Tag,
  Users,
  Utensils,
  Zap,
} from "lucide-react";
import { cn, sanitizePhone } from "@/lib/utils";
import { normalizarWhatsappCubano } from "@/lib/contact-links";
import { placeIcon } from "@/lib/places";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CategoryIcon } from "@/components/admin/category-icon";
import { IconPicker } from "@/components/ui/icon-picker";
import { FormSection, FormSections } from "@/components/business/form-section";
import {
  PanelShell,
  usePanelNav,
  type ItemNav,
} from "@/components/business/panel-shell";
import { INICIO, type Destino } from "@/components/business/panel-nav";
import {
  EstadoNegocioProvider,
  FranjaCocina,
  HojaEstado,
  PildoraEstado,
} from "@/components/business/estado-negocio";
import {
  TarjetaPedidosWhatsapp,
  TarjetaPreciosMixtos,
  TarjetaReservas,
} from "@/components/business/ajustes-tarjetas";
import { HorarioCocinaCard } from "@/components/business/cocina-panel";
import { MasView } from "@/components/business/mas-view";
import { HoyView } from "@/components/business/hoy-view";
import { AvisosPedidosCard } from "@/components/business/avisos-pedidos-card";
import type { AvisoHoy } from "@/lib/hoy-server";
import { LogoUpload } from "@/components/business/logo-upload";
import { PhotoGrid } from "@/components/business/photo-grid";
import { PaymentChips } from "@/components/business/payment-chips";
import { CatalogoView } from "@/components/business/catalogo-view";
import { PedidosView } from "@/components/business/pedidos-view";
import { ClientesFrecuentesView } from "@/components/business/clientes-frecuentes-view";
import { ProgramadosAjustes } from "@/components/business/programados-ajustes";
import { OfertasView } from "@/components/business/ofertas-view";
import { PlansSection } from "@/components/business/plans-section";
import { PublicacionesView } from "@/components/business/publicaciones-view";
import { AsistenteCard } from "@/components/business/asistente-card";
import { EquipoView } from "@/components/business/equipo-view";
import { SeguidoresCard } from "@/components/business/seguidores-card";
import { TasaDelDiaCard } from "@/components/business/tasa-del-dia-card";
import { ZonasDomicilioCard } from "@/components/business/zonas-domicilio-card";
import type { NegocioPanel } from "@/components/business/business-switcher";
import type { ClaveModulo, Funcion, Pack, Plan } from "@/lib/plans";
import {
  ENERGIA_LABEL,
  ENERGIA_ORDER,
  type EnergiaRespaldo,
} from "@/lib/energia";
import {
  MapLocationPicker,
  type LocationPoint,
} from "@/components/map/MapLocationPicker";
import { campoResuelto } from "@/lib/map/geocode";
import { registrarGuarda } from "@/lib/unsaved-guard";
import { INPUT } from "@/components/business/ui/clases";
import { BotonPrimario, BotonSecundario } from "@/components/business/ui/botones";
import { TarjetaPanel } from "@/components/business/ui/tarjeta";
import { usePlaces } from "@/providers/places-provider";
import type { TipoNegocio, ModuloFicha, ComoComprar, ComoAtiende, EspecialDelDia } from "@/lib/ficha/tipos";
import type { EntregaConfig } from "@/lib/ficha/entrega";
import type { Horario } from "@/lib/ficha/horario";
import { AtributosChips } from "@/components/business/atributos-chips";
import { HorarioEditor } from "@/components/business/horario-editor";
import { ModulosEditor } from "@/components/business/modulos-editor";
import type { VisitasPanel } from "@/lib/eventos";
import type {
  UserPlace,
  UserPlacePatch,
} from "@/lib/places-store";
import type { PermisoNegocio } from "@/lib/permisos-negocio";
import { claveNegocio, guardarSnapshot } from "@/lib/offline/store";
import { construirNegocioSnapshot } from "@/lib/offline/snapshots";
import type { PackMedidaResumen } from "@/lib/pack-medida";

/** Los números reales que el panel puede contar. Se declaran aquí y no se
    importan de `queries.ts`: ese módulo arrastra la base de datos y la caché de
    Next, y traerlo —aunque fuera solo por un tipo— a un componente de cliente
    es la clase de import que un día alguien convierte en normal y se lleva el
    driver al navegador. */
interface PlaceStats {
  saved: number;
  reviews: number;
  photos: number;
  aiMatches: number;
}

const SCHEDULE_PRESETS = [
  "8:00 – 16:00",
  "9:00 – 18:00",
  "10:00 – 22:00",
  "12:00 – 24:00",
  "24 horas",
];

/* `verde-600` del sistema, aquí porque el selector de color nativo necesita un
   valor concreto cuando la ficha todavía no tiene marca. */
const COLOR_MARCA_POR_DEFECTO = "#0F7A41";

/**
 * El panel del negocio.
 *
 * Recibe la ficha ya resuelta del servidor —`/business/page.tsx` la lee de
 * `business_owners` para el usuario de la sesión— y **ya no hay ningún dato
 * escrito a fuego**. Antes este armazón tenía a fuego el nombre, la dirección,
 * la descripción, la oferta y un dashboard entero de cifras inventadas, y
 * `PhotoGrid` apuntaba al id del negocio que siembra `db:seed`.
 *
 * Eso importaba poco mientras `/business` fuera un prototipo que solo veía quien
 * supiera el rol de la cuenta de demostración. Con el alta desde el perfil deja
 * de importar poco: quien acaba de registrar su negocio entra aquí y tiene que
 * ver **el suyo**.
 */
export function BusinessPanel({
  place,
  stats,
  visitas,
  publicaciones,
  menuUrl,
  plan,
  funciones,
  modulos,
  puedeElegirPlan,
  planElegido = null,
  modulosElegidos = [],
  negocios,
  esDueno,
  permisos,
  userId,
  configTasa = null,
  packMedida = null,
  descuentoPct = null,
  destinoInicial = INICIO,
  avisos = [],
}: {
  /** Id del usuario de la sesión. Solo se usa para nombrar el snapshot offline. */
  userId: string;
  place: UserPlace;
  stats: PlaceStats;
  /** Las estadísticas del mes, **ya recortadas por función** en el servidor. */
  visitas: VisitasPanel;
  /** La cola de Facebook de esta semana: lo que el plan permite y lo usado. */
  publicaciones: { usadas: number; tope: number };
  /** La URL absoluta de la carta, que resuelve el servidor. Ver `menuUrl`. */
  menuUrl: string;
  /** El pack efectivo, resuelto en el servidor. Solo sirve para **nombrarlo**:
      decides qué se puede hacer lo decide `funciones`. Ver `planEfectivoDe`. */
  plan: Plan;
  /**
   * Todo lo que este negocio puede hacer, ya resuelto en el servidor.
   *
   * Viaja como lista y no como el pack contratado porque con módulos sueltos el
   * pack no lo dice todo: un negocio en Gratis con Menú Pro tiene funciones que
   * ningún pack nombra. Aquí solo pinta candados; quien decide de verdad es el
   * servidor, que vuelve a comprobarlo en cada ruta que escribe.
   */
  funciones: Funcion[];
  /** Los módulos sueltos vigentes del negocio, para la tarjeta del plan. */
  modulos: ClaveModulo[];
  /** Solo el negocio de prueba: puede cambiarse de plan a voluntad. */
  puedeElegirPlan: boolean;
  /** El pack pulsado en la portada, para marcarlo en su tarjeta. */
  planElegido?: Pack | null;
  /** Los servicios sueltos pulsados en la portada, por el mismo motivo. */
  modulosElegidos?: readonly ClaveModulo[];
  /** Los negocios que esta cuenta puede abrir, para «Tus negocios». */
  negocios: NegocioPanel[];
  /**
   * Si quien mira es el dueño. Resuelto en el servidor con `accesoNegocio`.
   *
   * Solo pinta: cada ruta que escribe vuelve a comprobarlo. El dueño ve todas
   * las secciones y reparte permisos; un trabajador ve las que le tocan.
   */
  esDueno: boolean;
  /** Los permisos del trabajador. Vacío para el dueño: no los necesita. */
  permisos: PermisoNegocio[];
  /** Config de la tasa del día para el preview en el catálogo. */
  configTasa?: import("@/lib/precios").ConfigTasa | null;
  /** El pack a medida activo o en tramitación, resuelto en el servidor. */
  packMedida?: PackMedidaResumen | null;
  /** Descuento acordado para este negocio, 0–100. `null` = sin descuento. */
  descuentoPct?: number | null;
  /** La pantalla que pide la URL (`?seccion=&sub=`), leída en el servidor. */
  destinoInicial?: Destino;
  /** «Necesita tu atención», calculado en el servidor (`avisosHoy`). */
  avisos?: AvisoHoy[];
}) {
  /* Copia de lectura para el modo offline. Se reescribe cuando cambia algo de
     la ficha, de las métricas o del plan; el panel se resuelve en el servidor,
     así que sin esto no habría nada que enseñar sin red.

     Best-effort y en segundo plano: un fallo de IndexedDB no puede afectar al
     panel que se está viendo. */
  useEffect(() => {
    void guardarSnapshot({
      key: claveNegocio(userId, place.id),
      data: construirNegocioSnapshot({
        place,
        stats,
        visitas,
        publicaciones,
        plan,
        funciones,
        modulos,
        negocios,
        permisos,
      }),
    });
  }, [
    userId,
    place,
    stats,
    visitas,
    publicaciones,
    plan,
    funciones,
    modulos,
    negocios,
    permisos,
  ]);

  /* Una función de permiso, muchos usos. El dueño pasa siempre; el trabajador
     solo si el dueño le marcó esa casilla. */
  const puede = (permiso: PermisoNegocio) =>
    esDueno || permisos.includes(permiso);
  const tiene = (funcion: Funcion) => funciones.includes(funcion);

  /**
   * Qué pantallas puede abrir esta cuenta. Es solo la interfaz: quien decide de
   * verdad es el servidor, que vuelve a comprobar el permiso en cada ruta. Está
   * para que un trabajador no vea —ni abra escribiendo la URL— una pantalla que
   * le devolvería un 401.
   */
  const puedeAbrir = (d: Destino): boolean => {
    switch (d.seccion) {
      case "dashboard":
        return true;
      case "mas":
        /* Reservas, Precios y tasa y Avisos venían de «Ajustes», que era de la
           ficha: siguen con el mismo permiso. */
        return d.sub === null || puede("ficha");
      case "catalogo":
      case "ofertas":
        return puede("catalogo");
      case "pedidos":
        /* Los ajustes de pedidos (carrito, zonas, horario de cocina) también
           venían de «Ajustes»: son de la ficha, no de atender pedidos. */
        return d.sub === "ajustes" ? puede("ficha") : puede("pedidos");
      case "clientes":
        return puede("pedidos") || puede("ficha");
      case "editor":
        return puede("ficha");
      case "telegram":
        return puede("telegram");
      case "publicaciones":
      case "equipo":
      case "planes":
        return esDueno;
    }
  };

  const item = (seccion: Destino["seccion"], sub: Destino["sub"], label: string, icon: ItemNav["icon"]): ItemNav => ({
    destino: { seccion, sub },
    label,
    icon,
  });
  const hoy = item("dashboard", null, "Hoy", LayoutDashboard);
  const pedidos = item("pedidos", null, "Pedidos", ClipboardList);
  const catalogo = item("catalogo", null, "Catálogo", Utensils);
  const clientes = item("clientes", null, "Clientes", Stamp);
  const mas = item("mas", null, "Más", Ellipsis);
  const reservas = item("mas", "reservas", "Reservas", CalendarDays);
  const ofertas = item("ofertas", null, "Ofertas", Tag);

  /**
   * Las pestañas del dock (móvil y tablet). Entre dos y cinco:
   * - Hoy y Más, siempre.
   * - Pedidos si se puede atender y el plan tiene pedidos por WhatsApp. Si no,
   *   su hueco es para Reservas, si las tiene y se pueden configurar.
   * - Catálogo con el permiso de catálogo.
   * - Clientes si el plan tiene la tarjeta de sellos. Si no, su hueco es para
   *   Ofertas, si el plan las tiene y se puede editar el catálogo.
   * Lo que no entra en el dock sale arriba en «Más», en «Secciones». Un
   * trabajador con un solo permiso puede quedarse con dos pestañas.
   */
  const dock: ItemNav[] = [hoy];
  if (puede("pedidos") && tiene("whatsapp_pedido")) dock.push(pedidos);
  else if (puede("ficha") && tiene("reservas_whatsapp")) dock.push(reservas);
  if (puede("catalogo")) dock.push(catalogo);
  if ((puede("pedidos") || puede("ficha")) && tiene("cliente_frecuente")) dock.push(clientes);
  else if (puede("catalogo") && tiene("ofertas_flash")) dock.push(ofertas);
  dock.push(mas);

  /* Escritorio: las cuatro principales arriba (y «Más», que reúne Kynari y el
     soporte) y debajo los grupos de «Más», para llegar a todo en un toque. */
  const lateral = [hoy, pedidos, catalogo, clientes, mas].filter((i) => puedeAbrir(i.destino));
  const grupos = [
    {
      titulo: "Mi negocio",
      items: [
        item("editor", null, "Editar mi ficha", Pencil),
        reservas,
        item("mas", "precios", "Precios y tasa", Coins),
        item("mas", "avisos", "Avisos a seguidores", BellRing),
      ],
    },
    {
      titulo: "Vender más",
      items: [ofertas, item("publicaciones", null, "Publicar", Megaphone)],
    },
    {
      titulo: "Herramientas",
      items: [item("telegram", null, "Asistente", Bot), item("equipo", null, "Equipo", Users)],
    },
    { titulo: "Cuenta", items: [item("planes", null, "Tu plan", Sparkles)] },
  ].map((g) => ({ ...g, items: g.items.filter((i) => puedeAbrir(i.destino)) }));

  return (
    <EstadoNegocioProvider
      place={place}
      tieneCocina={tiene("horario_cocina")}
      puedeFicha={puede("ficha")}
      puedePedidos={puede("pedidos")}
    >
      <PanelShell
        negocioId={place.id}
        businessName={place.name}
        logoUrl={place.logoUrl}
        publicado={place.isActive}
        negocios={negocios}
        destinoInicial={destinoInicial}
        puedeAbrir={puedeAbrir}
        dock={dock}
        lateral={lateral}
        grupos={grupos}
        estado={<PildoraEstado />}
        vigilarPedidos={puede("pedidos") && tiene("whatsapp_pedido")}
        hojas={<HojaEstado />}
      >
        {(destino) => (
          <VistaPanel
            destino={destino}
            dock={dock.map((i) => i.destino)}
            place={place}
            stats={stats}
            visitas={visitas}
            publicaciones={publicaciones}
            menuUrl={menuUrl}
            plan={plan}
            funciones={funciones}
            modulos={modulos}
            puedeElegirPlan={puedeElegirPlan}
            planElegido={planElegido}
            modulosElegidos={modulosElegidos}
            esDueno={esDueno}
            permisos={permisos}
            configTasa={configTasa}
            packMedida={packMedida}
            descuentoPct={descuentoPct}
            avisos={avisos}
          />
        )}
      </PanelShell>
    </EstadoNegocioProvider>
  );
}

/** Monta la pantalla que dice la URL. Vive dentro del armazón para poder navegar. */
function VistaPanel({
  destino,
  dock,
  place,
  stats,
  visitas,
  publicaciones,
  menuUrl,
  plan,
  funciones,
  modulos,
  puedeElegirPlan,
  planElegido,
  modulosElegidos,
  esDueno,
  permisos,
  configTasa,
  packMedida,
  descuentoPct,
  avisos,
}: {
  destino: Destino;
  dock: Destino[];
  place: UserPlace;
  stats: PlaceStats;
  visitas: VisitasPanel;
  publicaciones: { usadas: number; tope: number };
  menuUrl: string;
  plan: Plan;
  funciones: Funcion[];
  modulos: ClaveModulo[];
  puedeElegirPlan: boolean;
  planElegido: Pack | null;
  modulosElegidos: readonly ClaveModulo[];
  esDueno: boolean;
  permisos: PermisoNegocio[];
  configTasa: import("@/lib/precios").ConfigTasa | null;
  packMedida: PackMedidaResumen | null;
  descuentoPct: number | null;
  avisos: AvisoHoy[];
}) {
  const nav = usePanelNav();
  const tiene = (funcion: Funcion) => funciones.includes(funcion);

  /* El botón de planes de las tarjetas no tiene a dónde ir si esta cuenta no
     paga el negocio: en vez de un botón mudo, se dice a quién pedírselo. */
  const onVerPlanes = esDueno
    ? () => nav.ir({ seccion: "planes", sub: null })
    : () =>
        toast.info(
          "Los planes los gestiona el dueño del negocio. Pídeselo y él lo cambia.",
        );

  switch (destino.seccion) {
    case "dashboard":
      return (
        <HoyView
          place={place}
          stats={stats}
          visitas={visitas}
          publicaciones={publicaciones}
          menuUrl={menuUrl}
          funciones={funciones}
          esDueno={esDueno}
          permisos={permisos}
          avisos={avisos}
        />
      );
    case "catalogo":
      /* La carta vive aquí y no en «Editar ficha»: son dos ritmos distintos.
         Con la `key` por negocio, cambiar de negocio vuelve a sembrar la lista. */
      return (
        <div className="flex flex-col gap-gap-sm">
          <InfoServicio href="/servicios/carta-y-qr" />
          <CatalogoView
            key={place.id}
            place={place}
            funciones={funciones}
            configTasa={configTasa ?? undefined}
            onVerPlanes={onVerPlanes}
            modoInicial={
              destino.sub === "hoy-hay" || destino.sub === "editar" ? destino.sub : null
            }
          />
        </div>
      );
    case "pedidos":
      if (destino.sub === "ajustes") {
        /* Todo lo que se configura de los pedidos, fuera de la lista: el
           carrito, las zonas, el horario de cocina y los programados. Las
           tarjetas son las de «Ajustes», sin cambiar su lógica ni sus rutas. */
        return (
          <div className="flex flex-col gap-gap-md">
            <TarjetaPedidosWhatsapp
              key={`pw-${place.id}`}
              place={place}
              funciones={funciones}
              onVerPlanes={onVerPlanes}
            />
            {tiene("whatsapp_pedido") && <AvisosPedidosCard />}
            <ZonasDomicilioCard
              key={`zonas-${place.id}`}
              placeId={place.id}
              funciones={funciones}
              entregaInicial={place.entrega}
              onVerPlanes={onVerPlanes}
            />
            {tiene("horario_cocina") && (
              <>
                <HorarioCocinaCard key={`hc-${place.id}`} placeId={place.id} entrega={place.entrega} />
                <TarjetaPanel>
                  <ProgramadosAjustes
                    placeId={place.id}
                    tieneFuncion={tiene("pedidos_programados")}
                    onVerPlanes={onVerPlanes}
                  />
                </TarjetaPanel>
              </>
            )}
          </div>
        );
      }
      /* El historial vive aparte de la carta porque se mira con otro ritmo: la
         carta se edita, los pedidos se atienden. El servidor comprueba la
         propiedad en cada lectura y escritura. */
      return (
        <div className="flex flex-col gap-gap-md">
          {/* Arriba: el título, los ajustes (fuera de la lista: nada de
              configuración bajo los pedidos) y la franja de la cocina. */}
          <header className="flex flex-wrap items-center justify-between gap-gap-sm">
            <h1 className="font-lv-display text-h2 font-bold text-ink">Pedidos</h1>
            {nav.puedeAbrir({ seccion: "pedidos", sub: "ajustes" }) && (
              <BotonSecundario onClick={() => nav.ir({ seccion: "pedidos", sub: "ajustes" })}>
                <Settings size={16} strokeWidth={1.8} />
                Ajustes de pedidos
              </BotonSecundario>
            )}
          </header>
          <FranjaCocina />
          <InfoServicio href="/servicios/flujo-atencion-pedidos" />
          <PedidosView
            key={place.id}
            placeId={place.id}
            funciones={funciones}
            onVerPlanes={onVerPlanes}
          />
        </div>
      );
    case "clientes":
      /* Las tarjetas de sellos. La ven `pedidos` (para atender el mostrador) y
         `ficha` (para configurar la tarjeta). Cada botón vuelve a comprobar su
         permiso antes de llamar; el servidor, otra vez. */
      return (
        <div className="flex flex-col gap-gap-sm">
          <InfoServicio href="/servicios/cliente-frecuente" />
          <ClientesFrecuentesView
            key={place.id}
            placeId={place.id}
            funciones={funciones}
            esDueno={esDueno}
            permisos={permisos}
            onVerPlanes={onVerPlanes}
          />
        </div>
      );
    case "mas":
      if (destino.sub === "reservas") {
        return (
          <TarjetaReservas
            key={place.id}
            place={place}
            funciones={funciones}
            onVerPlanes={onVerPlanes}
          />
        );
      }
      if (destino.sub === "precios") {
        /* La tasa la decide solo el dueño (la ruta lo exige), así que un
           trabajador ve el interruptor pero no la tarjeta de tasas. */
        return (
          <div className="flex flex-col gap-gap-md">
            <TarjetaPreciosMixtos key={place.id} place={place} esDueno={esDueno} />
            {esDueno && place.tasaActiva && (
              <TasaDelDiaCard
                placeId={place.id}
                tasaInicial={place.tasaUsdCup}
                redondeoInicial={place.tasaRedondeo}
                actualizadaEnInicial={place.tasaActualizadaEn}
                monedas={place.payments}
                tasaEurInicial={place.tasaEurCup}
                tasaMlcInicial={place.tasaMlcCup}
                transferenciaPctInicial={place.transferenciaPct}
              />
            )}
          </div>
        );
      }
      if (destino.sub === "avisos") {
        return (
          <SeguidoresCard
            key={place.id}
            place={place}
            funciones={funciones}
            onVerPlanes={onVerPlanes}
          />
        );
      }
      return (
        <MasView
          place={place}
          plan={plan}
          funciones={funciones}
          publicaciones={publicaciones}
          enDock={dock}
        />
      );
    case "publicaciones":
      /* Las funciones deciden si la sección se abre o enseña el candado. El
         servidor lo comprueba otra vez: el candado del cliente es información,
         no permiso. */
      return (
        <PublicacionesView
          key={place.id}
          placeId={place.id}
          productos={place.menu}
          funciones={funciones}
          onVerPlanes={onVerPlanes}
        />
      );
    case "editor":
      /* La `key` remonta el editor al cambiar de negocio: siembra su estado del
         `place` y a propósito **no** lo resincroniza —eso borraría lo escrito
         en cada `router.refresh()`—. */
      return (
        <EditorView
          key={place.id}
          place={place}
          funciones={funciones}
          onVerPlanes={onVerPlanes}
          seccionInicial={destino.sub}
        />
      );
    case "ofertas":
      return (
        <div className="flex flex-col gap-gap-sm">
          <InfoServicio href="/servicios/ofertas-y-novedades" />
          <OfertasView
            key={place.id}
            place={place}
            funciones={funciones}
            onVerPlanes={onVerPlanes}
          />
        </div>
      );
    case "telegram":
      return (
        <AsistenteCard
          key={place.id}
          place={place}
          funciones={funciones}
          onVerPlanes={onVerPlanes}
        />
      );
    case "equipo":
      return <EquipoView key={place.id} placeId={place.id} />;
    case "planes":
      return (
        <PlansSection
          key={place.id}
          plan={plan}
          placeId={place.id}
          puedeElegirPlan={puedeElegirPlan}
          planElegido={planElegido}
          modulosElegidos={modulosElegidos}
          packMedida={packMedida}
          esDueno={esDueno}
          descuentoPct={descuentoPct}
          funciones={funciones}
        />
      );
  }
}

/** Link discreto de «¿Qué hace esto?» para las secciones del panel. */
function InfoServicio({ href }: { href: string }) {
  return (
    <div className="flex justify-end">
      <Link
        href={href}
        className="flex items-center gap-1 text-meta text-ink-soft/60 hover:text-verde-600 transition-colors"
      >
        ¿Qué hace esto?
        <ArrowUpRight size={13} strokeWidth={2} />
      </Link>
    </div>
  );
}

/*
 * Aquí había un `ViewLead`: un encabezado por sección con el título visible y un
 * subtítulo. Sobraba por los dos lados. El título repetía lo que ya dice el
 * navbar —la barra lateral en escritorio, el dock en móvil—, y el subtítulo
 * repetía lo que ya dice el selector de negocio de arriba. Ahora las
 * subpantallas llevan su título junto a la flecha de volver (lo pinta el
 * armazón) y las principales abren con su propio `h1`: «Hoy», «Pedidos».
 */

/** Lo que queda en `localStorage` cuando se sale de la ficha sin guardar. */
interface BorradorFicha {
  name: string;
  categoryValue: string;
  icon: string | null;
  logoUrl: string;
  description: string;
  address: string;
  barrio: string;
  phone: string;
  website: string;
  whatsapp: string;
  instagram: string;
  facebook: string;
  schedule: string;
  payments: string[];
  energia: EnergiaRespaldo | "sin";
  notaApagon: string;
  location: LocationPoint | null;
  /* ── Ficha por tipo ──────────────────────────────────────────────── */
  tipoNegocio: import("@/lib/ficha/tipos").TipoNegocio | null;
  modulosActivos: import("@/lib/ficha/tipos").ModuloFicha[];
  atributos: string[];
  colorMarca: string;
  horario: import("@/lib/ficha/horario").Horario | null;
  entrega: import("@/lib/ficha/entrega").EntregaConfig | null;
  comoComprar: import("@/lib/ficha/tipos").ComoComprar | null;
  comoAtiende: import("@/lib/ficha/tipos").ComoAtiende | null;
  especialDia: import("@/lib/ficha/tipos").EspecialDelDia | null;
}

/** Clave del borrador de la ficha en curso, por negocio. */
function claveBorradorFicha(placeId: string): string {
  return `la-verde:ficha-borrador:${placeId}`;
}

function EditorView({
  place,
  funciones,
  onVerPlanes,
  seccionInicial = null,
}: {
  place: UserPlace;
  funciones: Funcion[];
  onVerPlanes: () => void;
  /** La `FormSection` que se abre al entrar (`?seccion=editor&sub=horario`). */
  seccionInicial?: string | null;
}) {
  const router = useRouter();
  const { categories, updatePlace } = usePlaces();

  /* El estado se siembra del negocio y no se vuelve a sincronizar: a partir de
     aquí manda lo que escriba el dueño. Sincronizarlo con el `place` que llega
     del servidor borraría lo escrito cada vez que `router.refresh()` trae datos
     nuevos. */
  const [name, setName] = useState(place.name);
  const [categoryValue, setCategoryValue] = useState(
    categories.find((c) => c.label === place.category)?.value ?? "",
  );
  const [icon, setIcon] = useState<string | null>(place.icon ?? null);
  /* El logo se sube desde aquí igual que desde el formulario de administración:
     la ruta `/api/places/[id]/logo` es la misma y admite al dueño. La URL se
     queda en el estado hasta que se guarda la ficha, como las fotos del menú. */
  const [logoUrl, setLogoUrl] = useState(place.logoUrl ?? "");
  const [description, setDescription] = useState(place.description);
  const [address, setAddress] = useState(place.address);
  const [barrio, setBarrio] = useState(place.barrio);
  /* Contacto. Vive aquí y no en Ajustes: el formulario de administración ya
     edita estos cinco campos, y tenerlos en dos pantallas del panel obligaba a
     buscar en cuál estaba la versión buena. */
  const [phone, setPhone] = useState(place.phone ?? "");
  const [website, setWebsite] = useState(place.website ?? "");
  const [whatsapp, setWhatsapp] = useState(place.whatsapp ?? "");
  const [instagram, setInstagram] = useState(place.instagram ?? "");
  const [facebook, setFacebook] = useState(place.facebook ?? "");
  const [schedule, setSchedule] = useState(place.schedule);
  const [payments, setPayments] = useState<string[]>(place.payments);
  /* `"sin"` es «prefiero no decirlo», que no es un valor del dominio sino la
     opción vacía del `Select` —Radix no admite un `SelectItem` con valor `""`—.
     Al guardar se traduce a `null`, que es lo que la base entiende por «no lo
     dijo». */
  const [energia, setEnergia] = useState<EnergiaRespaldo | "sin">(
    place.energiaRespaldo ?? "sin",
  );
  const [notaApagon, setNotaApagon] = useState(place.notaApagon ?? "");
  const [location, setLocation] = useState<LocationPoint | null>({
    lat: place.lat,
    lng: place.lng,
  });
  /* ── Ficha por tipo ──────────────────────────────────────────────── */
  const [tipoNegocio, setTipoNegocio] = useState<TipoNegocio | null>(
    place.tipoNegocio ?? null,
  );
  const [modulosActivos, setModulosActivos] = useState<ModuloFicha[]>(
    place.modulosActivos ?? [],
  );
  const [atributos, setAtributos] = useState<string[]>(place.atributos ?? []);
  const [colorMarca, setColorMarca] = useState(place.colorMarca ?? "");
  const [horario, setHorario] = useState<Horario | null>(place.horario ?? null);
  const [entrega, setEntrega] = useState<EntregaConfig | null>(
    place.entrega ?? null,
  );
  const [comoComprar, setComoComprar] = useState<ComoComprar | null>(
    place.comoComprar ?? null,
  );
  const [comoAtiende, setComoAtiende] = useState<ComoAtiende | null>(
    place.comoAtiende ?? null,
  );
  const [especialDia, setEspecialDia] = useState<EspecialDelDia | null>(
    place.especialDia ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /* Trabajo pendiente visible, sección abierta y foco pedido. La validación
     necesita abrir la sección que falla y llevar el cursor a su campo, y con el
     acordeón cerrado ese campo no existe en el DOM. */
  const [pendiente, setPendiente] = useState(false);
  const [seccionAbierta, setSeccionAbierta] = useState<string | null>(
    seccionInicial,
  );
  const [seccionInvalida, setSeccionInvalida] = useState<string | null>(null);
  const [enfocarCampo, setEnfocarCampo] = useState<string | null>(null);

  /* Todo lo que escribe el botón, en una sola pieza: la huella decide si hay
     trabajo pendiente y el mismo objeto es lo que se guarda como borrador.
     `guardado` es la última versión que el servidor confirmó. */
  const estadoFicha = useMemo<BorradorFicha>(
    () => ({
      name,
      categoryValue,
      icon,
      logoUrl,
      description,
      address,
      barrio,
      phone,
      website,
      whatsapp,
      instagram,
      facebook,
      schedule,
      payments,
      energia,
      notaApagon,
      location,
      tipoNegocio,
      modulosActivos,
      atributos,
      colorMarca,
      horario,
      entrega,
      comoComprar,
      comoAtiende,
      especialDia,
    }),
    [
      name,
      categoryValue,
      icon,
      logoUrl,
      description,
      address,
      barrio,
      phone,
      website,
      whatsapp,
      instagram,
      facebook,
      schedule,
      payments,
      energia,
      notaApagon,
      location,
      tipoNegocio,
      modulosActivos,
      atributos,
      colorMarca,
      horario,
      entrega,
      comoComprar,
      comoAtiende,
      especialDia,
    ],
  );
  const huella = JSON.stringify(estadoFicha);
  const guardado = useRef(huella);
  const sucio = huella !== guardado.current;
  /* El borrador sin guardar de la visita anterior. Se ofrece, no se aplica
     solo: el dueño decide si lo recupera. */
  const [borrador, setBorrador] = useState<BorradorFicha | null>(null);

  const categoryLabel =
    categories.find((c) => c.value === categoryValue)?.label ?? place.category;
  const resolvedIcon = placeIcon(icon ?? undefined, categoryLabel, categories);

  const save = useCallback(async () => {
    const trimmed = name.trim();
    /* Cada fallo abre su sección y pide el foco al campo: con las secciones
       plegadas su contenido no está en el DOM y `focus()` no encontraba nada. */
    if (!trimmed) {
      setSeccionInvalida("basico");
      setSeccionAbierta("basico");
      setEnfocarCampo("bizName");
      setError(
        "El nombre del negocio no puede quedar vacío. Está en «Información del negocio».",
      );
      return;
    }
    if (!location) {
      setSeccionInvalida("ubicacion");
      setSeccionAbierta("ubicacion");
      setError(
        "Marca tu negocio en el mapa antes de guardar. Está en «Ubicación en el mapa».",
      );
      return;
    }
    /* El número de WhatsApp se guarda normalizado (`+53XXXXXXXX`) porque de él
       sale el enlace de los pedidos. Lo que no se entiende se rechaza aquí, con
       la misma frase que la ruta. */
    let numeroWhatsapp = "";
    if (whatsapp.trim()) {
      const normalizado = normalizarWhatsappCubano(whatsapp);
      if (!normalizado) {
        setSeccionInvalida("contacto");
        setSeccionAbierta("contacto");
        setEnfocarCampo("bizWhatsapp");
        setError(
          "Ese WhatsApp no parece cubano. Escríbelo como +53 5 123 4567.",
        );
        return;
      }
      numeroWhatsapp = normalizado;
    }

    /* Las mismas reglas que aplica el `PATCH`, comprobadas antes de salir.
       Si el servidor rechaza el cuerpo, el panel solo puede decir «revisa la
       conexión», que es mentira y no dice qué arreglar. Estas cuatro son las
       que el formulario puede producir sin querer. */
    if (colorMarca.trim() && !/^#[0-9a-fA-F]{6}$/.test(colorMarca.trim())) {
      setSeccionInvalida("marca");
      setSeccionAbierta("marca");
      setEnfocarCampo("bizColorHex");
      setError(
        "El color de marca tiene que ser un hex de seis cifras, como #0F7A41. Está en «Color de marca».",
      );
      return;
    }
    /* Una franja sin hora, o con las dos iguales, la rechaza `esHorario`.
       Pasa al vaciar un campo de hora con el teclado del móvil. */
    const franjas = Object.values(horario?.semana ?? {}).flatMap(
      (delDia) => delDia ?? [],
    );
    if (franjas.some((f) => !f.abre || !f.cierra || f.abre === f.cierra)) {
      setSeccionInvalida("horario");
      setSeccionAbierta("horario");
      setError(
        "Hay una franja de horario sin hora de apertura o de cierre, o con las dos iguales. Está en «Horario».",
      );
      return;
    }
    const tiempoEntrega = entrega?.tiempo;
    if (
      tiempoEntrega &&
      (!Number.isFinite(tiempoEntrega.min) ||
        !Number.isFinite(tiempoEntrega.max) ||
        tiempoEntrega.min < 0 ||
        tiempoEntrega.min > tiempoEntrega.max)
    ) {
      setSeccionInvalida("tipo");
      setSeccionAbierta("tipo");
      setError(
        "El tiempo de entrega no es válido: el mínimo no puede ser mayor que el máximo. Está en «Tipo de negocio y bloques».",
      );
      return;
    }
    /* El especial del día nace con los campos vacíos al encenderlo, y el
       servidor exige título, moneda y fecha de fin. Sin esto, encenderlo y
       guardar devolvía un 400 que el panel contaba como fallo de red. */
    if (
      especialDia &&
      (!especialDia.titulo?.trim() ||
        !especialDia.moneda?.trim() ||
        !/^\d{4}-\d{2}-\d{2}$/.test(especialDia.hasta ?? ""))
    ) {
      setSeccionInvalida("tipo");
      setSeccionAbierta("tipo");
      setEnfocarCampo("especial-titulo");
      setError(
        "Para el especial del día hacen falta título y fecha de fin. Está en «Tipo de negocio y bloques».",
      );
      return;
    }

    setError(null);
    setSeccionInvalida(null);
    setSaving(true);

    const values: UserPlacePatch = {
      name: trimmed,
      category: categoryLabel,
      /* Vacío = «el de su categoría»: `toPlaceValues` lo guarda como `null`. Con
         `undefined` no viajaba y «Usar el de la categoría» no borraba el icono
         elegido, así que el badge no seguía al cambio de categoría. */
      icon: icon ?? "",
      /* Cadena vacía borra el logo (`toPlaceValues` la convierte en `null`), que
         es lo que hace «Quitar» en el propio componente. */
      logoUrl: logoUrl.trim(),
      description: description.trim(),
      address: address.trim(),
      barrio: barrio.trim(),
      phone: phone.trim(),
      website: website.trim(),
      whatsapp: numeroWhatsapp,
      instagram: instagram.trim(),
      facebook: facebook.trim(),
      lat: location.lat,
      lng: location.lng,
      schedule: schedule.trim(),
      payments,
      /* La carta y las ofertas flash **no** viajan aquí: cada una se edita en
         su propia sección y manda su propio `PATCH`. Al no nombrarlas, el
         guardado de la ficha no puede pisar lo que el dueño acaba de cambiar
         en el catálogo o en las ofertas. */
      /* La energía va aquí por lo mismo que la disponibilidad: es una lista
         blanca y lo que no se nombre se pierde en cada guardado. */
      energiaRespaldo: energia === "sin" ? null : energia,
      notaApagon: notaApagon.trim(),
      /* Ficha por tipo */
      tipoNegocio: tipoNegocio ?? null,
      modulosActivos,
      atributos,
      colorMarca: colorMarca.trim() || null,
      horario: horario ?? null,
      entrega: entrega ?? null,
      comoComprar: comoComprar ?? null,
      comoAtiende: comoAtiende ?? null,
      especialDia: especialDia ?? null,
    };

    const saved = await updatePlace(place.id, values);
    setSaving(false);

    if (!saved) {
      setError(
        "No se pudo guardar. Revisa la conexión e inténtalo otra vez: no se cambió nada.",
      );
      return;
    }

    guardado.current = huella;
    /* Guardado es que ya no hay nada que recuperar. */
    setBorrador(null);
    try {
      window.localStorage.removeItem(claveBorradorFicha(place.id));
    } catch {
      /* Sin almacén no hay borrador que limpiar. */
    }
    toast.success("Cambios guardados");
    /* El servidor vuelve a leer la ficha para el dashboard, que es de servidor.
       El formulario no se resiembra —su estado es del cliente y ya tiene lo que
       acabas de escribir—, así que no se pierde nada. */
    router.refresh();
  }, [
    name,
    categoryLabel,
    icon,
    logoUrl,
    description,
    address,
    barrio,
    phone,
    website,
    whatsapp,
    instagram,
    facebook,
    location,
    schedule,
    payments,
    energia,
    notaApagon,
    huella,
    place.id,
    updatePlace,
    router,
  ]);

  /* ── El borrador y la salida ─────────────────────────────────────────────
     La ficha es la pantalla más larga del panel, así que lleva las mismas tres
     redes que el catálogo: el borrador se escribe en cada cambio, al cerrar la
     pestaña el navegador pregunta, y al cambiar de sección el armazón consulta
     la guardia de aquí abajo. */

  /* Se lee una sola vez, al montar. Un borrador igual que la base es ruido y se
     borra sin ofrecerlo. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const crudo = window.localStorage.getItem(claveBorradorFicha(place.id));
      if (!crudo) return;
      if (crudo === guardado.current) {
        window.localStorage.removeItem(claveBorradorFicha(place.id));
        return;
      }
      const parsed = JSON.parse(crudo) as unknown;
      if (!parsed || typeof parsed !== "object") return;
      const recuperado = parsed as BorradorFicha;
      if (
        typeof recuperado.name !== "string" ||
        !Array.isArray(recuperado.payments)
      ) {
        return;
      }
      setBorrador(recuperado);
    } catch {
      /* Sin `localStorage` o con el JSON roto se sigue sin borrador: la guardia
         y el botón de guardar siguen siendo la red. */
    }
  }, [place.id]);

  /* Solo se borra el borrador si lo escribió esta visita: al montar `sucio` es
     falso y borrarlo ahí se llevaría por delante el que el aviso está
     ofreciendo. */
  const borradorEscrito = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setPendiente(sucio);
    if (!sucio) {
      if (!borradorEscrito.current) return;
      borradorEscrito.current = false;
      try {
        window.localStorage.removeItem(claveBorradorFicha(place.id));
      } catch {
        /* Almacén lleno o bloqueado: la guardia de salida sigue siendo la red. */
      }
      return;
    }
    borradorEscrito.current = true;
    /* 500 ms y no cada tecla: `localStorage` escribe de forma síncrona y en un
       móvil lento cobraba el peaje en cada pulsación de la descripción. */
    const t = window.setTimeout(() => {
      try {
        window.localStorage.setItem(claveBorradorFicha(place.id), huella);
      } catch {
        /* Igual que arriba: la guardia de salida sigue siendo la red. */
      }
    }, 500);
    return () => window.clearTimeout(t);
  }, [huella, sucio, place.id]);

  /* Aplica una ficha completa al formulario. La comparten la recuperación del
     borrador y «Descartar cambios», que son la misma operación con otro origen. */
  const aplicarFicha = useCallback((ficha: BorradorFicha) => {
    setName(ficha.name);
    setCategoryValue(ficha.categoryValue);
    setIcon(ficha.icon);
    setLogoUrl(ficha.logoUrl);
    setDescription(ficha.description);
    setAddress(ficha.address);
    setBarrio(ficha.barrio);
    /* `?? ""`: los borradores escritos antes de que el contacto entrara en el
       editor no traen estos campos. */
    setPhone(ficha.phone ?? "");
    setWebsite(ficha.website ?? "");
    setWhatsapp(ficha.whatsapp ?? "");
    setInstagram(ficha.instagram ?? "");
    setFacebook(ficha.facebook ?? "");
    setSchedule(ficha.schedule);
    setPayments(ficha.payments);
    setEnergia(ficha.energia);
    setNotaApagon(ficha.notaApagon);
    setLocation(ficha.location);
    if (ficha.tipoNegocio !== undefined) setTipoNegocio(ficha.tipoNegocio);
    if (ficha.modulosActivos !== undefined) setModulosActivos(ficha.modulosActivos);
    if (ficha.atributos !== undefined) setAtributos(ficha.atributos);
    if (ficha.colorMarca !== undefined) setColorMarca(ficha.colorMarca);
    if (ficha.horario !== undefined) setHorario(ficha.horario);
    if (ficha.entrega !== undefined) setEntrega(ficha.entrega);
    if (ficha.comoComprar !== undefined) setComoComprar(ficha.comoComprar);
    if (ficha.comoAtiende !== undefined) setComoAtiende(ficha.comoAtiende);
    if (ficha.especialDia !== undefined) setEspecialDia(ficha.especialDia);
    setSeccionInvalida(null);
    setError(null);
  }, []);

  const recuperarBorrador = useCallback(() => {
    if (!borrador) return;
    aplicarFicha(borrador);
    setBorrador(null);
    toast.success("Recuperada la ficha sin guardar");
  }, [borrador, aplicarFicha]);

  /* Volver a lo último que confirmó el servidor, sin recargar la página. */
  const descartarCambios = useCallback(() => {
    aplicarFicha(JSON.parse(guardado.current) as BorradorFicha);
    borradorEscrito.current = false;
    try {
      window.localStorage.removeItem(claveBorradorFicha(place.id));
    } catch {
      /* Sin almacén no hay borrador que limpiar. */
    }
    setPendiente(false);
  }, [aplicarFicha, place.id]);

  const descartarBorrador = useCallback(() => {
    setBorrador(null);
    try {
      window.localStorage.removeItem(claveBorradorFicha(place.id));
    } catch {
      /* Nada que limpiar si el almacén no está. */
    }
  }, [place.id]);

  /* La misma red que el catálogo: el armazón pregunta antes de cambiar de
     sección y el navegador antes de cerrar la pestaña. Se retira sola cuando no
     queda nada pendiente, incluido el instante posterior a guardar. */
  useEffect(() => {
    if (!sucio) return;
    const bajaGuarda = registrarGuarda(() =>
      window.confirm(
        "Tienes cambios sin guardar en la ficha. Si sales ahora se descartan. ¿Salir igual?",
      ),
    );
    const alCerrar = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", alCerrar);
    return () => {
      bajaGuarda();
      window.removeEventListener("beforeunload", alCerrar);
    };
  }, [sucio]);

  /* El foco se pide después del render que abre la sección: antes, el campo al
     que hay que llevar al dueño todavía no existía. */
  useEffect(() => {
    if (!enfocarCampo) return;
    const campo = document.getElementById(enfocarCampo);
    if (!campo) return;
    campo.focus();
    setEnfocarCampo(null);
  }, [enfocarCampo, seccionAbierta]);

  /* La marca roja se retira en cuanto el dueño toca lo que la provocó. */
  useEffect(() => {
    setSeccionInvalida(null);
  }, [name, location, whatsapp]);

  return (
    <>

      {/* El borrador de la visita anterior, si lo hay. Va arriba del todo porque
          es lo primero que hay que decidir: recuperarlo o tirarlo. */}
      {borrador && (
        <div
          role="status"
          className="mb-gap-md flex flex-wrap items-center gap-gap-sm rounded-2xl border border-verde-200 bg-verde-50 px-gap-md py-gap-sm"
        >
          <p className="min-w-0 flex-1 text-small text-ink">
            Nos quedó una ficha sin guardar de la última vez. ¿La recuperas?
          </p>
          <div className="flex shrink-0 items-center gap-gap-sm">
            <button
              type="button"
              onClick={recuperarBorrador}
              className="inline-flex min-h-11 cursor-pointer items-center rounded-full bg-verde-400 px-gap-md font-lv-display text-meta font-semibold text-verde-950 transition-colors duration-500 ease-outquint hover:bg-verde-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400/40"
            >
              Recuperar
            </button>
            <button
              type="button"
              onClick={descartarBorrador}
              className="inline-flex min-h-11 cursor-pointer items-center font-lv-display text-meta font-semibold text-ink-soft/75 transition-colors duration-500 ease-outquint hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400/40"
            >
              Descartar
            </button>
          </div>
        </div>
      )}

      <FormSections openId={seccionAbierta} onOpenChange={setSeccionAbierta}>
        <FormSection
          id="fotos"
          title="Fotos del lugar"
          icon={<ImageIcon size={18} strokeWidth={1.8} />}
        >
          {/* El logo va antes de la rejilla, como en el formulario de
              administración: es el que más se ve —círculo de la ficha,
              miniatura de las tarjetas y disco del pin— y la rejilla ocupa
              varios renglones, así que debajo quedaba enterrado. */}
          <LogoUpload
            placeId={place.id}
            value={logoUrl}
            onChange={setLogoUrl}
            className="mb-gap-lg"
          />
          <PhotoGrid placeId={place.id} placeName={name || place.name} />
        </FormSection>

        <FormSection
          id="basico"
          title="Información del negocio"
          icon={<Store size={18} strokeWidth={1.8} />}
          invalid={seccionInvalida === "basico"}
          autoOpen
        >
          <div className="grid grid-cols-1 gap-gap-md lg:grid-cols-2">
            <div className="flex flex-col gap-gap-xs">
              <Label htmlFor="bizName">Nombre del negocio</Label>
              <Input
                id="bizName"
                className={INPUT}
                aria-invalid={seccionInvalida === "basico" || undefined}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Paladar El Sabroso"
              />
            </div>
            <div className="flex flex-col gap-gap-xs">
              <Label htmlFor="bizCategory">Categoría</Label>
              <Select value={categoryValue} onValueChange={setCategoryValue}>
                <SelectTrigger id="bizCategory">
                  <SelectValue placeholder="Elige una" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      <span className="inline-flex items-center gap-2">
                        <CategoryIcon
                          icon={c.icon}
                          size={16}
                          strokeWidth={1.8}
                        />
                        {c.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-gap-xs">
              <Label htmlFor="bizBarrio">Barrio / Municipio</Label>
              <Input
                id="bizBarrio"
                className={INPUT}
                value={barrio}
                onChange={(e) => setBarrio(e.target.value)}
                placeholder="Ej: Centro histórico, Vista Alegre…"
              />
            </div>
            <div className="flex flex-col gap-gap-xs">
              <Label htmlFor="bizAddress">Dirección</Label>
              <Input
                id="bizAddress"
                className={INPUT}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Ej: Calle 12 #45, entre 7 y 9"
              />
            </div>
            <div className="flex flex-col gap-gap-xs">
              <Label htmlFor="bizPhone">Teléfono</Label>
              <Input
                id="bizPhone"
                type="tel"
                autoComplete="tel"
                className={INPUT}
                value={phone}
                onChange={(e) => setPhone(sanitizePhone(e.target.value))}
                placeholder="Ej: +53 5 123 4567"
              />
            </div>
            <div className="flex flex-col gap-gap-xs lg:col-span-2">
              <Label htmlFor="bizDesc">Descripción</Label>
              <textarea
                id="bizDesc"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe el negocio para que la IA lo recomiende mejor…"
                className="flex h-auto min-h-[100px] w-full resize-y rounded-xl border border-ink/10 bg-white px-4 py-3 text-body leading-relaxed text-ink outline-none transition-colors duration-500 ease-outquint placeholder:text-ink-soft/75 focus:border-verde-400 focus:ring-2 focus:ring-verde-400/30"
              />
            </div>
          </div>
        </FormSection>

        <FormSection
          id="contacto"
          title="Contacto"
          icon={<AtSign size={18} strokeWidth={1.8} />}
          invalid={seccionInvalida === "contacto"}
        >
          <p className="mb-gap-sm text-meta text-ink-soft/75">
            Enlaces que aparecen como botones en tu ficha. Todo es opcional: el
            que quede vacío no se pinta.
          </p>
          <div className="grid grid-cols-1 gap-gap-md lg:grid-cols-2">
            <div className="flex flex-col gap-gap-xs">
              <Label htmlFor="bizWebsite">Sitio web</Label>
              <Input
                id="bizWebsite"
                name="website"
                type="url"
                inputMode="url"
                autoComplete="url"
                spellCheck={false}
                className={INPUT}
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="Ej: laverde.cu"
              />
            </div>
            <div className="flex flex-col gap-gap-xs">
              <Label htmlFor="bizWhatsapp">WhatsApp</Label>
              <Input
                id="bizWhatsapp"
                type="tel"
                autoComplete="tel"
                className={INPUT}
                aria-invalid={seccionInvalida === "contacto" || undefined}
                value={whatsapp}
                onChange={(e) => setWhatsapp(sanitizePhone(e.target.value))}
                placeholder="Ej: +53 5 123 4567"
              />
              <p className="text-meta text-ink-soft/75">
                Número distinto del teléfono: es el que abre la conversación.
              </p>
            </div>
            <div className="flex flex-col gap-gap-xs">
              <Label htmlFor="bizInstagram">Instagram</Label>
              <Input
                id="bizInstagram"
                name="instagram"
                type="url"
                inputMode="url"
                spellCheck={false}
                className={INPUT}
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                placeholder="https://instagram.com/laverde"
              />
            </div>
            <div className="flex flex-col gap-gap-xs">
              <Label htmlFor="bizFacebook">Facebook</Label>
              <Input
                id="bizFacebook"
                name="facebook"
                type="url"
                inputMode="url"
                spellCheck={false}
                className={INPUT}
                value={facebook}
                onChange={(e) => setFacebook(e.target.value)}
                placeholder="https://facebook.com/laverde"
              />
            </div>
          </div>
        </FormSection>

        <FormSection
          id="ubicacion"
          title="Ubicación en el mapa"
          icon={<MapPin size={18} strokeWidth={1.8} />}
          invalid={seccionInvalida === "ubicacion"}
        >
          <p className="mb-gap-sm text-meta text-ink-soft/75">
            Busca tu dirección, elige la coincidencia y ajusta el pin. Ese punto
            es el que ven los usuarios cuando piden cómo llegar.
          </p>
          <MapLocationPicker
            value={location}
            onChange={setLocation}
            onResolved={(r, anterior) => {
              /* Lo escrito a mano no se pisa; el relleno automático sigue al pin. */
              setAddress((prev) => campoResuelto(prev, r?.address, anterior?.address));
              setBarrio((prev) => campoResuelto(prev, r?.barrio, anterior?.barrio));
            }}
          />
        </FormSection>

        <FormSection
          title="Icono del negocio"
          icon={
            <CategoryIcon icon={resolvedIcon} size={18} strokeWidth={1.8} />
          }
        >
          <p className="mb-gap-sm text-meta text-ink-soft/75">
            Es el dibujo que llevas en el pin del mapa, en el popup y en tu
            tarjeta. Mientras no elijas uno llevas el de tu categoría.
          </p>
          <IconPicker
            value={resolvedIcon}
            onChange={setIcon}
            label="Icono del negocio"
            preview={name || "Tu negocio"}
          />
          {icon !== null && (
            <button
              type="button"
              onClick={() => setIcon(null)}
              className="mt-gap-sm inline-flex min-h-11 cursor-pointer items-center self-start font-lv-display text-meta font-semibold text-verde-600 transition-colors duration-500 ease-outquint hover:text-verde-700"
            >
              Usar el de mi categoría
            </button>
          )}
        </FormSection>

        <FormSection
          id="horario"
          title="Horario"
          icon={<Clock size={18} strokeWidth={1.8} />}
          invalid={seccionInvalida === "horario"}
        >
          {/* Texto libre: etiqueta de respaldo y referencia rápida en el
              directorio («10:00 – 22:00», «24 horas»). Lo usa `EstadoApertura`
              cuando no hay horario estructurado. */}
          <div className="flex flex-col gap-gap-xs">
            <Label htmlFor="bizSchedule">Horario (texto)</Label>
            <p className="text-meta text-ink-soft/70">
              Aparece en el directorio. Si rellenas el horario por día de abajo,
              ese es el que usa la ficha y este texto pasa a ser solo referencia.
            </p>
            <Input
              id="bizSchedule"
              className={INPUT}
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
              placeholder="Ej: 10:00 – 22:00"
            />
            <div className="flex flex-wrap gap-[6px]">
              {SCHEDULE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setSchedule(preset)}
                  aria-pressed={schedule === preset}
                  className={cn(
                    "min-h-11 cursor-pointer select-none rounded-full border px-[14px] py-2 font-lv-display text-meta font-medium transition-colors duration-500 ease-outquint active:scale-[0.98]",
                    schedule === preset
                      ? "border-verde-400 bg-verde-400 text-verde-950 shadow-soft"
                      : "border-ink/10 bg-white text-ink-soft/75 hover:border-verde-300 hover:bg-verde-50 hover:text-verde-600",
                  )}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Separador */}
          <div className="my-gap-md border-t border-ink/5" />

          {/* Horario estructurado: la ficha lo usa para mostrar «Abierto» /
              «Cerrado» con la hora exacta y recalcularlo cada minuto. */}
          <div className="flex flex-col gap-gap-xs">
            <p className="font-lv-display text-small font-semibold text-ink">
              Horario por día
            </p>
            <p className="text-meta text-ink-soft/70">
              La ficha muestra «Abierto» o «Cerrado» con la hora exacta, actualizado
              cada minuto. Si lo rellenas, no hace falta tocar el texto de arriba.
            </p>
            <HorarioEditor value={horario} onChange={setHorario} />
            {horario && (
              <button
                type="button"
                onClick={() => setHorario(null)}
                className="mt-gap-xs inline-flex min-h-11 cursor-pointer items-center self-start font-lv-display text-meta text-ink-soft/75 hover:text-ink"
              >
                Borrar horario por día
              </button>
            )}
          </div>
        </FormSection>

        <FormSection
          title="Métodos de pago"
          icon={<CreditCard size={18} strokeWidth={1.8} />}
        >
          <p className="mb-gap-sm text-meta text-ink-soft/75">
            Las monedas y métodos que aceptas. Aparecen en tu ficha y en los
            filtros.
          </p>
          {/* Controlado: «Descartar cambios» devuelve la selección al estado
              guardado, y con el estado interno del componente los chips
              seguirían enseñando lo que se iba a descartar. */}
          <PaymentChips value={payments} onChange={setPayments} />
        </FormSection>

        {/* ── Tipo de negocio y módulos ──────────────────────────────── */}
        <FormSection
          id="tipo"
          title="Tipo de negocio y bloques"
          icon={<Store size={18} strokeWidth={1.8} />}
          invalid={seccionInvalida === "tipo"}
        >
          <p className="mb-gap-sm text-meta text-ink-soft/75">
            El tipo define los valores por defecto de la ficha. Los bloques
            añaden secciones específicas —domicilio, tienda, servicios— que
            el visitante verá con sus precios y condiciones.
          </p>
          <ModulosEditor
            tipoNegocio={tipoNegocio}
            onTipoChange={setTipoNegocio}
            modulosActivos={modulosActivos}
            onModulosChange={setModulosActivos}
            entrega={entrega}
            onEntregaChange={setEntrega}
            comoComprar={comoComprar}
            onComoComprarChange={setComoComprar}
            comoAtiende={comoAtiende}
            onComoAtiendeChange={setComoAtiende}
            especialDia={especialDia}
            onEspecialDiaChange={setEspecialDia}
          />
        </FormSection>

        {/* ── Atributos ─────────────────────────────────────────────── */}
        <FormSection
          title="Qué tiene el negocio"
          icon={<Package size={18} strokeWidth={1.8} />}
        >
          <p className="mb-gap-sm text-meta text-ink-soft/75">
            Lo que tienes aparece como distintivos en tu ficha. Solo marca lo
            que de verdad ofreces — un atributo que no tienes desanima a quien
            llega esperándolo.
          </p>
          <AtributosChips
            value={atributos}
            onChange={setAtributos}
            tipoNegocio={tipoNegocio}
          />
        </FormSection>

        {/* ── Marca ─────────────────────────────────────────────────── */}
        <FormSection
          id="marca"
          title="Color de marca"
          icon={<Eye size={18} strokeWidth={1.8} />}
          invalid={seccionInvalida === "marca"}
        >
          <p className="mb-gap-sm text-meta text-ink-soft/75">
            Se usa como fondo de la portada cuando no tienes fotos, y como
            color del monograma. Escribe un color en formato hex (#RRGGBB).
          </p>
          <div className="flex items-center gap-gap-md">
            <input
              type="color"
              aria-label="Color de marca"
              value={colorMarca || COLOR_MARCA_POR_DEFECTO}
              onChange={(e) => setColorMarca(e.target.value)}
              className="h-11 w-16 cursor-pointer rounded-lg border border-ink/10 p-1"
            />
            <Input
              id="bizColorHex"
              aria-label="Color de marca en hexadecimal"
              className="h-11 w-32 rounded-xl border-ink/10 bg-white font-mono text-body"
              value={colorMarca}
              onChange={(e) => setColorMarca(e.target.value)}
              placeholder={COLOR_MARCA_POR_DEFECTO}
              maxLength={7}
            />
            {colorMarca && (
              <button
                type="button"
                onClick={() => setColorMarca("")}
                className="inline-flex min-h-11 cursor-pointer items-center font-lv-display text-meta text-ink-soft/75 hover:text-ink"
              >
                Quitar
              </button>
            )}
          </div>
        </FormSection>

        <FormSection
          title="Energía de respaldo"
          icon={<Zap size={18} strokeWidth={1.8} />}
        >
          <p className="mb-gap-sm text-meta text-ink-soft/75">
            Cuando se va la luz, ¿qué tienes para seguir? Se enseña en tu ficha
            y en tu pin del mapa, y quien busque «con corriente» te encuentra
            por esto. Si no lo rellenas, no se dice nada — un hueco no es lo
            mismo que un «no».
          </p>
          <div className="grid grid-cols-1 gap-gap-md lg:grid-cols-2">
            <div className="flex flex-col gap-gap-xs">
              <Label htmlFor="bizEnergia">Respaldo</Label>
              <Select
                value={energia}
                onValueChange={(value) =>
                  setEnergia(value as EnergiaRespaldo | "sin")
                }
              >
                <SelectTrigger id="bizEnergia">
                  <SelectValue placeholder="Elige" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sin">Prefiero no decirlo</SelectItem>
                  {ENERGIA_ORDER.map((valor) => (
                    <SelectItem key={valor} value={valor}>
                      {ENERGIA_LABEL[valor]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-gap-xs">
              <Label htmlFor="bizNotaApagon">Cómo lo llevas (opcional)</Label>
              <Input
                id="bizNotaApagon"
                className={INPUT}
                maxLength={140}
                value={notaApagon}
                onChange={(e) => setNotaApagon(e.target.value)}
                placeholder="Ej: la planta cubre el salón y la cocina"
              />
            </div>
          </div>
        </FormSection>

        <AnimatePresence>
          {error && (
            <motion.p
              key="biz-error"
              role="alert"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-[7px] text-meta font-medium text-ink"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>
      </FormSections>

      {/* La barra de guardado pegada abajo. Antes no había forma de saber si los
          cambios se habían escrito: el `SaveBar` que había publicaba contra
          nada. Este llama al `PATCH` de verdad y avisa cuando el servidor
          confirma. */}
      <div className="sticky bottom-above-nav z-40 mt-gap-lg flex flex-col gap-gap-sm lg:bottom-4">
        {/* Estado y descarte. Antes no había señal de trabajo pendiente y la
            única salida era recargar; el catálogo ya lo dice y esta es la
            pantalla más larga del panel. */}
        <div className="flex items-center justify-between gap-gap-sm sm:justify-end">
          <span
            role="status"
            aria-live="polite"
            className="font-lv-display text-meta text-ink-soft/75"
          >
            {saving ? "Guardando…" : pendiente ? "Cambios sin guardar" : ""}
          </span>
          {pendiente && !saving && (
            <button
              type="button"
              onClick={descartarCambios}
              className="inline-flex min-h-11 cursor-pointer items-center font-lv-display text-meta font-semibold text-ink-soft/75 transition-colors duration-500 ease-outquint hover:text-ink"
            >
              Descartar cambios
            </button>
          )}
        </div>
        {/* En móvil, uno debajo del otro y el primario arriba: en fila no caben
            a 320 px, que es lo que le pasaba al `SaveBar` retirado. */}
        <div className="flex flex-col-reverse gap-gap-sm sm:flex-row sm:justify-end">
          <a
            href={`/place/${place.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 cursor-pointer items-center justify-center gap-gap-xs rounded-full border border-ink/10 bg-white px-gap-lg font-lv-display text-small font-semibold text-ink transition-colors duration-500 ease-outquint hover:border-verde-300 hover:bg-verde-50 hover:text-verde-600"
          >
            <Eye size={16} strokeWidth={1.8} />
            Ver ficha
          </a>
          <BotonPrimario alto="lg" onClick={save} disabled={saving}>
            {saving ? (
              <Loader2 size={16} strokeWidth={1.8} className="animate-spin" />
            ) : (
              <Save size={16} strokeWidth={1.8} />
            )}
            {saving ? "Guardando…" : "Guardar cambios"}
          </BotonPrimario>
        </div>
      </div>
    </>
  );
}
