"use client";

/**
 * Las tarjetas que vivían en «Ajustes» (`SettingsView`, que ya no existe).
 *
 * Se movieron **sin cambiar su lógica ni sus endpoints**; cada una vive ahora
 * donde se usa:
 * - Pedidos por WhatsApp → Pedidos › Ajustes de pedidos.
 * - Precios mixtos → Más › Precios y tasa.
 * - Reservas por WhatsApp → Más › Reservas.
 *
 * Los interruptores escriben al momento, optimistas y con vuelta atrás; el
 * formulario de reservas guarda con su botón, porque la plantilla se escribe a
 * medias y guardar en cada tecla dejaría a los clientes leyendo un mensaje
 * incompleto.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import {
  CalendarDays,
  ChevronDown,
  Coins,
  Loader2,
  MessageCircle,
  Save,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { bloqueoDe, type Funcion } from "@/lib/plans";
import { useCatalogo } from "@/providers/catalogo-provider";
import { usePlaces } from "@/providers/places-provider";
import {
  PLANTILLA_POR_DEFECTO,
  RESERVA_LABEL,
  TIPOS_RESERVA,
  fechaLocalIso,
  plantillaEfectiva,
  type TipoReserva,
} from "@/lib/reserva";
import type { UserPlace } from "@/lib/places-store";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { INPUT } from "@/components/business/ui/clases";
import { AvisoGuardado, useEstadoGuardado } from "@/components/business/ui/estado-guardado";
import { Chapita, FilaAjuste, TarjetaAjuste } from "@/components/business/ui/tarjeta";
import { CandadoPlan } from "@/components/business/ui/candado-plan";
import { Switch } from "@/components/business/ui/switch";

/* Vale el WhatsApp y, si no está, el teléfono: es el mismo móvil y es el
   criterio con el que se arma el enlace del pedido. */
function tieneNumeroDe(place: UserPlace): boolean {
  return Boolean(place.whatsapp?.trim() || place.phone?.trim());
}

/** Pedidos por WhatsApp: el plan enciende la función y el dueño la apaga a voluntad. */
export function TarjetaPedidosWhatsapp({
  place,
  funciones,
  onVerPlanes,
}: {
  place: UserPlace;
  funciones: Funcion[];
  onVerPlanes: () => void;
}) {
  const { updatePlace } = usePlaces();
  const cat = useCatalogo();
  const [pedidos, setPedidos] = useState(place.pedidosWhatsapp);
  const [cambiandoPedidos, setCambiandoPedidos] = useState(false);
  /* `null` si ya lo tiene. Es el mismo texto que usa el candado de «Hoy hay»:
     una sola forma de decir «esto se abre con un módulo o un pack». */
  const bloqueo = bloqueoDe(funciones, "whatsapp_pedido", cat);
  const tieneNumero = tieneNumeroDe(place);

  /**
   * El interruptor escribe al momento.
   *
   * Optimista y con vuelta atrás: se pinta el estado nuevo, se manda, y si el
   * servidor dice que no se devuelve el interruptor a donde estaba. Dejar el
   * interruptor en «sí» tras un guardado fallido sería peor que no moverse —
   * el dueño creería que sus pedidos están encendidos y no lo están.
   */
  async function alternarPedidos() {
    if (bloqueo || cambiandoPedidos) return;
    const siguiente = !pedidos;
    setCambiandoPedidos(true);
    setPedidos(siguiente);

    const guardado = await updatePlace(place.id, {
      pedidosWhatsapp: siguiente,
    });

    setCambiandoPedidos(false);
    if (!guardado) {
      setPedidos(!siguiente);
      toast.error("No se pudo cambiar. Revisa la conexión: no se cambió nada.");
      return;
    }
    toast.success(
      siguiente
        ? "Pedidos por WhatsApp activados en tu catálogo."
        : "Pedidos por WhatsApp desactivados. Tu catálogo sigue igual, sin carrito.",
    );
  }

  return (
        <TarjetaAjuste
          icono={MessageCircle}
          titulo="Pedidos por WhatsApp"
          estado={
            <Chapita tono={bloqueo ? "candado" : pedidos ? "activa" : "neutra"}>
              {bloqueo ?? (pedidos ? "Activo" : "Desactivado")}
            </Chapita>
          }
          apoyo="Tus clientes piden desde la carta y el pedido te llega por WhatsApp."
        >
          {bloqueo ? (
            <CandadoPlan
              onVerPlanes={onVerPlanes}
              texto="Tu carta se comparte igual; solo le falta el carrito."
            />
          ) : (
            <>
              <FilaAjuste
                titulo="Recibir pedidos en mi carta"
                detalle={
                  pedidos
                    ? "El carrito aparece en tu menú."
                    : "El carrito está oculto; tus productos se siguen viendo."
                }
                control={
                  <Switch
                    checked={pedidos}
                    onToggle={() => void alternarPedidos()}
                    label="Recibir pedidos en mi catálogo"
                  />
                }
              />

              {/* Con el plan puesto y los pedidos encendidos, el único motivo
                  por el que el carrito no sale es que falte el número. Se dice
                  aquí, que es donde el dueño lo está mirando. */}
              {pedidos && !tieneNumero && (
                <p className="mt-gap-sm rounded-xl border border-lv-amber/40 bg-lv-amber/10 px-3 py-[7px] text-meta font-medium text-ink">
                  Falta tu número de WhatsApp: sin él no hay a dónde mandar el
                  pedido y el carrito no se enseña. Añádelo en «Editar ficha»,
                  sección «Contacto».
                </p>
              )}
            </>
          )}
        </TarjetaAjuste>
  );
}

