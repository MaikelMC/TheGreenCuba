"use client";

import { useState } from "react";
import { Plus, Tag, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { inicioValido, precioConOferta, validarOferta } from "@/lib/ofertas";
import type { UserPlaceMenuItem, UserPlaceOferta } from "@/lib/places-store";

const INPUT =
  "rounded-xl border-ink/10 bg-white text-ink placeholder:text-ink-soft/75 focus-visible:border-verde-400 focus-visible:ring-offset-0 focus-visible:ring-verde-400/30";

const DIA_MS = 86_400_000;

/**
 * Editor de ofertas flash.
 *
 * Guarda contra la lista que recibe: no escribe nada por su cuenta, cambia el
 * array y quien lo usa lo manda en el mismo `PATCH` del panel. Así el guardado
 * sigue siendo uno solo —el mismo botón que guarda el horario— y no hay un
 * segundo camino de escritura que pueda quedar desincronizado.
 *
 * Los campos del formulario son **cadenas**, como los de cualquier formulario
 * del proyecto: el `<input type="datetime-local">` da y espera texto, y
 * convertir a número en cada tecla rompería lo que el dueño está escribiendo a
 * medio. La conversión la hace `validarOferta`, que es la misma que corre en el
 * servidor —si aquí pasara, allí también pasa—.
 */
export function OfertasEditor({
  ofertas,
  onChange,
  menu,
  max,
}: {
  ofertas: UserPlaceOferta[];
  onChange: (ofertas: UserPlaceOferta[]) => void;
  /** La carta, para elegir el producto y para enseñar el precio que se tacha. */
  menu: UserPlaceMenuItem[];
  /** `ofertas_vigentes_max` del plan. `null` = sin tope. */
  max: number | null;
}) {
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ahora = Date.now();
  /* El mismo recuento que hace la ruta: las que no han caducado, incluidas las
     programadas —una oferta de mañana ocupa el sitio de una de hoy—. */
  const enPie = ofertas.filter((o) => o.termina > ahora).length;
  const lleno = max !== null && enPie >= max;

  const objetivos = menu.filter((item) => item.id);

  function abrir(oferta?: UserPlaceOferta) {
    setError(null);
    setBorrador(
      oferta
        ? {
            id: oferta.id,
            productoId: oferta.productoId,
            titulo: oferta.titulo,
            descripcion: oferta.descripcion ?? "",
            modo: oferta.descuentoPct != null ? "pct" : "precio",
            valor: String(oferta.descuentoPct ?? oferta.precioOferta ?? ""),
            inicia: paraInput(oferta.inicia),
            iniciaOriginal: paraInput(oferta.inicia),
            termina: paraInput(oferta.termina),
          }
        : {
            /* `crypto.randomUUID()` y no el `generateId()` del proyecto: aquel
               resuelve `nanoid` con un `require` pensado para el servidor y en
               el navegador no existe. Este es nativo y hace lo mismo —un texto
               único—, que es todo lo que el `id` tiene que ser. */
            id: crypto.randomUUID(),
            productoId: objetivos[0]?.id ?? "",
            titulo: "",
            descripcion: "",
            modo: "pct",
            valor: "",
            inicia: paraInput(ahora),
            /* Vacío: una oferta nueva no tiene hora previa que respetar, así que
               cualquier inicio en el pasado se rechaza. Ver `guardar`. */
            iniciaOriginal: "",
            termina: paraInput(ahora + DIA_MS),
          },
    );
  }

  function guardar() {
    if (!borrador) return;

    /* El inicio en el pasado lo rechaza `inicioValido`, que explica por qué la
       regla no vive en `validarOferta`. */
    if (!inicioValido(borrador.inicia, borrador.iniciaOriginal)) {
      setError("La oferta no puede empezar antes de ahora.");
      return;
    }

    /* Las fechas vacías pasan como `NaN`, que `validarOferta` rechaza con su
       propia frase: no hace falta una comprobación previa por cada campo. El
       final anterior al inicio también sale de ahí. */
    const limpia = validarOferta({
      id: borrador.id,
      productoId: borrador.productoId,
      titulo: borrador.titulo,
      descripcion: borrador.descripcion,
      precioOferta: borrador.modo === "precio" ? borrador.valor : undefined,
      descuentoPct: borrador.modo === "pct" ? Number(borrador.valor) : undefined,
      inicia: borrador.inicia ? new Date(borrador.inicia).getTime() : NaN,
      termina: borrador.termina ? new Date(borrador.termina).getTime() : NaN,
    });
    if (typeof limpia === "string") {
      setError(limpia);
      return;
    }

    const existe = ofertas.some((o) => o.id === limpia.id);
    onChange(
      existe
        ? ofertas.map((o) => (o.id === limpia.id ? limpia : o))
        : [...ofertas, limpia],
    );
    setBorrador(null);
    setError(null);
  }

  if (objetivos.length === 0) {
    return (
      <p className="text-meta text-ink-soft/75">
        Primero publica tu carta en «Lo que ofreces»: una oferta flash rebaja el
        precio de un producto, y ahora mismo no hay ninguno al que apuntar.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-gap-sm">
      <p className="text-meta text-ink-soft/75">
        Rebaja un producto de tu carta por tiempo limitado. Sale en tu ficha con
        el precio tachado, y mientras está viva tu negocio lleva la chapita
        «Oferta» en la tarjeta y en el pin del mapa.
        {max !== null && ` Tu plan permite ${max} a la vez.`}
      </p>

      {ofertas.length > 0 && (
        <ul className="flex flex-col gap-gap-xs">
          {[...ofertas]
            .sort((a, b) => b.termina - a.termina)
            .map((oferta) => (
              <Fila
                key={oferta.id}
                oferta={oferta}
                menu={menu}
                ahora={ahora}
                onEditar={() => abrir(oferta)}
                onQuitar={() => {
                  onChange(ofertas.filter((o) => o.id !== oferta.id));
                  /* Si se borra la que se estaba editando, el formulario se
                     cierra: dejarlo abierto guardaría una oferta que ya no
                     está y la resucitaría. */
                  if (borrador?.id === oferta.id) setBorrador(null);
                }}
              />
            ))}
        </ul>
      )}

      {borrador ? (
        <Formulario
          borrador={borrador}
          setBorrador={setBorrador}
          objetivos={objetivos}
          error={error}
          ahora={ahora}
          onGuardar={guardar}
          onCancelar={() => {
            setBorrador(null);
            setError(null);
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => abrir()}
          disabled={lleno}
          className="inline-flex cursor-pointer items-center gap-gap-xs self-start rounded-full border border-ink/10 bg-white px-gap-md py-2 font-lv-display text-meta font-semibold text-ink-soft/75 transition-colors duration-500 ease-outquint hover:border-verde-300 hover:text-verde-600 disabled:pointer-events-none disabled:opacity-50"
        >
          <Plus size={16} strokeWidth={1.8} />
          {lleno ? "Tope alcanzado" : "Nueva oferta"}
        </button>
      )}
    </div>
  );
}

/** Los campos del formulario, todos como texto. Ver el comentario de arriba. */
interface Borrador {
  id: string;
  productoId: string;
  titulo: string;
  descripcion: string;
  modo: "pct" | "precio";
  valor: string;
  inicia: string;
  /** El `inicia` con el que se abrió el formulario. Ver el comentario de `guardar`. */
  iniciaOriginal: string;
  termina: string;
}

function Fila({
  oferta,
  menu,
  ahora,
  onEditar,
  onQuitar,
}: {
  oferta: UserPlaceOferta;
  menu: UserPlaceMenuItem[];
  ahora: number;
  onEditar: () => void;
  onQuitar: () => void;
}) {
  const producto = menu.find((item) => item.id === oferta.productoId);
  /* `precioConOferta` y no un texto armado aquí: es la misma función que pinta
     la carta, así que el dueño ve en el panel exactamente lo que verá quien
     abra el menú —incluido el caso en que no hay nada que tachar—. */
  const precios = producto
    ? precioConOferta(producto.price, oferta)
    : null;

  const estado =
    oferta.termina <= ahora
      ? { texto: "Terminada", clase: "text-ink-soft/60" }
      : oferta.inicia > ahora
        ? { texto: "Programada", clase: "text-amber-700" }
        : { texto: "En curso", clase: "text-verde-600" };

  return (
    <li className="flex items-start gap-gap-sm rounded-xl border border-ink/5 bg-sand/40 p-gap-sm">
      <Tag size={16} strokeWidth={1.8} className="mt-1 shrink-0 text-verde-600" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-small font-medium text-ink">{oferta.titulo}</p>
        <p className="truncate text-meta text-ink-soft/75">
          {producto?.name ?? "Producto ya no está en la carta"}
          {precios && (
            <>
              {" · "}
              <span className="line-through">{precios.de}</span>
              {" "}
              <span className="font-semibold text-verde-600">{precios.por}</span>
            </>
          )}
        </p>
        <p className="text-meta text-ink-soft/60">
          <span className={cn("font-semibold", estado.clase)}>{estado.texto}</span>
          {" · "}
          {fecha(oferta.inicia)} → {fecha(oferta.termina)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-gap-xs">
        <button
          type="button"
          onClick={onEditar}
          className="cursor-pointer font-lv-display text-meta font-semibold text-verde-600 transition-colors duration-500 ease-outquint hover:text-verde-700"
        >
          Editar
        </button>
        <button
          type="button"
          onClick={onQuitar}
          aria-label={`Quitar la oferta ${oferta.titulo}`}
          className="cursor-pointer text-ink-soft/60 transition-colors duration-500 ease-outquint hover:text-destructive"
        >
          <Trash2 size={16} strokeWidth={1.8} />
        </button>
      </div>
    </li>
  );
}

function Formulario({
  borrador,
  setBorrador,
  objetivos,
  error,
  ahora,
  onGuardar,
  onCancelar,
}: {
  borrador: Borrador;
  setBorrador: (b: Borrador) => void;
  objetivos: UserPlaceMenuItem[];
  error: string | null;
  /** Para el `min` de las dos fechas. Ver `guardar`, que es quien de verdad
      comprueba: el atributo solo desactiva lo imposible en el calendario. */
  ahora: number;
  onGuardar: () => void;
  onCancelar: () => void;
}) {
  const campo = <K extends keyof Borrador>(clave: K, valor: Borrador[K]) =>
    setBorrador({ ...borrador, [clave]: valor });

  return (
    <div className="flex flex-col gap-gap-xs rounded-xl border border-verde-300/60 bg-verde-50/40 p-gap-sm">
      <div className="grid grid-cols-1 gap-gap-sm lg:grid-cols-2">
        <div className="flex flex-col gap-gap-xs">
          <Label htmlFor="ofProducto">Producto de la carta</Label>
          <Select
            value={borrador.productoId}
            onValueChange={(v) => campo("productoId", v)}
          >
            <SelectTrigger id="ofProducto">
              <SelectValue placeholder="Elige uno" />
            </SelectTrigger>
            <SelectContent>
              {objetivos.map((item) => (
                <SelectItem key={item.id} value={item.id as string}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-gap-xs">
          <Label htmlFor="ofTitulo">Título</Label>
          <Input
            id="ofTitulo"
            className={INPUT}
            value={borrador.titulo}
            onChange={(e) => campo("titulo", e.target.value)}
            placeholder="Ej: 20% en el café de la casa"
          />
        </div>
      </div>

      <div className="flex flex-col gap-gap-xs">
        <Label htmlFor="ofDesc">Descripción (opcional)</Label>
        <Input
          id="ofDesc"
          className={INPUT}
          value={borrador.descripcion}
          onChange={(e) => campo("descripcion", e.target.value)}
          placeholder="Ej: solo por la mañana, hasta agotar el tostado del día"
        />
      </div>

      <div className="grid grid-cols-1 gap-gap-sm lg:grid-cols-3">
        <div className="flex flex-col gap-gap-xs">
          <Label htmlFor="ofModo">Rebaja</Label>
          <Select
            value={borrador.modo}
            onValueChange={(v) => campo("modo", v as Borrador["modo"])}
          >
            <SelectTrigger id="ofModo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pct">Descuento en %</SelectItem>
              <SelectItem value="precio">Precio rebajado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-gap-xs">
          <Label htmlFor="ofValor">
            {borrador.modo === "pct" ? "Por ciento" : "Precio nuevo"}
          </Label>
          <Input
            id="ofValor"
            className={INPUT}
            inputMode="decimal"
            value={borrador.valor}
            onChange={(e) => campo("valor", e.target.value)}
            placeholder={borrador.modo === "pct" ? "20" : "120"}
          />
        </div>
        <div className="flex flex-col gap-gap-xs">
          <Label htmlFor="ofInicia">Empieza</Label>
          <Input
            id="ofInicia"
            type="datetime-local"
            className={INPUT}
            /* `min` deja el calendario sin los días ya pasados. La comprobación
               de verdad está en `guardar`: escribir la fecha a mano se salta
               esto en más de un navegador. */
            min={paraInput(ahora)}
            value={borrador.inicia}
            onChange={(e) => campo("inicia", e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-gap-xs">
        <Label htmlFor="ofTermina">Termina</Label>
        <Input
          id="ofTermina"
          type="datetime-local"
          className={INPUT}
          min={borrador.inicia || paraInput(ahora)}
          value={borrador.termina}
          onChange={(e) => campo("termina", e.target.value)}
        />
      </div>

      {error && (
        <p role="alert" className="text-meta font-medium text-destructive">
          {error}
        </p>
      )}

      <div className="flex items-center gap-gap-sm">
        <button
          type="button"
          onClick={onGuardar}
          className="cursor-pointer rounded-full bg-verde-400 px-gap-md py-2 font-lv-display text-meta font-semibold text-verde-950 transition-colors duration-500 ease-outquint hover:bg-verde-300"
        >
          Añadir a la lista
        </button>
        <button
          type="button"
          onClick={onCancelar}
          className="inline-flex cursor-pointer items-center gap-[6px] font-lv-display text-meta font-semibold text-ink-soft/75 transition-colors duration-500 ease-outquint hover:text-ink"
        >
          <X size={16} strokeWidth={1.8} />
          Cancelar
        </button>
      </div>
    </div>
  );
}

/* El `<input type="datetime-local">` habla en hora local y sin zona:
   `"2026-10-08T19:30"`. De ahí a epoch y de vuelta hay que pasar a mano, porque
   `toISOString()` da UTC y desplazaría la hora que el dueño escribió. */
function paraInput(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function fecha(ms: number): string {
  return new Date(ms).toLocaleString("es-CU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
