"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
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
  PLAN_ORDER,
  nombreDe,
  textoCup,
  type Catalogo,
  type ClaveModulo,
  type Funcion,
  type FuncionCatalogo,
  type ModuloCatalogo,
  type Pack,
  type PackCatalogo,
  type Plan,
} from "@/lib/plans";
import { useCatalogo } from "@/providers/catalogo-provider";

/**
 * El catálogo de planes, editable.
 *
 * Cambiar un precio o un texto era editar TypeScript y desplegar. Ahora se hace
 * aquí: el catálogo llega ya resuelto del layout de `/admin` —que es un
 * componente de servidor y ya lee la base— y esto solo edita una copia en memoria.
 *
 * **No se crea ni se borra nada.** Las claves —qué funciones, qué módulos, qué
 * packs existen— son el vocabulario del código: `qr_sin_marca` existe porque hay
 * código detrás que la mira. Aquí se cambian sus valores, no la lista. Por eso
 * no hay botón de «nuevo módulo»: no puede existir lo que no está en el código.
 *
 * Las `funciones` de un pack son **su propia lista**, independiente de los
 * módulos: se marcan una a una y cambiar un módulo no cambia ningún pack. Solo
 * se marcan las que el pack **añade sobre Gratis**; las de Gratis no se repiten.
 *
 * Los precios se escriben en dólares y el CUP se calcula con la tasa **viva**
 * de QvaPay (CambioCUP); el campo de tasa de arriba es solo el respaldo que
 * entra si esa fuente no responde. Debajo de cada campo se enseña lo que
 * saldrá en pesos, para no tener que imaginar la multiplicación.
 */

const INPUT =
  "h-11 w-full rounded-xl border border-ink/10 bg-white px-4 text-body text-ink placeholder:text-ink-soft/75 outline-none transition-colors duration-500 ease-outquint focus:border-verde-400 focus:ring-2 focus:ring-verde-400/20 aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-destructive/20";
const AREA =
  "w-full rounded-xl border border-ink/10 bg-white px-4 py-3 text-small text-ink placeholder:text-ink-soft/75 outline-none transition-colors duration-500 ease-outquint focus:border-verde-400 focus:ring-2 focus:ring-verde-400/20";
const LABEL = "font-lv-display text-meta font-semibold text-ink-soft/75";

