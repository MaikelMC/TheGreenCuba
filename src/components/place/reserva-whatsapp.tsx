"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronDown, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { cn, generateId } from "@/lib/utils";
import { encolar } from "@/lib/offline/cola";
import { trackEvento } from "@/lib/eventos-client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  avisoCupo,
  DIAS_MAX_RESERVA,
  errorFechaReserva,
  fechaLocalIso,
  horaPasada,
  hrefReserva,
  mensajeReserva,
  RESERVA_LABEL,
  RESERVA_LABEL_CORTO,
  validarReserva,
  type DatosReserva,
  type ReservaConfig,
} from "@/lib/reserva";

/**
 * El botón «Reservar mesa» / «Apartar» / «Pedir cita» y su formulario corto.
 *
 * **Sin backend.** Al enviar se arma el mensaje y se abre `wa.me`; la reserva no
 * la guarda La Verde, no la cobra y no la confirma: quien contesta es el
 * negocio, por WhatsApp, como siempre. El único rastro es `click_reserva`, que
 * alimenta las estadísticas anónimas del dueño.
 *
 * Lo que se pinta lo decide el servidor: `reserva` solo llega cuando el plan
 * incluye la función, el dueño la acepta y hay número. Aquí no se comprueba
 * nada de eso — un candado de cliente no cierra nada y este, además, ni existe.
 *
 * El rastro es `click_reserva`, un gesto más como `click_whatsapp`: queda
 * registrado en las estadísticas anónimas del negocio. No es una reserva
 * confirmada.
 */

const INPUT =
  "h-11 w-full rounded-xl border border-ink/10 bg-white px-4 text-body text-ink placeholder:text-ink-soft/75 outline-none transition-colors duration-500 ease-outquint focus:border-verde-400 focus:ring-2 focus:ring-verde-400/20";

const LABEL = "font-lv-display text-meta font-semibold text-ink-soft/75";

/* Fecha y hora van en dos columnas. Los selectores de Safari en iPhone traen
   un ancho mínimo propio que ignora `w-full` y se salían por la derecha; el
   diálogo de pedidos lo resolvió igual: `min-w-0`, `max-w-full` y
   `appearance-none`, con el valor alineado a la izquierda. */
const INPUT_FECHA =
  "min-w-0 max-w-full appearance-none text-left [&::-webkit-date-and-time-value]:text-left";

type CampoReserva = "nombre" | "fecha" | "hora" | "personas" | "producto" | "cantidad";

/** El `id` de cada campo, para llevarle el foco cuando falla. */
const CAMPO_ID: Record<CampoReserva, string> = {
  nombre: "rvNombre",
  fecha: "rvFecha",
  hora: "rvHora",
  personas: "rvPersonas",
  producto: "rvProducto",
  cantidad: "rvCantidad",
};

const BTN_PRIMARY =
  "inline-flex h-11 cursor-pointer items-center justify-center gap-gap-xs rounded-full bg-verde-400 px-gap-md font-lv-display text-small font-semibold text-verde-950 shadow-primary-halo transition-colors duration-500 ease-outquint hover:bg-verde-300 active:scale-[0.98]";

const BTN_OUTLINE =
  "inline-flex h-11 cursor-pointer items-center justify-center gap-gap-xs rounded-full border border-ink/10 bg-white px-gap-md font-lv-display text-small font-semibold text-ink transition-colors duration-500 ease-outquint hover:border-verde-300 hover:bg-verde-50 hover:text-verde-600";

