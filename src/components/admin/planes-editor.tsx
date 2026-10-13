"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Blocks,
  Coins,
  Gift,
  ListChecks,
  Loader2,
  Package,
  Save,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FormSection, FormSections } from "@/components/business/form-section";
import {
  PACKS_ORDER,
  textoCup,
  type Catalogo,
  type ClaveModulo,
  type Funcion,
  type FuncionCatalogo,
  type ModuloCatalogo,
  type Pack,
  type PackCatalogo,
} from "@/lib/plans";
import { useCatalogo } from "@/providers/catalogo-provider";

/**
 * El catálogo de planes, editable.
 *
 * Cambiar un precio o un texto era editar TypeScript y desplegar. Ahora se hace
 * aquí: el catálogo llega ya resuelto del layout de `/admin` —que es un
 * componente de servidor y ya lee Neon— y esto solo edita una copia en memoria.
 *
 * **No se crea ni se borra nada.** Las claves —qué funciones, qué módulos, qué
 * packs existen— son el vocabulario del código: `qr_sin_marca` existe porque hay
 * código detrás que la mira. Aquí se cambian sus valores, no la lista. Por eso
 * no hay botón de «nuevo módulo»: no puede existir lo que no está en el código.
 *
 * Los `funciones` de un pack **no se editan**: se calculan de sus módulos y sus
 * bonos, y el servidor los recalcula al guardar (`normalizarCatalogo`). Lo que
 * se marca son los módulos que incluye y los bonos que van sueltos con él.
 *
 * Los precios se escriben en dólares y el CUP se calcula con la tasa de arriba;
 * debajo de cada campo se enseña lo que saldrá en pesos, para no tener que
 * imaginar la multiplicación.
 */

const INPUT =
  "h-11 w-full rounded-xl border border-ink/10 bg-white px-4 text-body text-ink placeholder:text-ink-soft/75 outline-none transition-colors duration-500 ease-outquint focus:border-verde-400 focus:ring-2 focus:ring-verde-400/20";
const AREA =
  "w-full rounded-xl border border-ink/10 bg-white px-4 py-3 text-small text-ink placeholder:text-ink-soft/75 outline-none transition-colors duration-500 ease-outquint focus:border-verde-400 focus:ring-2 focus:ring-verde-400/20";
const LABEL = "font-lv-display text-meta font-semibold text-ink-soft/75";

/** Añade o quita un valor de una lista, sin mutarla. */
function alternar<T>(lista: readonly T[], valor: T, dentro: boolean): T[] {
  if (dentro) return lista.includes(valor) ? [...lista] : [...lista, valor];
  return lista.filter((x) => x !== valor);
}

/* Fuera del componente y no dentro: definida en el render, cada pulsación la
   recreaba, cambiaba su tipo y React remontaba el subárbol entero —las casillas
   perdían el foco—. */
function Casillas({
  claves,
  textos,
  lista,
  onCambio,
}: {
  claves: readonly Funcion[];
  textos: Record<Funcion, FuncionCatalogo>;
  lista: readonly Funcion[];
  onCambio: (siguiente: Funcion[]) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-gap-xs sm:grid-cols-2">
      {claves.map((clave) => (
        <label
          key={clave}
          className="flex cursor-pointer items-start gap-gap-xs text-small text-ink"
        >
          <input
            type="checkbox"
            checked={lista.includes(clave)}
            onChange={(e) => onCambio(alternar(lista, clave, e.target.checked))}
            className="mt-[3px] size-4 shrink-0 accent-verde-500"
          />
          <span className="text-pretty">{textos[clave].texto}</span>
        </label>
      ))}
    </div>
  );
}