/** Precios mixtos: para todos los negocios, sin plan. */
export function TarjetaPreciosMixtos({
  place,
  esDueno,
}: {
  place: UserPlace;
  /** La tasa la pone solo el dueño (la ruta lo exige). */
  esDueno: boolean;
}) {
  const router = useRouter();
  /* Precios mixtos: para todos los negocios, sin plan. Escribe al momento
     por la ruta de la tasa y refresca para que «Precios y tasa» monte (o
     quite) la tarjeta de tasas, que va justo debajo. */
  const pista = esDueno
    ? "Pon tus tasas aquí debajo."
    : "Las tasas las pone el dueño del negocio.";
  const [mixtos, setMixtos] = useState(place.tasaActiva ?? false);
  const [cambiandoMixtos, setCambiandoMixtos] = useState(false);
  async function alternarMixtos() {
    if (cambiandoMixtos) return;
    const siguiente = !mixtos;
    setCambiandoMixtos(true);
    setMixtos(siguiente);
    const ok = await fetch(`/api/places/${place.id}/tasa`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activa: siguiente }),
    })
      .then((r) => r.ok)
      .catch(() => false);
    setCambiandoMixtos(false);
    if (!ok) {
      setMixtos(!siguiente);
      toast.error("No se pudo cambiar. Revisa la conexión: no se cambió nada.");
      return;
    }
    router.refresh();
    toast.success(
      siguiente
        ? `Precios mixtos activados. ${pista}`
        : "Precios mixtos desactivados. Tu carta vuelve a los precios de siempre.",
    );
  }

  return (
        <TarjetaAjuste
          icono={Coins}
          titulo="Precios mixtos"
          estado={
            <Chapita tono={mixtos ? "activa" : "neutra"}>
              {mixtos ? "Activo" : "Desactivado"}
            </Chapita>
          }
          apoyo="Tus clientes ven la carta en la moneda con la que van a pagar."
        >
          <FilaAjuste
            titulo="Mostrar mi carta en varias monedas"
            detalle={
              mixtos
                ? pista
                : "Tu carta se ve con los precios que escribiste."
            }
            control={
              <Switch
                checked={mixtos}
                onToggle={() => void alternarMixtos()}
                label="Mostrar mi carta en varias monedas"
              />
            }
          />
        </TarjetaAjuste>
  );
}