export function ReservaWhatsApp({
  reserva,
  negocioId,
  variant = "primary",
  className,
}: {
  reserva: ReservaConfig;
  /** Para contar el gesto contra el negocio correcto. */
  negocioId: string;
  variant?: "primary" | "outline";
  className?: string;
}) {
  const [abierto, setAbierto] = useState(false);

  const [nombre, setNombre] = useState("");
  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("");
  const [personas, setPersonas] = useState("");
  const [productoId, setProductoId] = useState("");
  const [cantidad, setCantidad] = useState("1");
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string | null>(null);
  /* Qué campo tiene la culpa: solo ese se marca y se le une el mensaje. */
  const [campoError, setCampoError] = useState<CampoReserva | null>(null);
  const [enviando, setEnviando] = useState(false);

  /** Los atributos de error de un campo: marcado y unido al aviso, solo si es él. */
  const errorDe = (campo: CampoReserva) =>
    campoError === campo && error
      ? { "aria-invalid": true as const, "aria-describedby": "rv-error" }
      : {};

  /** Al tocar el campo que tenía la culpa, el aviso se va: ya no describe lo
      que hay escrito, y dejarlo en rojo hace creer que sigue mal. */
  const limpiar = (campo: CampoReserva) => {
    if (campoError === campo) {
      setError(null);
      setCampoError(null);
    }
  };

  /* El cupo del día. `cupoVivo` arranca con lo que trajo la ficha y se refresca
     al abrir el diálogo: la ficha puede venir de una respuesta en caché y el
     cupo de un día se llena mientras la página está abierta. `ocupacion` es
     `Record<fecha, personas>`; `null` = todavía no se ha leído. */
  const [cupoVivo, setCupoVivo] = useState<number | null>(
    reserva.capacidadDiaria ?? null,
  );
  const [ocupacion, setOcupacion] = useState<Record<string, number> | null>(
    null,
  );

  /* Los límites del calendario se calculan al montar y no en el render: `new
     Date()` en el servidor y en el navegador puede caer en días distintos y el
     `min`/`max` del `<input>` sería otro, que es una discrepancia de hidratación
     con el usuario de por medio. */
  const [rango, setRango] = useState<{ min: string; max: string } | null>(null);
  useEffect(() => {
    const hoy = new Date();
    const limite = new Date(hoy);
    limite.setDate(limite.getDate() + DIAS_MAX_RESERVA);
    setRango({ min: fechaLocalIso(hoy), max: fechaLocalIso(limite) });
  }, []);

  const tipo = reserva.tipo;
  const producto = useMemo(
    () => reserva.productos.find((p) => p.id === productoId) ?? null,
    [reserva.productos, productoId],
  );

  const datos: DatosReserva = useMemo(
    () => ({
      nombre,
      fecha,
      hora,
      personas: tipo === "mesa" ? Number(personas) : undefined,
      producto: tipo === "apartado" ? (producto?.name ?? "") : undefined,
      cantidad: tipo === "apartado" ? Number(cantidad) : undefined,
      nota,
    }),
    [nombre, fecha, hora, tipo, personas, producto, cantidad, nota],
  );

  /* La vista previa del mensaje no es un adorno: es lo que deja ver que el texto
     que va a salir es el que se espera antes de abrir WhatsApp. */
  const vistaPrevia = mensajeReserva({
    negocio: reserva.negocio,
    tipo,
    plantilla: reserva.plantilla,
    datos,
  });

  /* Cuánto cabe todavía ese día, y el aviso si lo pedido no entra. El aviso se
     calcula también en el `render` —y no solo al enviar— porque el cupo se
     agota con el día ya elegido: enterarse al pulsar «Enviar» después de
     rellenar todo es tarde. */
  const ocupadasFecha = fecha ? (ocupacion?.[fecha] ?? 0) : 0;
  const restantes =
    tipo === "mesa" && cupoVivo && cupoVivo > 0 && fecha
      ? Math.max(0, cupoVivo - ocupadasFecha)
      : null;
  const avisoEnVivo =
    restantes === null
      ? null
      : /* `Math.max(…, 1)`: con el campo vacío no hay nada escrito que no quepa,
           pero un día lleno tiene que avisar igual. */
        avisoCupo(Math.max(Number(personas) || 0, 1), ocupadasFecha, cupoVivo);

  /** Lee el cupo de los próximos días. Best-effort: si falla, el POST decide. */
  async function cargarCupo() {
    const capacidad = reserva.capacidadDiaria ?? null;
    if (tipo !== "mesa" || !capacidad || capacidad <= 0) return;

    try {
      const res = await fetch(
        `/api/reservas?negocioId=${encodeURIComponent(negocioId)}`,
      );
      if (!res.ok) return;
      const data = (await res.json()) as {
        capacidad: number | null;
        dias?: Record<string, number>;
      };
      setCupoVivo(data.capacidad ?? capacidad);
      setOcupacion(data.dias ?? {});
    } catch {
      /* Sin red esto se queda como estaba: la ficha ya traía el cupo. */
    }
  }

  function abrir() {
    /* Se siembra el producto la primera vez, ahora que el diálogo se va a ver. */
    if (!productoId && reserva.productos[0]) {
      setProductoId(reserva.productos[0].id);
    }
    setError(null);
    setAbierto(true);
    void cargarCupo();
  }

  /**
   * Toma plaza en el servidor. Devuelve `"lleno"` cuando el día ya no da para
   * lo pedido y deja puesto el error; `"sin-red"` cuando no hubo respuesta o
   * fue un fallo pasajero (se encola); `"rechazado"` cuando el servidor dijo
   * que no por otro motivo (no se encola: fallaría igual). En los dos últimos
   * casos el WhatsApp sale igual: quien confirma es el negocio.
   */
  async function tomarCupoRemoto(): Promise<"ok" | "lleno" | "sin-red" | "rechazado"> {
    try {
      const res = await fetch("/api/reservas", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ negocioId, fecha, personas: Number(personas) }),
      });

      if (res.status === 409) {
        const data = (await res.json().catch(() => null)) as {
          restantes?: number;
        } | null;
        /* El servidor manda cuánto queda; el mensaje se arma con la misma
           función que el aviso en vivo para que digan lo mismo. */
        const quedan = data?.restantes ?? 0;
        /* Con la ocupación al día, el aviso en vivo ya dice cuánto queda y
           marca el campo. Antes se ponía además en `error` y salían dos cajas
           rojas con el mismo texto. */
        setOcupacion((o) => ({ ...(o ?? {}), [fecha]: cupoVivo! - quedan }));
        /* Se arregla bajando las personas o cambiando de día; el foco va a
           las personas, que es lo primero que se puede tocar. */
        document.getElementById(CAMPO_ID.personas)?.focus();
        return "lleno";
      }

      /* Solo vale reintentar lo pasajero: un 5xx o el tope por IP (429). Un
         400 o un 403 volvería a fallar igual al reenviarse desde la cola, y
         acabaría como «no pudo registrarse» sin motivo. */
      if (!res.ok) return res.status >= 500 || res.status === 429 ? "sin-red" : "rechazado";

      const data = (await res.json()) as { restantes?: number | null };
      if (typeof data.restantes === "number") {
        setOcupacion((o) => ({ ...(o ?? {}), [fecha]: cupoVivo! - data.restantes! }));
      }
      return "ok";
    } catch {
      return "sin-red";
    }
  }

  /**
   * Qué campo tiene la culpa del error. Repite, en el mismo orden, las
   * comprobaciones de `validarReserva`, que devuelve solo el texto: así el
   * mensaje sigue saliendo de un único sitio y aquí solo se decide a qué
   * campo se une y adónde va el foco.
   */
  function campoConError(): CampoReserva {
    if (!datos.nombre.trim()) return "nombre";
    if (errorFechaReserva(datos.fecha, new Date())) return "fecha";
    if (!datos.hora.trim() || horaPasada(datos.fecha, datos.hora)) return "hora";
    if (tipo === "apartado") {
      return datos.producto?.trim() ? "cantidad" : "producto";
    }
    /* Personas, aforo o cupo del día: los tres se arreglan cambiando cuántos van. */
    return "personas";
  }

  async function enviar() {
    const fallo = validarReserva(datos, tipo, new Date(), reserva.aforoMaxPersonas, {
      ocupadas: ocupadasFecha,
      capacidad: cupoVivo,
    });
    if (fallo) {
      const campo = campoConError();
      setError(fallo);
      setCampoError(campo);
      /* `focus-management` (ui-ux-pro-max): en un diálogo con scroll, el
         aviso al final no dice dónde está el problema; el foco sí. */
      document.getElementById(CAMPO_ID[campo])?.focus();
      return;
    }
    setCampoError(null);

    const href = hrefReserva(
      reserva.whatsapp,
      mensajeReserva({
        negocio: reserva.negocio,
        tipo,
        plantilla: reserva.plantilla,
        datos,
      }),
    );
    if (!href) {
      setError("Este negocio todavía no tiene un WhatsApp al que escribir.");
      return;
    }

    /* Tomar plaza antes de abrir WhatsApp: si el día se llenó entre que se abrió
       el formulario y se envió, la reserva no sale. Sin respuesta del servidor
       —red caída, que aquí es lo normal— se deja pasar: quien confirma es el
       negocio, y perder la reserva por un fallo de red sería peor que una plaza
       contada de más. */
    let ventana: Window | null = null;
    if (tipo === "mesa" && cupoVivo && cupoVivo > 0) {
      /* La pestaña se abre **aquí**, en el mismo toque, antes de esperar al
         servidor. Antes se abría después del `await`, y para entonces el
         navegador ya no lo contaba como gesto del cliente: Safari lo bloqueaba
         casi siempre, y Chrome si la respuesta tardaba unos segundos, que con
         datos móviles es lo normal. La plaza quedaba gastada y WhatsApp no
         se abría. Sin `noopener` porque hace falta la referencia para
         llevarla a WhatsApp; se corta el `opener` a mano en la línea de abajo. */
      ventana = window.open("", "_blank");
      if (ventana) {
        ventana.opener = null;
        ventana.document.title = "Abriendo WhatsApp…";
        ventana.document.body.textContent = "Comprobando el cupo y abriendo WhatsApp…";
      }

      setEnviando(true);
      const resultado = await tomarCupoRemoto();
      setEnviando(false);
      if (resultado === "lleno") {
        ventana?.close();
        return;
      }
      if (resultado === "sin-red") {
        /* Sin red, se encola para cuando vuelva la conexión. El WhatsApp sale
           igualmente. Si al reenviar no hay cupo (409), el dueño lo gestiona
           por WhatsApp, como hace siempre. */
        const idReserva = generateId();
        void encolar({
          id: idReserva,
          tipo: "reserva",
          ruta: "/api/reservas",
          metodo: "POST",
          cuerpo: JSON.stringify({ negocioId, fecha, personas: Number(personas) }),
        });
        toast("Guardaremos tu reserva en La Verde cuando vuelva la conexión.", {
          duration: 5000,
        });
      }
    }

    /* El gesto que al dueño le importa contar: la reserva que llegó a salir. */
    trackEvento({ tipo: "click_reserva", negocioId });
    const huboEspera = tipo === "mesa" && Boolean(cupoVivo && cupoVivo > 0);
    if (ventana && !ventana.closed) {
      /* La pestaña abierta en el toque se lleva ahora a WhatsApp. */
      ventana.location.href = href;
    } else if (huboEspera) {
      /* El navegador bloqueó hasta la pestaña del toque. Después del `await`
         otro `window.open` también se bloquearía, así que se navega en esta
         misma pestaña: la reserva tiene que salir. (Con `noopener`,
         `window.open` devuelve `null` aunque abra, así que no sirve para
         saber si funcionó.) */
      window.location.href = href;
      return;
    } else {
      /* Sin cupo que comprobar no hubo espera: esto sigue siendo el mismo
         toque y se abre como siempre. */
      window.open(href, "_blank", "noopener,noreferrer");
    }
    setAbierto(false);
  }

  const label = RESERVA_LABEL[tipo];
  /* La variante corta sale del mismo mapa que la larga y solo se pinta en
     móvil: es donde el botón no tiene ancho para la larga (ver el comentario
     de `RESERVA_LABEL_CORTO`). El diálogo y su título siguen con la larga. */
  const labelCorto = RESERVA_LABEL_CORTO[tipo];

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className={cn(variant === "primary" ? BTN_PRIMARY : BTN_OUTLINE, className)}
      >
        <CalendarDays size={16} strokeWidth={1.8} className="shrink-0" />
        <span className="sm:hidden">{labelCorto}</span>
        <span className="hidden sm:inline">{label}</span>
      </button>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        {/* `dvh` y no `vh`: en el iPhone, con la barra del navegador a la
            vista, `90vh` es más alto que la pantalla real y el botón de enviar
            quedaba por debajo. Mismo tope que el diálogo de pedidos. */}
        <DialogContent className="max-h-[calc(100dvh-32px)] overflow-y-auto overscroll-contain">
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>
            Rellena los datos y se abrirá WhatsApp con el mensaje escrito. El
            negocio te confirma por ahí.
          </DialogDescription>

          <form
            className="mt-gap-md flex flex-col gap-gap-sm"
            onSubmit={(e) => {
              e.preventDefault();
              void enviar();
            }}
          >
            <div className="flex flex-col gap-gap-xs">
              <label htmlFor="rvNombre" className={LABEL}>
                Tu nombre
              </label>
              <input
                id="rvNombre"
                value={nombre}
                onChange={(e) => {
                  setNombre(e.target.value);
                  limpiar("nombre");
                }}
                placeholder="Ej: Ana Pérez"
                className={INPUT}
                autoComplete="name"
                {...errorDe("nombre")}
              />
            </div>

            <div className="grid grid-cols-2 gap-gap-sm">
              <div className="flex min-w-0 flex-col gap-gap-xs">
                <label htmlFor="rvFecha" className={LABEL}>
                  Fecha
                </label>
                <input
                  id="rvFecha"
                  type="date"
                  value={fecha}
                  min={rango?.min}
                  max={rango?.max}
                  onChange={(e) => {
                    setFecha(e.target.value);
                    limpiar("fecha");
                    /* El fallo de «hora pasada» depende también del día. */
                    limpiar("hora");
                  }}
                  className={cn(INPUT, INPUT_FECHA)}
                  {...errorDe("fecha")}
                />
              </div>
              <div className="flex min-w-0 flex-col gap-gap-xs">
                <label htmlFor="rvHora" className={LABEL}>
                  Hora
                </label>
                <input
                  id="rvHora"
                  type="time"
                  value={hora}
                  onChange={(e) => {
                    setHora(e.target.value);
                    limpiar("hora");
                  }}
                  className={cn(INPUT, INPUT_FECHA)}
                  {...errorDe("hora")}
                />
              </div>
            </div>

            {tipo === "mesa" && (
              <div className="flex flex-col gap-gap-xs">
                <label htmlFor="rvPersonas" className={LABEL}>
                  Personas
                </label>
                <input
                  id="rvPersonas"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={reserva.aforoMaxPersonas ?? undefined}
                  value={personas}
                  onChange={(e) => {
                    setPersonas(e.target.value);
                    limpiar("personas");
                  }}
                  placeholder="Ej: 4"
                  className={INPUT}
                  {...(avisoEnVivo
                    ? { "aria-invalid": true as const, "aria-describedby": "rv-aviso" }
                    : errorDe("personas"))}
                />
                {reserva.aforoMaxPersonas ? (
                  <p className="text-meta text-ink-soft/75">
                    Este negocio admite hasta {reserva.aforoMaxPersonas} personas
                    por reserva.
                  </p>
                ) : null}
                {/* Lo que queda del día elegido. Calla cuando no queda nada: eso
                    ya lo dice el aviso de abajo, y repetirlo dos veces seguidas
                    se lee como dos problemas. */}
                {restantes !== null && restantes > 0 && (
                  <p className="text-meta text-ink-soft/75">
                    Quedan {restantes} {restantes === 1 ? "plaza" : "plazas"}{" "}
                    para ese día.
                  </p>
                )}
              </div>
            )}

            {tipo === "apartado" && (
              <div className="grid grid-cols-[1fr_88px] gap-gap-sm">
                <div className="flex flex-col gap-gap-xs">
                  <label htmlFor="rvProducto" className={LABEL}>
                    Qué quieres apartar
                  </label>
                  {/* `appearance-none` quita la flecha del sistema: sin la
                      nuestra, el campo parecía de texto. */}
                  <div className="relative">
                    <select
                      id="rvProducto"
                      value={productoId}
                      onChange={(e) => {
                        setProductoId(e.target.value);
                        limpiar("producto");
                      }}
                      className={cn(INPUT, "appearance-none pr-10")}
                      {...errorDe("producto")}
                    >
                      {reserva.productos.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={16}
                      strokeWidth={1.8}
                      aria-hidden
                      className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-ink-soft"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-gap-xs">
                  <label htmlFor="rvCantidad" className={LABEL}>
                    Cantidad
                  </label>
                  <input
                    id="rvCantidad"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={cantidad}
                    onChange={(e) => {
                      setCantidad(e.target.value);
                      limpiar("cantidad");
                    }}
                    className={INPUT}
                    {...errorDe("cantidad")}
                  />
                </div>
              </div>
            )}

            <div className="flex flex-col gap-gap-xs">
              <label htmlFor="rvNota" className={LABEL}>
                Nota (opcional)
              </label>
              <textarea
                id="rvNota"
                rows={2}
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                placeholder="Ej: vamos con un niño, sin cebolla…"
                className={cn(INPUT, "h-auto min-h-[64px] resize-y py-3")}
              />
            </div>

            <div className="rounded-2xl border border-ink/5 bg-sand-warm px-4 py-3">
              <div className="font-lv-display text-meta font-semibold text-ink-soft/75">
                Se enviará este mensaje
              </div>
              <p className="mt-1 whitespace-pre-wrap text-small leading-relaxed text-ink-soft">
                {vistaPrevia}
              </p>
            </div>

            {/* El aviso del cupo, pegado a lo que se escribe: aparece al elegir
                el día y al cambiar las personas, sin esperar al envío. */}
            {/* `polite` y no `alert`: cambia con cada tecla en «Personas» y
                una alerta interrumpiría al lector en cada número. El contenedor
                está siempre montado para que el anuncio llegue. */}
            {/* Vacío, el margen negativo anula el hueco del `gap` del form. */}
            <div aria-live="polite" className="empty:-mt-gap-sm">
              {avisoEnVivo && (
                <p
                  id="rv-aviso"
                  className="rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-[7px] text-meta font-medium text-destructive"
                >
                  {avisoEnVivo}
                </p>
              )}
            </div>

            {error && (
              <p
                id="rv-error"
                role="alert"
                className="rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-[7px] text-meta font-medium text-destructive"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={enviando || Boolean(avisoEnVivo)}
              className={cn(
                BTN_PRIMARY,
                "w-full disabled:pointer-events-none disabled:opacity-60",
              )}
            >
              <MessageCircle size={16} strokeWidth={1.8} />
              {enviando ? "Comprobando el cupo…" : "Enviar por WhatsApp"}
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