export function PlanesEditor() {
  const cat = useCatalogo();
  const router = useRouter();

  /* La copia que se edita. Se siembra del catálogo vigente y no se vuelve a
     sincronizar: a partir de aquí manda lo que escriba el administrador, y
     re-sincronizar con cada `refresh` borraría lo escrito. */
  const [borrador, setBorrador] = useState<Catalogo>(cat);
  const [saving, setSaving] = useState(false);

  /* Los números se editan en texto aparte. Con un `value` numérico, vaciar el
     campo para reescribirlo lo convierte en un `0` que ya no se puede borrar.
     El texto vive aquí; el número, en el borrador. */
  const [numeros, setNumeros] = useState<Record<string, string>>({});

  const numero = (id: string, valor: number) => numeros[id] ?? String(valor);
  const escribir = (id: string, texto: string, aplicar: (n: number) => void) => {
    setNumeros((prev) => ({ ...prev, [id]: texto }));
    const n = Number(texto.replace(",", "."));
    aplicar(Number.isFinite(n) && n >= 0 ? n : 0);
  };

  const setFuncion = (clave: Funcion, parche: Partial<FuncionCatalogo>) =>
    setBorrador((d) => ({
      ...d,
      funciones: { ...d.funciones, [clave]: { ...d.funciones[clave], ...parche } },
    }));

  const setModulo = (clave: ClaveModulo, parche: Partial<ModuloCatalogo>) =>
    setBorrador((d) => ({
      ...d,
      modulos: { ...d.modulos, [clave]: { ...d.modulos[clave], ...parche } },
    }));

  const setPack = (clave: Pack, parche: Partial<PackCatalogo>) =>
    setBorrador((d) => ({
      ...d,
      packs: { ...d.packs, [clave]: { ...d.packs[clave], ...parche } },
    }));

  async function guardar() {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/planes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(borrador),
      });
      const data = (await res.json().catch(() => null)) as
        | { catalogo?: Catalogo; error?: string }
        | null;

      if (!res.ok || !data?.catalogo) {
        toast.error(data?.error ?? "No se pudo guardar el catálogo.");
        return;
      }

      /* Lo que devuelve el servidor es el catálogo ya **normalizado**: si algo
         no validó, aquí se ve lo que de verdad quedó guardado, no lo que se
         escribió. Se re-siembra con eso y se limpian los textos de los números. */
      setBorrador(data.catalogo);
      setNumeros({});
      toast.success("Catálogo guardado.");
      router.refresh();
    } catch {
      toast.error("No hubo respuesta del servidor. No se cambió nada.");
    } finally {
      setSaving(false);
    }
  }

  const funciones = Object.keys(borrador.funciones) as Funcion[];
  const modulos = Object.keys(borrador.modulos) as ClaveModulo[];

  const casillas = (lista: readonly Funcion[], onCambio: (s: Funcion[]) => void) => (
    <Casillas
      claves={funciones}
      textos={borrador.funciones}
      lista={lista}
      onCambio={onCambio}
    />
  );

  return (
    <>
      <div className="mb-gap-md">
        <h1 className="sr-only">Planes y precios</h1>
        <p className="text-small text-ink-soft/75">
          Precios, nombres, lemas y qué trae cada pieza del catálogo. Los cambios
          se ven en el panel del negocio al guardar, sin desplegar.
        </p>
      </div>

      <FormSections>
        <FormSection title="Tasa del CUP" icon={<Coins size={18} strokeWidth={1.8} />}>
          <p className="text-meta text-ink-soft/75">
            Pesos cubanos por dólar. Los precios están acordados en dólares y el
            CUP se calcula de aquí, redondeado a la decena.
          </p>
          <div className="flex flex-col gap-gap-xs">
            <label htmlFor="plTasa" className={LABEL}>
              Pesos por dólar
            </label>
            <input
              id="plTasa"
              type="number"
              min={1}
              value={numero("tasa", borrador.tasaCup)}
              onChange={(e) =>
                escribir("tasa", e.target.value, (n) =>
                  setBorrador((d) => ({ ...d, tasaCup: n })),
                )
              }
              className={cn(INPUT, "cursor-text sm:max-w-[200px]")}
            />
          </div>
        </FormSection>

        <FormSection
          title="Lo que ya tienes"
          icon={<Gift size={18} strokeWidth={1.8} />}
        >
          <p className="text-meta text-ink-soft/75">
            La pieza Gratis: no es un pack, es lo que trae cualquier negocio por
            estar en La Verde.
          </p>
          <div className="grid grid-cols-1 gap-gap-md lg:grid-cols-2">
            <div className="flex flex-col gap-gap-xs">
              <label htmlFor="plGratisNombre" className={LABEL}>
                Nombre
              </label>
              <input
                id="plGratisNombre"
                value={borrador.gratisNombre}
                onChange={(e) =>
                  setBorrador((d) => ({ ...d, gratisNombre: e.target.value }))
                }
                className={cn(INPUT, "cursor-text")}
              />
            </div>
            <div className="flex flex-col gap-gap-xs">
              <label htmlFor="plGratisLema" className={LABEL}>
                Lema
              </label>
              <input
                id="plGratisLema"
                value={borrador.gratisLema}
                onChange={(e) =>
                  setBorrador((d) => ({ ...d, gratisLema: e.target.value }))
                }
                className={cn(INPUT, "cursor-text")}
              />
            </div>
          </div>
          <fieldset className="flex flex-col gap-gap-xs">
            <legend className={LABEL}>Funciones incluidas</legend>
            {casillas(borrador.gratis, (siguiente) =>
              setBorrador((d) => ({ ...d, gratis: siguiente })),
            )}
          </fieldset>
        </FormSection>

        <FormSection
          title="Módulos sueltos"
          icon={<Blocks size={18} strokeWidth={1.8} />}
        >
          <p className="text-meta text-ink-soft/75">
            Se contratan uno a uno, al mes. Ninguno depende de otro.
          </p>
          <div className="flex flex-col gap-gap-md">
            {modulos.map((clave) => {
              const m = borrador.modulos[clave];
              return (
                <div
                  key={clave}
                  className="flex flex-col gap-gap-sm rounded-2xl border border-ink/5 bg-sand/40 p-gap-md"
                >
                  <div className="grid grid-cols-1 gap-gap-md lg:grid-cols-2">
                    <div className="flex flex-col gap-gap-xs">
                      <label htmlFor={`mNombre-${clave}`} className={LABEL}>
                        Nombre
                      </label>
                      <input
                        id={`mNombre-${clave}`}
                        value={m.nombre}
                        onChange={(e) => setModulo(clave, { nombre: e.target.value })}
                        className={cn(INPUT, "cursor-text")}
                      />
                    </div>
                    <div className="flex flex-col gap-gap-xs">
                      <label htmlFor={`mLema-${clave}`} className={LABEL}>
                        Lema
                      </label>
                      <input
                        id={`mLema-${clave}`}
                        value={m.lema}
                        onChange={(e) => setModulo(clave, { lema: e.target.value })}
                        className={cn(INPUT, "cursor-text")}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-gap-xs">
                    <label htmlFor={`mTexto-${clave}`} className={LABEL}>
                      Descripción
                    </label>
                    <textarea
                      id={`mTexto-${clave}`}
                      rows={2}
                      value={m.texto}
                      onChange={(e) => setModulo(clave, { texto: e.target.value })}
                      className={cn(AREA, "cursor-text")}
                    />
                  </div>
                  <div className="flex flex-col gap-gap-xs">
                    <label htmlFor={`mUsd-${clave}`} className={LABEL}>
                      Precio (USD / mes)
                    </label>
                    <input
                      id={`mUsd-${clave}`}
                      type="number"
                      min={0}
                      step={0.5}
                      value={numero(`m-${clave}`, m.usd)}
                      onChange={(e) =>
                        escribir(`m-${clave}`, e.target.value, (n) =>
                          setModulo(clave, { usd: n }),
                        )
                      }
                      className={cn(INPUT, "cursor-text sm:max-w-[200px]")}
                    />
                    <p className="text-meta text-ink-soft/75">
                      {textoCup(m.usd, borrador)} al mes
                    </p>
                  </div>
                  <fieldset className="flex flex-col gap-gap-xs">
                    <legend className={LABEL}>Funciones</legend>
                    {casillas(m.funciones, (siguiente) =>
                      setModulo(clave, { funciones: siguiente }),
                    )}
                  </fieldset>
                </div>
              );
            })}
          </div>
        </FormSection>

        <FormSection title="Packs" icon={<Package size={18} strokeWidth={1.8} />}>
          <p className="text-meta text-ink-soft/75">
            Varios módulos juntos con descuento. Las funciones del pack salen de
            sus módulos y sus bonos; no se editan aparte.
          </p>
          <div className="flex flex-col gap-gap-md">
            {PACKS_ORDER.map((clave) => {
              const p = borrador.packs[clave];
              return (
                <div
                  key={clave}
                  className="flex flex-col gap-gap-sm rounded-2xl border border-ink/5 bg-sand/40 p-gap-md"
                >
                  <div className="grid grid-cols-1 gap-gap-md lg:grid-cols-2">
                    <div className="flex flex-col gap-gap-xs">
                      <label htmlFor={`pNombre-${clave}`} className={LABEL}>
                        Nombre
                      </label>
                      <input
                        id={`pNombre-${clave}`}
                        value={p.nombre}
                        onChange={(e) => setPack(clave, { nombre: e.target.value })}
                        className={cn(INPUT, "cursor-text")}
                      />
                    </div>
                    <div className="flex flex-col gap-gap-xs">
                      <label htmlFor={`pLema-${clave}`} className={LABEL}>
                        Lema
                      </label>
                      <input
                        id={`pLema-${clave}`}
                        value={p.lema}
                        onChange={(e) => setPack(clave, { lema: e.target.value })}
                        className={cn(INPUT, "cursor-text")}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-gap-xs">
                    <label htmlFor={`pTexto-${clave}`} className={LABEL}>
                      Descripción
                    </label>
                    <textarea
                      id={`pTexto-${clave}`}
                      rows={2}
                      value={p.texto}
                      onChange={(e) => setPack(clave, { texto: e.target.value })}
                      className={cn(AREA, "cursor-text")}
                    />
                  </div>
                  <div className="flex flex-col gap-gap-xs">
                    <label htmlFor={`pUsd-${clave}`} className={LABEL}>
                      Precio (USD / mes)
                    </label>
                    <input
                      id={`pUsd-${clave}`}
                      type="number"
                      min={0}
                      step={0.5}
                      value={numero(`p-${clave}`, p.usd)}
                      onChange={(e) =>
                        escribir(`p-${clave}`, e.target.value, (n) =>
                          setPack(clave, { usd: n }),
                        )
                      }
                      className={cn(INPUT, "cursor-text sm:max-w-[200px]")}
                    />
                    <p className="text-meta text-ink-soft/75">
                      {textoCup(p.usd, borrador)} al mes
                    </p>
                  </div>
                  <fieldset className="flex flex-col gap-gap-xs">
                    <legend className={LABEL}>Módulos que incluye</legend>
                    <div className="grid grid-cols-1 gap-gap-xs sm:grid-cols-2">
                      {modulos.map((c) => (
                        <label
                          key={c}
                          className="flex cursor-pointer items-center gap-gap-xs text-small text-ink"
                        >
                          <input
                            type="checkbox"
                            checked={p.incluye.includes(c)}
                            onChange={(e) =>
                              setPack(clave, {
                                incluye: alternar(p.incluye, c, e.target.checked),
                              })
                            }
                            className="size-4 shrink-0 accent-verde-500"
                          />
                          {borrador.modulos[c].nombre}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <fieldset className="flex flex-col gap-gap-xs">
                    <legend className={LABEL}>
                      Bonos{" "}
                      <span className="font-normal">
                        (funciones sueltas que van con el pack)
                      </span>
                    </legend>
                    {casillas(p.bonos, (siguiente) =>
                      setPack(clave, { bonos: siguiente }),
                    )}
                  </fieldset>
                </div>
              );
            })}
          </div>
        </FormSection>

        <FormSection
          title="Funciones"
          icon={<ListChecks size={18} strokeWidth={1.8} />}
        >
          <p className="text-meta text-ink-soft/75">
            El texto que lee el dueño y si ya existe. Una función marcada como
            «próximamente» se sigue vendiendo, con la etiqueta puesta, pero el
            candado no se abre hasta que exista de verdad.
          </p>
          <div className="flex flex-col gap-gap-sm">
            {funciones.map((clave) => {
              const f = borrador.funciones[clave];
              return (
                <div
                  key={clave}
                  className="grid grid-cols-1 items-center gap-gap-sm rounded-2xl border border-ink/5 bg-sand/40 p-gap-md lg:grid-cols-[1fr_auto]"
                >
                  <div className="flex flex-col gap-gap-xs">
                    <label htmlFor={`fTexto-${clave}`} className={LABEL}>
                      {clave}
                    </label>
                    <input
                      id={`fTexto-${clave}`}
                      value={f.texto}
                      onChange={(e) => setFuncion(clave, { texto: e.target.value })}
                      className={cn(INPUT, "cursor-text")}
                    />
                  </div>
                  <label className="flex cursor-pointer items-center gap-gap-xs text-small text-ink lg:pt-gap-md">
                    <input
                      type="checkbox"
                      checked={!f.disponible}
                      onChange={(e) =>
                        setFuncion(clave, { disponible: !e.target.checked })
                      }
                      className="size-4 shrink-0 accent-verde-500"
                    />
                    Próximamente
                  </label>
                </div>
              );
            })}
          </div>
        </FormSection>
      </FormSections>

      <div className="mt-gap-lg flex justify-end">
        <button
          type="button"
          onClick={() => void guardar()}
          disabled={saving}
          className="inline-flex h-11 cursor-pointer items-center gap-gap-xs rounded-full bg-verde-400 px-gap-lg font-lv-display text-small font-semibold text-verde-950 shadow-primary-halo transition-all duration-500 ease-outquint hover:bg-verde-300 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60"
        >
          {saving ? (
            <Loader2 size={16} strokeWidth={1.8} className="animate-spin" />
          ) : (
            <Save size={16} strokeWidth={1.8} />
          )}
          {saving ? "Guardando…" : "Guardar catálogo"}
        </button>
      </div>
    </>
  );
}
