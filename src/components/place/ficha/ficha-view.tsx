"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlaceDetailProps } from "@/lib/ficha/place-data";
import { resolverAcciones, type DatosAcciones } from "@/lib/ficha/acciones";
import { ACCIONES_SIN_TIPO, COPY, tituloCatalogo } from "@/config/ficha";
import {
  isSaved as isPlaceSaved,
  recordVisit,
  toggleSaved,
} from "@/lib/activity-store";
import { trackPlaceSaveToggled, trackPlaceViewed } from "@/lib/analytics";
import { trackPlaceMetric } from "@/lib/place-metrics";
import { trackEvento } from "@/lib/eventos-client";
import { fetchMe } from "@/lib/session-client";
import { mensajePedido, hrefPedido, totalDePedido, type LineaPedido } from "@/lib/pedido";
import { formatMenuPrice } from "@/lib/utils";
import { OfferBanner } from "../offer-banner";
import { PaymentsSection } from "../payments-section";
import { ReviewDialog } from "../review-dialog";
import { CabeceraFicha } from "./cabecera-ficha";
import { Catalogo } from "./catalogo";
import { DireccionContacto } from "./direccion-contacto";
import { Distintivos } from "./distintivos";
import { EstadoApertura } from "./estado-apertura";
import { FilaAcciones } from "./fila-acciones";
import { Galeria } from "./galeria";
import { PortadaMarca } from "./portada-marca";
import { ResenasResumen } from "./resenas-resumen";
import { SobreElLugar } from "./sobre-el-lugar";
import { TarjetaClave } from "./tarjeta-clave";
import { BarraFija } from "./barra-fija";

const CARD = "bg-white rounded-2xl border border-ink/5 shadow-soft p-gap-lg";

/**
 * La ficha pública de un negocio.
 *
 * El esqueleto común: portada → cabecera → estado y distintivos → acciones →
 * dirección/contacto → sobre el lugar → catálogo → galería → reseñas → barra
 * fija. Las secciones nuevas viven en `./*` y cada una decide esconderse cuando
 * no tiene nada que decir; aquí solo se colocan y se comparten los gestos
 * (guardar, compartir, llegar, opinar).
 *
 * La maqueta de proyectos no pasa por aquí: `PlaceDetail` la deja intacta en su
 * rama de siempre.
 */