interface ResumenCatalogo {
  negociosPorPlan: Record<Plan, number>;
  ingresosModulo: Record<ClaveModulo, { negocios: number; usdMes: number }>;
  totalModulosUsd: number;
}

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
          className="flex min-h-11 cursor-pointer items-start gap-gap-xs text-small text-ink"
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
  const [resumen, setResumen] = useState<ResumenCatalogo | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  /* La versión del catálogo guardado (`undefined` = aún no se sabe). Se manda
     al guardar: si otro administrador guardó entretanto, el servidor contesta
     409 en vez de pisarlo. Sin versión no se deja guardar. */
  const [version, setVersion] = useState<string | null | undefined>(undefined);
  const [falloVersion, setFalloVersion] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/admin/planes")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then(
        (d: {
          catalogo: Catalogo;
          version: string | null;
          resumen?: ResumenCatalogo;
        }) => {
        if (!alive) return;
        setVersion(d.version);
        setResumen(d.resumen ?? null);
        /* Si aún no se tocó nada, el borrador pasa a esta lectura: así versión
           y datos son de la misma foto, aunque el catálogo de la página llegara
           de una caché anterior. */
        setBorrador((prev) => (prev === cat ? d.catalogo : prev));
      })
      .catch(() => {
        if (alive) setFalloVersion(true);
      });
    return () => {
      alive = false;
    };
  }, [cat]);

  /* Los números se editan en texto aparte. Con un `value` numérico, vaciar el
     campo para reescribirlo lo convierte en un `0` que ya no se puede borrar.
     El texto vive aquí; el número, en el borrador. */
  const [numeros, setNumeros] = useState<Record<string, string>>({});

  const numero = (id: string, valor: number) => numeros[id] ?? String(valor);
  /* Un texto que no es un número válido **no** se aplica: antes caía a 0 y se
     guardaba, así que una errata dejaba un pack a 0 USD. Se queda el texto,
     el campo se marca y guardar se bloquea hasta corregirlo. La tasa además
     tiene que ser mayor que 0: con 0 todos los precios en CUP serían 0. */
  const valido = (id: string, texto: string) => {
    if (texto.trim() === "") return false;
    const n = Number(texto.replace(",", "."));
    return Number.isFinite(n) && (id === "tasa" ? n > 0 : n >= 0);
  };
  const malo = (id: string) => numeros[id] !== undefined && !valido(id, numeros[id]);
  /* El porqué del rojo, enlazado al campo con `aria-describedby`: sin él un
     lector de pantalla anuncia «no válido» sin decir qué escribir. */
  const errorId = (id: string) => (malo(id) ? `${id}-error` : undefined);
  const errorDe = (id: string) =>
    malo(id) ? (
      <p id={`${id}-error`} className="text-meta font-semibold text-destructive-ink">
        {id === "tasa" ? "Escribe un número mayor que 0." : "Escribe un número, 0 o más."}
      </p>
    ) : null;
  const escribir = (id: string, texto: string, aplicar: (n: number) => void) => {
    setNumeros((prev) => ({ ...prev, [id]: texto }));
    if (valido(id, texto)) aplicar(Number(texto.replace(",", ".")));
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

  async function guardar(confirmado = false) {
    if (saving || version === undefined) return;
    const conError = Object.keys(numeros).filter(malo).length;
    if (conError > 0) {
      toast.error(
        conError === 1
          ? "Hay un precio no válido (marcado en rojo). No se guardó nada."
          : `Hay ${conError} precios no válidos (marcados en rojo). No se guardó nada.`,
      );
      return;
    }
    /* El catálogo es de todos los negocios: antes de escribirlo se enseña a
       quién alcanza, y no se guarda hasta que se confirme. */
    if (!confirmado) {
      setConfirmando(true);
      return;
    }
    setConfirmando(false);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/planes", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(version ? { "x-version": version } : {}),
        },
        body: JSON.stringify(borrador),
      });
      const data = (await res.json().catch(() => null)) as
        | { catalogo?: Catalogo; version?: string; error?: string }
        | null;

      if (!res.ok || !data?.catalogo) {
        toast.error(data?.error ?? "No se pudo guardar el catálogo.");
        return;
      }

      /* Lo que devuelve el servidor es el catálogo ya **normalizado**: si algo
         no validó, aquí se ve lo que de verdad quedó guardado, no lo que se
         escribió. Se re-siembra con eso y se limpian los textos de los números. */
      setBorrador(data.catalogo);
      setVersion(data.version ?? null);
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

      {resumen && (
        <section className="mb-gap-md rounded-2xl border border-ink/5 bg-white p-gap-md">
          <div className="flex flex-wrap items-end justify-between gap-gap-sm">
            <div>
              <h2 className="font-lv-display text-body font-bold text-ink">
                Impacto del catálogo hoy
              </h2>
              <p className="text-meta text-ink-soft/75">
                Negocios y módulos vivos con el catálogo guardado. Los cambios
                se aplican a las próximas renovaciones, no a los cobros ya hechos.
              </p>
            </div>
            <p className="text-meta font-semibold text-ink-soft/75">
              {resumen.totalModulosUsd.toLocaleString("es-CU", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              USD/mes en módulos sueltos
            </p>
          </div>

          <div className="mt-gap-md grid grid-cols-1 gap-gap-md lg:grid-cols-2">
            <div>
              <h3 className="font-lv-display text-small font-semibold text-ink">
                Negocios por plan efectivo
              </h3>
              <ul className="mt-gap-xs divide-y divide-ink/5">
                {PLAN_ORDER.map((plan) => (
                  <li
                    key={plan}
                    className="flex items-center justify-between gap-gap-sm py-gap-xs text-small text-ink"
                  >
                    <span>{nombreDe(plan, borrador)}</span>
                    <b className="tabular-nums">{resumen.negociosPorPlan[plan]}</b>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="font-lv-display text-small font-semibold text-ink">
                Ingreso por módulo
              </h3>
              <ul className="mt-gap-xs divide-y divide-ink/5">
                {(Object.keys(borrador.modulos) as ClaveModulo[]).map((clave) => {
                  const fila = resumen.ingresosModulo[clave];
                  return (
                    <li
                      key={clave}
                      className="flex items-center justify-between gap-gap-sm py-gap-xs text-small text-ink"
                    >
                      <span>
                        {borrador.modulos[clave].nombre}{" "}
                        <span className="text-meta text-ink-soft/60">
                          · {fila.negocios} negocio{fila.negocios === 1 ? "" : "s"}
                        </span>
                      </span>
                      <b className="tabular-nums">
                        {fila.usdMes.toLocaleString("es-CU", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{" "}
                        USD
                      </b>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </section>
      )}

      <FormSections>
        <FormSection title="Tasa del CUP" icon={<Coins size={18} strokeWidth={1.8} />}>
          <p className="text-meta text-ink-soft/75">
            Pesos cubanos por dólar de <strong className="font-semibold text-ink">respaldo</strong>.
            Los precios se convierten con la tasa viva de QvaPay (CambioCUP); este
            valor solo entra si esa fuente no responde. El CUP se redondea a la
            decena.
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
              aria-invalid={malo("tasa")}
              aria-describedby={errorId("tasa")}
              onChange={(e) =>
                escribir("tasa", e.target.value, (n) =>
                  setBorrador((d) => ({ ...d, tasaCup: n })),
                )
              }
              className={cn(INPUT, "cursor-text sm:max-w-[200px]")}
            />
            {errorDe("tasa")}
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
          title="Servicios por separado"
          icon={<Blocks size={18} strokeWidth={1.8} />}
        >
          <p className="text-meta text-ink-soft/75">
            Se contratan uno a uno, al mes.
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
                      Lo que incluye{" "}
                      <span className="font-normal">(una línea por punto)</span>
                    </label>
                    <textarea
                      id={`mTexto-${clave}`}
                      rows={6}
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
                      aria-invalid={malo(`m-${clave}`)}
                      aria-describedby={errorId(`m-${clave}`)}
                      onChange={(e) =>
                        escribir(`m-${clave}`, e.target.value, (n) =>
                          setModulo(clave, { usd: n }),
                        )
                      }
                      className={cn(INPUT, "cursor-text sm:max-w-[200px]")}
                    />
                    {errorDe(`m-${clave}`)}
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
            Las funciones de siempre, juntas y con descuento. Se marcan una a
            una: el pack no depende de los módulos sueltos.
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
                      Lo que incluye{" "}
                      <span className="font-normal">(una línea por punto)</span>
                    </label>
                    <textarea
                      id={`pTexto-${clave}`}
                      rows={6}
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
                      aria-invalid={malo(`p-${clave}`)}
                      aria-describedby={errorId(`p-${clave}`)}
                      onChange={(e) =>
                        escribir(`p-${clave}`, e.target.value, (n) =>
                          setPack(clave, { usd: n }),
                        )
                      }
                      className={cn(INPUT, "cursor-text sm:max-w-[200px]")}
                    />
                    {errorDe(`p-${clave}`)}
                    <p className="text-meta text-ink-soft/75">
                      {textoCup(p.usd, borrador)} al mes
                    </p>
                  </div>
                  <fieldset className="flex flex-col gap-gap-xs">
                    <legend className={LABEL}>
                      Funciones{" "}
                      <span className="font-normal">
                        (las que añade sobre Gratis)
                      </span>
                    </legend>
                    {casillas(p.funciones, (siguiente) =>
                      setPack(clave, { funciones: siguiente }),
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
        <FormSection title="Negocios nuevos" icon={<ListChecks size={18} strokeWidth={1.8} />}>
          <p className="text-meta text-ink-soft/75">
            Si está activo, cada negocio que se da de alta entra con 30 días de Pro de prueba.
            Desactívalo para que los nuevos entren directamente en Gratis.
          </p>
          <label className="flex cursor-pointer items-center gap-gap-sm text-small text-ink">
            <input
              type="checkbox"
              checked={borrador.trialNegociosNuevos ?? true}
              onChange={(e) =>
                setBorrador((d) => ({ ...d, trialNegociosNuevos: e.target.checked }))
              }
              className="size-4 accent-verde-500"
            />
            Prueba gratuita de 30 días de Pro para negocios nuevos
          </label>
        </FormSection>
      </FormSections>

      {confirmando && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-gap-md"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !saving) setConfirmando(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirmar-catalogo"
            className="w-full max-w-lg rounded-2xl border border-ink/10 bg-white p-gap-lg shadow-xl"
          >
            <div className="flex items-start gap-gap-sm">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-amber-50 text-amber-700">
                <AlertTriangle size={20} strokeWidth={1.8} />
              </span>
              <div>
                <h2
                  id="confirmar-catalogo"
                  className="font-lv-display text-body font-bold text-ink"
                >
                  ¿Guardar estos precios para todos?
                </h2>
                <p className="mt-gap-xs text-small text-ink-soft/75">
                  El catálogo es único para todo el sitio. Se aplicará a los
                  negocios nuevos y a las renovaciones; los cobros ya registrados
                  no se modifican.
                </p>
                {resumen && (
                  <p className="mt-gap-sm rounded-xl bg-sand/60 px-gap-sm py-gap-xs text-meta text-ink-soft/75">
                    Hoy hay {resumen.negociosPorPlan.pro} en Pro,{" "}
                    {resumen.negociosPorPlan.publicidad_max} en Publicidad Max y{" "}
                    {resumen.negociosPorPlan.esencial} en Esencial. Los módulos
                    sueltos suman {resumen.totalModulosUsd.toFixed(2)} USD/mes.
                  </p>
                )}
              </div>
            </div>
            <div className="mt-gap-lg flex flex-wrap justify-end gap-gap-sm">
              <button
                type="button"
                onClick={() => setConfirmando(false)}
                disabled={saving}
                className="inline-flex h-11 cursor-pointer items-center rounded-full border border-ink/10 px-gap-md font-lv-display text-small font-semibold text-ink-soft/75 hover:bg-sand disabled:opacity-60"
              >
                Seguir editando
              </button>
              <button
                type="button"
                onClick={() => void guardar(true)}
                disabled={saving}
                className="inline-flex h-11 cursor-pointer items-center gap-gap-xs rounded-full bg-verde-400 px-gap-lg font-lv-display text-small font-semibold text-verde-950 hover:bg-verde-300 disabled:opacity-60"
              >
                {saving && <Loader2 size={16} className="animate-spin" />}
                {saving ? "Guardando…" : "Confirmar y guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-gap-lg flex flex-wrap items-center justify-end gap-gap-sm">
        {falloVersion && (
          <p role="alert" className="text-meta font-semibold text-destructive-ink">
            No se pudo leer la versión del catálogo. Recarga la página antes de guardar.
          </p>
        )}
        <button
          type="button"
          onClick={() => void guardar()}
          disabled={saving || version === undefined}
          className="inline-flex h-11 cursor-pointer items-center gap-gap-xs rounded-full bg-verde-400 px-gap-lg font-lv-display text-small font-semibold text-verde-950 shadow-primary-halo transition duration-500 ease-outquint hover:bg-verde-300 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60"
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