/** Reservas por WhatsApp: interruptor al momento y formulario con su botón. */
export function TarjetaReservas({
  place,
  funciones,
  onVerPlanes,
}: {
  place: UserPlace;
  funciones: Funcion[];
  onVerPlanes: () => void;
}) {
  const { updatePlace } = usePlaces();
  /* Reservas: el interruptor y el formulario van separados como en los pedidos
     —el interruptor escribe al momento, lo demás con su botón— porque el tipo y
     la plantilla se escriben a medias y guardar en cada tecla dejaría la ficha
     con un mensaje incompleto. */
  const [reservas, setReservas] = useState(place.aceptaReservas ?? false);
  const [reservaTipo, setReservaTipo] = useState<TipoReserva>(
    place.tipoReserva ?? "mesa",
  );
  const [aforo, setAforo] = useState(
    place.aforoMaxPersonas ? String(place.aforoMaxPersonas) : "",
  );
  const [plantilla, setPlantilla] = useState(place.plantillaReserva ?? "");
  const [cupoDia, setCupoDia] = useState(
    place.aforoDiarioPersonas ? String(place.aforoDiarioPersonas) : "",
  );
  const [cambiandoReservas, setCambiandoReservas] = useState(false);
  const [errorReservas, setErrorReservas] = useState<string | null>(null);
  /* Qué campo tiene la culpa, para marcar solo ese y unirle el mensaje.
     `null` con un error de red, que no es de ningún campo. */
  const [campoErrorReservas, setCampoErrorReservas] = useState<
    "aforo" | "cupo" | null
  >(null);

  /* El cupo que va gastado, por fecha. Se lee del mismo endpoint que usa el
     formulario del cliente —es la misma cifra— y sirve para dos cosas: decir
     «hoy van 12 de 40» y saber qué se libera al pulsar. `null` = todavía sin
     leer, que se pinta como «—» y no como cero. */
  const [ocupacion, setOcupacion] = useState<Record<string, number> | null>(
    null,
  );
  /* Vacía al montar y se rellena en el efecto: `new Date()` en el
     inicializador discrepa entre servidor y cliente cerca de medianoche o con
     otra zona horaria. */
  const [fechaCupo, setFechaCupo] = useState("");
  useEffect(() => {
    setFechaCupo(fechaLocalIso(new Date()));
  }, []);
  const [liberando, setLiberando] = useState(false);
  /* Liberar un día no se deshace solo, así que el botón no dispara a la
     primera: se convierte en la pregunta, con el número de personas que se
     van a soltar delante. */
  const [confirmandoLiberar, setConfirmandoLiberar] = useState(false);
  const cat = useCatalogo();
  const bloqueoReservas = bloqueoDe(funciones, "reservas_whatsapp", cat);
  const tieneNumero = tieneNumeroDe(place);


  /** El interruptor de reservas escribe al momento, igual que el de pedidos. */
  async function alternarReservas() {
    if (bloqueoReservas || cambiandoReservas) return;
    const siguiente = !reservas;
    setCambiandoReservas(true);
    setReservas(siguiente);

    const guardado = await updatePlace(place.id, {
      aceptaReservas: siguiente,
    });

    setCambiandoReservas(false);
    if (!guardado) {
      setReservas(!siguiente);
      toast.error("No se pudo cambiar. Revisa la conexión: no se cambió nada.");
      return;
    }
    toast.success(
      siguiente
        ? `Reservas activadas: tus clientes verán «${RESERVA_LABEL[reservaTipo]}».`
        : "Reservas desactivadas. Tu ficha sigue igual, sin el botón.",
    );
  }

  /* Lo último que confirmó el servidor: decide si hay algo que mandar y a qué
     se vuelve si el guardado falla. */
  const { estado: estadoReservas, guardar: guardarConEstado } = useEstadoGuardado();
  const reservasGuardadas = useRef({ tipo: reservaTipo, aforo, cupoDia, plantilla });

  /**
   * Guardado automático de la configuración de reservas.
   *
   * El tipo guarda al elegirlo; el aforo, el cupo y la plantilla al salir del
   * campo, **nunca mientras se escribe**: la plantilla es el mensaje que lee el
   * cliente y no puede quedar a medias. Un número inválido se marca y no se
   * envía. Si el servidor falla, todo vuelve a lo último guardado.
   */
  async function guardarReservas(
    cambio: Partial<{ tipo: TipoReserva; aforo: string; cupoDia: string; plantilla: string }> = {},
  ) {
    const v = { tipo: reservaTipo, aforo, cupoDia, plantilla, ...cambio };
    const aforoNum = v.aforo.trim() === "" ? null : Number(v.aforo);
    if (aforoNum !== null && (!Number.isInteger(aforoNum) || aforoNum < 1 || aforoNum > 1000)) {
      setErrorReservas("El aforo tiene que ser un número entero de personas, o quedar vacío.");
      setCampoErrorReservas("aforo");
      return;
    }
    const cupoNum = v.cupoDia.trim() === "" ? null : Number(v.cupoDia);
    if (cupoNum !== null && (!Number.isInteger(cupoNum) || cupoNum < 1 || cupoNum > 1000)) {
      setErrorReservas("El cupo diario tiene que ser un número entero de personas, o quedar vacío.");
      setCampoErrorReservas("cupo");
      return;
    }
    setErrorReservas(null);
    setCampoErrorReservas(null);

    const previo = reservasGuardadas.current;
    if (
      previo.tipo === v.tipo &&
      previo.aforo === v.aforo &&
      previo.cupoDia === v.cupoDia &&
      previo.plantilla === v.plantilla
    ) {
      return;
    }
    const ok = await guardarConEstado(async () => {
      const guardado = await updatePlace(place.id, {
        tipoReserva: v.tipo,
        /* El aforo y el cupo solo tienen sentido con mesa: al cambiar de tipo
           se limpian, para no dejar un tope que el formulario ya no enseña. */
        aforoMaxPersonas: v.tipo === "mesa" ? aforoNum : null,
        aforoDiarioPersonas: v.tipo === "mesa" ? cupoNum : null,
        plantillaReserva: v.plantilla.trim() || null,
      });
      if (!guardado) {
        toast.error("No se pudieron guardar las reservas. Revisa la conexión: no se cambió nada.");
      }
      return Boolean(guardado);
    });
    if (!ok) {
      setReservaTipo(previo.tipo);
      setAforo(previo.aforo);
      setCupoDia(previo.cupoDia);
      setPlantilla(previo.plantilla);
      return;
    }
    reservasGuardadas.current = v;
  }

  /** Lee el cupo gastado por fecha. Best-effort: sin red no se pinta cifra. */
  const cargarOcupacion = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/reservas?negocioId=${encodeURIComponent(place.id)}`,
      );
      if (!res.ok) return;
      const data = (await res.json()) as { dias?: Record<string, number> };
      setOcupacion(data.dias ?? {});
    } catch {
      /* Sin red el dueño ve «—»: no saber la cifra no es un error suyo. */
    }
  }, [place.id]);

  useEffect(() => {
    void cargarOcupacion();
  }, [cargarOcupacion]);

  /**
   * Devuelve el día a su cupo entero. Es el «a voluntad»: cancelaciones, sitio
   * extra, o volver a empezar la cuenta porque se llevaba mal.
   *
   * La confirmación la pone el botón antes de llamar aquí, y el número que se
   * pierde viaja al «Deshacer» del aviso: liberar borra la cifra de la base y
   * no hay otra copia de dónde sacarla. La fecha se captura al empezar y no se
   * vuelve a leer del estado: entre la llamada y el deshacer, el dueño puede
   * haber cambiado la fecha del campo.
   */
  async function liberarFecha() {
    if (liberando) return;
    const fecha = fechaCupo;
    const liberadas = ocupacion?.[fecha] ?? 0;
    setLiberando(true);
    try {
      const res = await fetch(
        `/api/reservas?negocioId=${encodeURIComponent(place.id)}&fecha=${encodeURIComponent(fecha)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        toast.error(
          "No se pudo liberar. Revisa la conexión: no se cambió nada.",
        );
        return;
      }
      setOcupacion((o) => {
        const copia = { ...(o ?? {}) };
        delete copia[fecha];
        return copia;
      });
      toast.success("Cupo liberado: ese día vuelve a estar entero.", {
        action:
          liberadas > 0
            ? {
                label: "Deshacer",
                onClick: () => void restaurarFecha(fecha, liberadas),
              }
            : undefined,
      });
    } catch {
      toast.error("No se pudo liberar. Revisa la conexión: no se cambió nada.");
    } finally {
      setLiberando(false);
    }
  }

  /** El «deshacer» de `liberarFecha`: vuelve a poner el número que se soltó. */
  async function restaurarFecha(fecha: string, personas: number) {
    try {
      const res = await fetch("/api/reservas", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ negocioId: place.id, fecha, personas }),
      });
      if (!res.ok) {
        toast.error("No se pudo deshacer: vuelve a apuntar el cupo a mano.");
        return;
      }
      setOcupacion((o) => ({ ...(o ?? {}), [fecha]: personas }));
      toast.success(`El día vuelve a estar con ${personas} apuntadas.`);
    } catch {
      toast.error("No se pudo deshacer. Revisa la conexión.");
    }
  }

  return (
        <TarjetaAjuste
          icono={CalendarDays}
          titulo="Reservas por WhatsApp"
          estado={
            <Chapita
              tono={bloqueoReservas ? "candado" : reservas ? "activa" : "neutra"}
            >
              {bloqueoReservas ?? (reservas ? "Activo" : "Desactivado")}
            </Chapita>
          }
          apoyo="Rellenan el formulario en tu ficha y la reserva te llega por WhatsApp."
        >
          {bloqueoReservas ? (
            <CandadoPlan
              onVerPlanes={onVerPlanes}
              texto="Tu ficha se comparte igual; solo le falta el botón de reservar."
            />
          ) : (
            <>
              <FilaAjuste
                titulo="Aceptar reservas"
                detalle={
                  reservas
                    ? "El botón aparece en tu ficha y en tu catálogo."
                    : "El botón está oculto; el resto de la ficha se ve igual."
                }
                control={
                  <Switch
                    checked={reservas}
                    onToggle={() => void alternarReservas()}
                    label="Aceptar reservas"
                  />
                }
              />

              {/* Con el plan puesto y las reservas encendidas, el único motivo
                  por el que el botón no sale es que falte el número. */}
              {reservas && !tieneNumero && (
                <p className="mt-gap-sm rounded-xl border border-lv-amber/40 bg-lv-amber/10 px-3 py-[7px] text-meta font-medium text-ink">
                  Falta tu número de WhatsApp: sin él no hay a dónde mandar la
                  reserva y el botón no se enseña. Añádelo en «Editar ficha»,
                  sección «Contacto».
                </p>
              )}

              {/* El formulario entero, plegado.

                  Son siete bloques —tipo, aforo, cupo diario, liberar un día,
                  plantilla, vista previa y guardar— y abiertos empujaban todo lo
                  que viene detrás fuera de la pantalla. `details` nativo y no el
                  `FormSection` del editor: aquel pinta su propia tarjeta, y una
                  tarjeta dentro de otra tarjeta queda mal. */}
              <details className="group mt-gap-md border-t border-ink/5 pt-gap-sm">
                {/* `min-h-11`: era una línea de texto con 4 px de relleno, unos
                    28 px de alto para el dedo. */}
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-gap-sm font-lv-display text-small font-semibold text-ink [&::-webkit-details-marker]:hidden">
                  Configurar la reserva
                  <ChevronDown
                    size={18}
                    strokeWidth={1.8}
                    className="shrink-0 text-ink-soft/75 transition-transform duration-300 ease-outquint group-open:rotate-180"
                  />
                </summary>

                <div className="mt-gap-sm flex flex-col gap-gap-md">
                  <div className="grid grid-cols-1 gap-gap-md lg:grid-cols-2">
                    <div className="flex flex-col gap-gap-xs">
                      <Label htmlFor="ajReservaTipo">Qué se reserva</Label>
                      <Select
                        value={reservaTipo}
                        onValueChange={(v) => {
                          setReservaTipo(v as TipoReserva);
                          void guardarReservas({ tipo: v as TipoReserva });
                        }}
                      >
                        <SelectTrigger id="ajReservaTipo">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIPOS_RESERVA.map((t) => (
                            <SelectItem key={t} value={t}>
                              {RESERVA_LABEL[t]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {reservaTipo === "mesa" && (
                      <div className="flex flex-col gap-gap-xs">
                        <Label htmlFor="ajAforo">Aforo máximo (opcional)</Label>
                        <Input
                          id="ajAforo"
                          type="number"
                          inputMode="numeric"
                          min={1}
                          aria-invalid={campoErrorReservas === "aforo" || undefined}
                          aria-describedby={
                            campoErrorReservas === "aforo" ? "aj-reservas-error" : undefined
                          }
                          value={aforo}
                          onChange={(e) => setAforo(e.target.value)}
                          onBlur={() => void guardarReservas()}
                          placeholder="Ej: 8"
                          className={INPUT}
                        />
                        <p className="text-meta text-ink-soft/75">
                          Vacío = sin tope.
                        </p>
                      </div>
                    )}
                  </div>

                  {reservaTipo === "mesa" && (
                    <div className="flex flex-col gap-gap-xs">
                      <Label htmlFor="ajCupoDia">Cupo diario (opcional)</Label>
                      <Input
                        id="ajCupoDia"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        aria-invalid={campoErrorReservas === "cupo" || undefined}
                        aria-describedby={
                          campoErrorReservas === "cupo" ? "aj-reservas-error" : undefined
                        }
                        value={cupoDia}
                        onChange={(e) => setCupoDia(e.target.value)}
                        onBlur={() => void guardarReservas()}
                        placeholder="Ej: 40"
                        className={INPUT}
                      />
                      <p className="text-meta text-ink-soft/75">
                        Se recarga cada día. Al llenarse, el formulario no deja
                        reservar esa fecha. Vacío = sin cupo.
                      </p>
                    </div>
                  )}

                  {/* Liberar el cupo de un día: lo que el dueño hace «a voluntad»
                    cuando le cancelan o cuando quiere volver a empezar la
                    cuenta. Solo con un cupo puesto —sin él no hay nada que
                    liberar—, y se enseña lo ocupado para saber qué se suelta. */}
                  {reservaTipo === "mesa" && cupoDia.trim() !== "" && (
                    <div className="rounded-2xl border border-ink/5 bg-sand-warm px-4 py-3">
                      <div className="font-lv-display text-meta font-semibold text-ink-soft/75">
                        Cupo de un día
                      </div>
                      <div className="mt-gap-xs flex flex-wrap items-center gap-gap-sm">
                        <Input
                          type="date"
                          value={fechaCupo}
                          onChange={(e) => setFechaCupo(e.target.value)}
                          aria-label="Día a liberar"
                          className={cn(INPUT, "w-auto")}
                        />
                        <span className="text-small tabular-nums text-ink-soft">
                          {ocupacion === null
                            ? "—"
                            : `${ocupacion[fechaCupo] ?? 0} de ${Number(cupoDia) || 0} ocupadas`}
                        </span>
                        {confirmandoLiberar ? (
                          <>
                            <span className="text-small font-semibold text-ink">
                              ¿Liberar{" "}
                              <span className="tabular-nums">
                                {ocupacion?.[fechaCupo] ?? 0}
                              </span>{" "}
                              de ese día?
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setConfirmandoLiberar(false);
                                void liberarFecha();
                              }}
                              disabled={liberando}
                              className="inline-flex h-11 cursor-pointer items-center rounded-full border border-destructive/40 bg-destructive/10 px-gap-md font-lv-display text-small font-semibold text-ink transition-colors duration-500 ease-outquint hover:bg-destructive/20 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60"
                            >
                              {liberando ? "Liberando…" : "Sí, liberar"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmandoLiberar(false)}
                              className="inline-flex h-11 cursor-pointer items-center rounded-full border border-ink/10 bg-white px-gap-md font-lv-display text-small font-semibold text-ink transition-colors duration-500 ease-outquint hover:border-verde-300 hover:text-verde-700 active:scale-[0.98]"
                            >
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmandoLiberar(true)}
                            disabled={liberando}
                            className="inline-flex h-11 cursor-pointer items-center rounded-full border border-ink/10 bg-white px-gap-md font-lv-display text-small font-semibold text-ink transition-colors duration-500 ease-outquint hover:border-verde-300 hover:text-verde-700 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60"
                          >
                            Liberar ese día
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col gap-gap-xs">
                    <Label htmlFor="ajPlantilla">Mensaje que te llega</Label>
                    <textarea
                      id="ajPlantilla"
                      rows={3}
                      value={plantilla}
                      onChange={(e) => setPlantilla(e.target.value)}
                      onBlur={() => void guardarReservas()}
                      placeholder={PLANTILLA_POR_DEFECTO[reservaTipo]}
                      className={cn(
                        INPUT,
                        "h-auto min-h-[84px] resize-y py-3 leading-relaxed",
                      )}
                    />
                    <p className="text-meta text-ink-soft/75">
                      Usa {"{nombre}"} {"{fecha}"} {"{hora}"} {"{personas}"} y,
                      para apartados, {"{producto}"} y {"{cantidad}"}. Vacío =
                      el mensaje de siempre.
                    </p>
                  </div>

                  {/* La vista previa usa la plantilla efectiva: con el campo
                    vacío enseña la de por defecto ya rellena con los huecos, que
                    es lo que verá el cliente. */}
                  <p className="whitespace-pre-wrap rounded-2xl border border-ink/5 bg-sand-warm px-4 py-3 text-small leading-relaxed text-ink-soft">
                    {plantillaEfectiva(reservaTipo, plantilla)}
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-gap-sm">
                    <p className="text-meta text-ink-soft/75">Se guarda al salir de cada campo.</p>
                    <AvisoGuardado estado={estadoReservas} />
                  </div>

                  <AnimatePresence>
                    {errorReservas && (
                      <motion.p
                        key="aj-reservas-error"
                        id="aj-reservas-error"
                        role="alert"
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{
                          duration: 0.25,
                          ease: [0.22, 1, 0.36, 1],
                        }}
                        className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-[7px] text-meta font-medium text-ink"
                      >
                        {errorReservas}
                      </motion.p>
                    )}
                  </AnimatePresence>

                </div>
              </details>
            </>
          )}
        </TarjetaAjuste>
  );
}