export function FichaView({
  place,
  state = "normal",
  onBack,
  onShare,
  onNavigate,
  footerSlot,
  className,
  nowIso,
}: PlaceDetailProps) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewsKey, setReviewsKey] = useState(0);
  const [carrito, setCarrito] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchMe<{ authenticated: boolean; user: { id?: string } | null }>()
      .then((data) => {
        if (data.authenticated && data.user?.id) setUserId(data.user.id);
      })
      .catch(() => {});
  }, []);

  const viewTracked = useRef<string | null>(null);
  useEffect(() => {
    if (viewTracked.current === place.id) return;
    viewTracked.current = place.id;
    recordVisit(
      { id: place.id, name: place.name, category: place.category },
      userId,
    );
    trackPlaceMetric(place.id, "view");
    trackEvento({ tipo: "vista_perfil", negocioId: place.id });
    trackPlaceViewed({
      id: place.id,
      name: place.name,
      category: place.category,
      barrio: place.barrio,
    });
  }, [place.id, place.name, place.category, place.barrio, userId]);

  useEffect(() => {
    setSaved(isPlaceSaved(place.id, userId));
  }, [place.id, userId]);

  const cartaHref = userId
    ? `/m/${place.slug}?volver=home`
    : `/m/${place.slug}`;

  const isClosed = state === "closed" || (!place.isOpen && state !== "oferta");

  const datos: DatosAcciones = {
    telefono: place.phone,
    whatsapp: place.contact.whatsapp,
    enlaceSeguidores: place.seguidores?.enlace,
    pedidosHabilitado: place.pedidosHabilitado,
    reservaHabilitada: place.reservaHabilitada,
    tipoReserva: place.reserva?.tipo,
  };
  const acciones = resolverAcciones(
    {
      fila: place.acciones?.fila ?? ACCIONES_SIN_TIPO.fila,
      barra: place.acciones?.barra ?? [],
    },
    datos,
  );

  const esReserva = (accion: string) =>
    accion === "reservar" || accion === "apartar" || accion === "cita";
  const mostrarReservaEnContacto =
    Boolean(place.reserva) && !acciones.barra.some(esReserva);
  const mostrarSeguidoresEnContacto =
    Boolean(place.seguidores) && !acciones.fila.includes("ofertas");

  const titulo = tituloCatalogo(place.catalogoTitulo, place.tipoNegocio);
  const ofertas = place.ofertas ?? [];

  /* Carrito: solo activo si el módulo domicilio está encendido y el plan lo
     permite. Sin ambas condiciones no hay botones + ni barra de carrito. */
  const carritoActivo =
    place.modulosActivos.includes("domicilio") && place.pedidosHabilitado;

  /* «Pedir cita» por ítem: solo cuando el módulo servicios está activo y el
     negocio tiene WhatsApp. El URL lo construye Catalogo por ítem. */
  const whatsappCita =
    place.modulosActivos.includes("servicios") && place.contact.whatsapp
      ? place.contact.whatsapp
      : undefined;

  function agregarAlCarrito(id: string) {
    setCarrito((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
  }

  function quitarDelCarrito(id: string) {
    setCarrito((prev) => {
      const qty = (prev[id] ?? 0) - 1;
      if (qty <= 0) {
        const { [id]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: qty };
    });
  }

  /* Líneas del carrito para `mensajePedido` y la barra fija. */
  const carritoLineas: LineaPedido[] = Object.entries(carrito)
    .filter(([, qty]) => qty > 0)
    .flatMap(([id, qty]) => {
      const item = place.menu.find((m) => m.id === id);
      if (!item) return [];
      return [{ id, name: item.name, price: item.price, currency: item.currency, qty }];
    });

  const carritoHref =
    carritoActivo && carritoLineas.length > 0 && place.contact.whatsapp
      ? hrefPedido(
          place.contact.whatsapp,
          mensajePedido({ negocio: place.name, lineas: carritoLineas }),
        )
      : undefined;

  const carritoLabel = (() => {
    if (!carritoHref) return undefined;
    const n = carritoLineas.reduce((sum, l) => sum + l.qty, 0);
    const total = totalDePedido(carritoLineas);
    const totalStr = total
      ? ` · ${formatMenuPrice(String(total.total), total.currency)}`
      : "";
    return `${COPY.pedir} ${n}${totalStr}`;
  })();

  function handleSave() {
    const next = toggleSaved(place.id, userId);
    setSaved(next);
    trackPlaceMetric(place.id, "save");
    trackPlaceSaveToggled(place.id, place.name, next);
  }

  function handleNavigate() {
    trackEvento({ tipo: "click_como_llegar", negocioId: place.id });
    onNavigate?.();
  }

  function handlePublished() {
    setReviewsKey((key) => key + 1);
    /* Las cifras del resumen vienen del servidor; sin refrescar, la persona que
       acaba de opinar seguiría viendo el total de antes. */
    router.refresh();
  }

  return (
    <div className={cn("min-h-dvh bg-sand font-lv text-ink", className)}>
      <h1 className="sr-only">{place.name}</h1>

      <header className="safe-top sticky top-0 z-50 flex h-header items-center gap-gap-sm border-b border-ink/5 bg-sand-warm/90 px-gutter backdrop-blur-[16px]">
        <button
          type="button"
          onClick={onBack}
          className="grid size-10 place-items-center rounded-full text-ink-soft/75 transition-colors duration-500 ease-outquint hover:bg-verde-50 hover:text-verde-600"
          aria-label="Volver al mapa"
        >
          <ArrowLeft size={20} strokeWidth={1.8} />
        </button>
        <span className="flex-1 truncate font-lv-display text-small font-semibold text-ink">
          {place.name}
        </span>
      </header>

      {/* ─────────────── Escritorio ─────────────── */}
      <div className="hidden lg:block lg:mx-auto lg:max-w-container lg:px-gutter-lg lg:py-gap-xl">
        <PortadaMarca
          name={place.name}
          category={place.category}
          icon={place.icon}
          slides={place.slides}
          colorMarca={place.colorMarca}
          portadaEncuadre={place.portadaEncuadre}
          className="rounded-4xl"
        />

        <section className="mt-gap-lg">
          <CabeceraFicha place={place} />
          <div className="mt-gap-md flex flex-col gap-gap-sm">
            <EstadoApertura
              horario={place.horario}
              status={place.status}
              cerradoMensaje={place.cerradoMensaje}
              schedule={place.schedule}
              nowIso={nowIso}
            />
            <Distintivos
              atributos={place.atributos}
              energiaRespaldo={place.energiaRespaldo}
              notaApagon={place.notaApagon}
              selloVerificado={place.selloVerificado}
              topDelMes={place.topDelMes}
            />
          </div>
          <FilaAcciones
            acciones={acciones.fila}
            phone={place.phone}
            whatsapp={place.contact.whatsapp}
            enlaceOfertas={place.seguidores?.enlace}
            isSaved={saved}
            onSave={handleSave}
            onShare={onShare}
            onNavigate={handleNavigate}
            className="mt-gap-md"
          />
          <TarjetaClave
            modulosActivos={place.modulosActivos}
            entrega={place.entrega}
            comoComprar={place.comoComprar}
            comoAtiende={place.comoAtiende}
            especialDia={place.especialDia}
            className="mt-gap-md"
          />
        </section>

        <div className="mt-gap-lg grid grid-cols-[minmax(0,350px)_minmax(0,1fr)] items-start gap-gap-lg">
          <div className="sticky top-[calc(var(--header-h)+var(--gap-lg))] flex flex-col gap-gap-md">
            <DireccionContacto
              place={place}
              mostrarReserva={mostrarReservaEnContacto}
              mostrarSeguidores={mostrarSeguidoresEnContacto}
              onNavigate={handleNavigate}
            />

            {place.payments.length > 0 && (
              <div className={cn(CARD, "p-gap-md")}>
                <PaymentsSection
                  payments={place.payments}
                  className="mb-0 px-0"
                />
              </div>
            )}

            {ofertas.map((oferta) => (
              <OfferBanner
                key={oferta.id}
                label={COPY.oferta}
                text={oferta.titulo}
                description={oferta.descripcion}
                precio={oferta.precio}
                expiry={oferta.termina}
                visible
                className="mb-0"
              />
            ))}
          </div>

          <div className="flex min-w-0 flex-col gap-gap-lg">
            <SobreElLugar
              className={CARD}
              shortDescription={place.shortDescription}
              description={place.description}
            />

            {place.menu.length > 0 && (
              <Catalogo
                className={CARD}
                items={place.menu}
                categorias={place.menuCategorias}
                titulo={titulo}
                existenciasModo={place.existenciasModo}
                catalogoActualizadoEn={place.catalogoActualizadoEn}
                cartaHref={cartaHref}
                tipoNegocio={place.tipoNegocio}
                modulosActivos={place.modulosActivos}
                especialDia={place.especialDia}
                carrito={carritoActivo ? carrito : undefined}
                onAgregar={carritoActivo ? agregarAlCarrito : undefined}
                onQuitar={carritoActivo ? quitarDelCarrito : undefined}
                whatsappCita={whatsappCita}
              />
            )}

            <Galeria
              className={CARD}
              local={place.galeria.local}
              trabajos={place.galeria.trabajos}
            />

            <ResenasResumen
              className={CARD}
              placeId={place.id}
              rating={place.reviewsStats}
              destacada={place.resenaDestacada}
              reloadKey={reviewsKey}
              onOpinion={() => setReviewOpen(true)}
            />

            {footerSlot}
          </div>
        </div>
      </div>

      {/* ─────────────── Móvil ─────────────── */}
      <div className="lg:hidden">
        <PortadaMarca
          name={place.name}
          category={place.category}
          icon={place.icon}
          slides={place.slides}
          colorMarca={place.colorMarca}
          portadaEncuadre={place.portadaEncuadre}
        />

        <section className="bg-sand-warm px-gutter py-gap-lg">
          <CabeceraFicha place={place} />
          <div className="mt-gap-md flex flex-col gap-gap-sm">
            <EstadoApertura
              horario={place.horario}
              status={place.status}
              cerradoMensaje={place.cerradoMensaje}
              schedule={place.schedule}
              nowIso={nowIso}
            />
            <Distintivos
              atributos={place.atributos}
              energiaRespaldo={place.energiaRespaldo}
              notaApagon={place.notaApagon}
              selloVerificado={place.selloVerificado}
              topDelMes={place.topDelMes}
            />
          </div>
          <FilaAcciones
            acciones={acciones.fila}
            phone={place.phone}
            whatsapp={place.contact.whatsapp}
            enlaceOfertas={place.seguidores?.enlace}
            isSaved={saved}
            onSave={handleSave}
            onShare={onShare}
            onNavigate={handleNavigate}
            className="mt-gap-md"
          />
        </section>

        <TarjetaClave
          modulosActivos={place.modulosActivos}
          entrega={place.entrega}
          comoComprar={place.comoComprar}
          comoAtiende={place.comoAtiende}
          especialDia={place.especialDia}
          className="mx-gutter mt-gap-lg"
        />

        {isClosed && place.closedMessage && (
          <div className="mx-gutter mb-gap-md mt-gap-md flex items-center gap-gap-sm rounded-2xl border border-destructive/15 bg-destructive/5 p-gap-md">
            <div className="grid size-9 shrink-0 place-items-center rounded-2xl bg-destructive/10">
              <Clock size={18} strokeWidth={1.8} className="text-destructive" />
            </div>
            <div className="text-small leading-snug text-ink">
              {place.closedMessage}
            </div>
          </div>
        )}

        <SobreElLugar
          className="bg-sand-warm px-gutter py-gap-lg"
          shortDescription={place.shortDescription}
          description={place.description}
        />

        <DireccionContacto
          className="mx-gutter my-gap-lg"
          place={place}
          mostrarReserva={mostrarReservaEnContacto}
          mostrarSeguidores={mostrarSeguidoresEnContacto}
          onNavigate={handleNavigate}
        />

        {place.payments.length > 0 && (
          <div className="bg-sand-warm px-gutter pb-gap-lg">
            <PaymentsSection payments={place.payments} className="mb-0 px-0" />
          </div>
        )}

        {ofertas.length > 0 && (
          <div className="bg-sand-warm pt-gap-md">
            {ofertas.map((oferta) => (
              <OfferBanner
                key={oferta.id}
                label={COPY.oferta}
                text={oferta.titulo}
                description={oferta.descripcion}
                precio={oferta.precio}
                expiry={oferta.termina}
                visible
              />
            ))}
          </div>
        )}

        {place.menu.length > 0 && (
          <Catalogo
            className="bg-sand-warm px-gutter py-gap-lg"
            items={place.menu}
            categorias={place.menuCategorias}
            titulo={titulo}
            existenciasModo={place.existenciasModo}
            catalogoActualizadoEn={place.catalogoActualizadoEn}
            cartaHref={cartaHref}
            tipoNegocio={place.tipoNegocio}
            modulosActivos={place.modulosActivos}
            especialDia={place.especialDia}
            carrito={carritoActivo ? carrito : undefined}
            onAgregar={carritoActivo ? agregarAlCarrito : undefined}
            onQuitar={carritoActivo ? quitarDelCarrito : undefined}
            whatsappCita={whatsappCita}
          />
        )}

        <Galeria
          className="bg-sand-warm px-gutter pb-gap-lg"
          local={place.galeria.local}
          trabajos={place.galeria.trabajos}
        />

        <ResenasResumen
          className="bg-sand-warm px-gutter py-gap-lg"
          placeId={place.id}
          rating={place.reviewsStats}
          destacada={place.resenaDestacada}
          reloadKey={reviewsKey}
          onOpinion={() => setReviewOpen(true)}
        />

        {footerSlot}

        {/* Hueco para que la barra fija no tape el final de la ficha. */}
        {acciones.barra.length > 0 && <div className="h-24" />}
      </div>

      <div className="bg-sand pb-safe-bottom" />

      <BarraFija
        acciones={acciones.barra}
        place={place}
        carritoHref={carritoHref}
        carritoLabel={carritoLabel}
        onNavigate={handleNavigate}
      />

      <ReviewDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        placeId={place.id}
        placeName={place.name}
        onPublished={handlePublished}
      />
    </div>
  );
}
