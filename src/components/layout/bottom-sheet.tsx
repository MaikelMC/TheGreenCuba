"use client";

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type SheetState = "collapsed" | "peek" | "full";

/**
 * Lo que asoma en cada estado reposado.
 *
 * `collapsed` deja justo el asa (20 px: los 10 de arriba más los 6 de abajo más
 * los 4 de la barra). Recortar más abajo cortaría el titular por la mitad en
 * lugar de esconderlo, que es peor que no esconderlo.
 */
const RESTING_OFFSET: Record<SheetState, string> = {
  collapsed: "calc(100% - 20px)",
  peek: "calc(100% - 120px)",
  full: "0px",
};

interface BottomSheetProps {
  children: ReactNode;
  title: string | ReactNode;
  subtitle?: string;
  badge?: string;
  className?: string;
  defaultState?: SheetState;
  /** Cuando es true, fuerza el sheet abierto (full) para revelar su contenido. */
  forceOpen?: boolean;
  /** Cada valor nuevo recoge el sheet a `collapsed`, para dejar ver el mapa. */
  collapseSignal?: number;
  /** Cada valor nuevo abre el sheet en `full` —mismo patrón que `collapseSignal`,
      pero para abrir: con solo `forceOpen` la segunda búsqueda no disparaba el
      efecto, porque el booleano ya estaba en `true` desde la búsqueda anterior. */
  openSignal?: number;
}

export function BottomSheet({
  children,
  title,
  subtitle,
  badge,
  className,
  defaultState = "peek",
  forceOpen = false,
  collapseSignal,
  openSignal,
}: BottomSheetProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const [state, setState] = useState<SheetState>(defaultState);
  const sheetRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const startTranslate = useRef(0);
  const didDrag = useRef(false);
  const dragRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  // Posición del arrastre en estado, no solo en el ref. Mutar el ref no vuelve
  // a renderizar, y `setIsDragging(true)` repetido con el mismo valor hace que
  // React se salte el render: el arrastre se quedaba clavado en el primer
  // fotograma. El ref se conserva porque `onUp` necesita leer el valor de forma
  // síncrona, antes de que el estado se confirme.
  const [dragY, setDragY] = useState(0);

  // Abre el sheet automáticamente cuando se busca, para que siempre se vea la
  // animación y luego los resultados. Con solo `forceOpen` la apertura dependía
  // de una transición del booleano —false→true—, así que la segunda búsqueda
  // no volvía a abrir la hoja si el usuario la había recogido. `openSignal`
  // repite el patrón de `collapseSignal`: cada valor nuevo es un gesto nuevo.
  useEffect(() => {
    if (openSignal) setState("full");
  }, [openSignal]);

  // Recoge la hoja hasta dejar solo el asa, para que el mapa y el pin tocado
  // queden a la vista. Es un contador y no un booleano porque el gesto se
  // repite —con un `true` que ya estaba, el segundo pin tocado no disparaba
  // nada— y porque recogida no es un estado al que quedarse: el asa sigue ahí y
  // el usuario puede tocarla o estirarla cuando quiera.
  //
  // `forceOpen` manda: durante una búsqueda la hoja la gobierna ella, y
  // recogerla dejaría los resultados sin ver. La apertura, en cambio, la pide
  // cada búsqueda con `openSignal`.
  /* Guarda la última señal atendida: el efecto también corre cuando cambia
     `forceOpen`, y sin este recuerdo una señal vieja —un pin tocado justo
     antes de buscar— se re-aplicaba al terminar la búsqueda y recogía la hoja
     con los resultados recién llegidos. Solo importa la señal fresca. */
  const lastCollapseKey = useRef(collapseSignal ?? 0);
  useEffect(() => {
    if (collapseSignal === undefined || collapseSignal === lastCollapseKey.current) return;
    lastCollapseKey.current = collapseSignal;
    if (!forceOpen) setState("collapsed");
  }, [collapseSignal, forceOpen]);

  const translateY = isDragging
    ? `${dragY}px`
    : !mounted
      ? "100%"
      : RESTING_OFFSET[state];

  // `collapsed` no está en el ciclo: sube a `full` de una, que es lo que se pide
  // al tocar un asa que asoma 20 px. Bajar hasta `collapsed` solo lo hace el
  // gesto que lo pide, tocar un pin.
  function cycleState() {
    setState((prev) => (prev === "full" ? "peek" : "full"));
  }

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const sheet = sheetRef.current;
      if (!sheet) return;
      startY.current = e.clientY;
      didDrag.current = false;

      const style = getComputedStyle(sheet);
      const matrix = new DOMMatrixReadOnly(style.transform);
      startTranslate.current = matrix.m42;
      sheet.setPointerCapture(e.pointerId);

      const onMove = (ev: PointerEvent) => {
        const dy = ev.clientY - startY.current;
        // Solo se entra en modo arrastre cuando el dedo supera el umbral. El
        // arrastre desactiva la transición CSS, así que activarlo en el
        // pointerdown hacía que un simple toque saltara la hoja a
        // `dragRef.current` de golpe. Ese era el arranque brusco al abrir.
        if (!didDrag.current) {
          if (Math.abs(dy) <= 5) return;
          didDrag.current = true;
          setIsDragging(true);
        }
        // `translateY` se mide desde la posición abierta: 0 = abierta, positivo
        // = más abajo. El `Math.min(0, ...)` anterior recortaba a 0 todo valor
        // positivo, así que mover el dedo 6 px hacia arriba abría la hoja de
        // golpe. Un dedo real casi siempre supera el umbral de 5 px, de modo
        // que un toque normal caía justo en ese salto.
        dragRef.current = Math.max(0, startTranslate.current + dy);
        setDragY(dragRef.current);
      };

      const onUp = () => {
        sheet.removeEventListener("pointermove", onMove);
        sheet.removeEventListener("pointerup", onUp);

        if (didDrag.current) {
          // Umbral sobre la posición final, no sobre el recorrido: así da igual
          // desde qué estado arrancó el gesto. `offsetHeight - 120` es el mismo
          // `calc(100% - 120px)` del estado peek, porque el porcentaje de
          // `translateY` se resuelve contra la altura del propio elemento.
          const peekY = sheet.offsetHeight - 120;
          setIsDragging(false);
          setState(dragRef.current < peekY / 2 ? "full" : "peek");
        } else {
          // Toque sin arrastre: `isDragging` nunca se tocó, la transición CSS
          // siguió activa todo el tiempo y el cambio de estado anima igual que
          // al cerrar.
          cycleState();
        }
      };

      sheet.addEventListener("pointermove", onMove);
      sheet.addEventListener("pointerup", onUp);
    },
    [],
  );

  return (
    <div
      ref={sheetRef}
      data-state={state}
      className={cn(
        // `will-change-transform` promueve la sheet a su propia capa: el
        // deslizamiento se compone en GPU en vez de repintar en cada frame, que
        // en móvil es justo lo que se nota como tirones.
        "fixed left-0 right-0 bottom-0 z-300 bg-white rounded-t-4xl shadow-[0_-8px_40px_-12px_rgba(8,19,13,0.18)] will-change-transform transition-[transform] [transition-duration:500ms] [transition-timing-function:cubic-bezier(0.32,0.72,0,1)] max-h-[70vh] lg:max-h-none flex flex-col pb-safe-bottom",
        // Al cerrar vuelve antes que al abrir: entrar despacio da sensación de
        // continuidad, salir despacio se hace pesado. El `data-state` ya cambió
        // cuando arranca la transición, así que cada dirección usa su duración.
        "data-[state=peek]:[transition-duration:300ms] data-[state=collapsed]:[transition-duration:300ms]",
        mounted && "bottom-sheet-desktop",
        isDragging && "!transition-none",
        className,
      )}
      style={{ transform: `translateY(${translateY})` }}
    >
      {/* Handle */}
      <div
        className="flex justify-center py-[10px] pb-[6px] cursor-grab active:cursor-grabbing shrink-0"
        onPointerDown={handlePointerDown}
      >
        <div
          className={cn(
            "w-[36px] h-[4px] rounded-full transition-colors duration-500 ease-outquint",
            isDragging ? "bg-verde-400 w-[48px]" : "bg-ink/10",
          )}
        />
      </div>

      {/* Header */}
      <div className="px-5 pb-gap-sm border-b border-ink/5 shrink-0">
        <h2 className="font-lv-display text-h3 font-bold text-ink flex items-center gap-gap-xs">
          {title}
          {badge && (
            <span className="font-lv-display text-[10px] font-semibold bg-verde-50 text-verde-600 px-2 py-[2px] rounded-full tracking-[0.14em] uppercase">
              {badge}
            </span>
          )}
        </h2>
        {subtitle && (
          <p className="text-small text-ink-soft/75 mt-[4px]">{subtitle}</p>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-gutter py-gap-sm pb-gutter scrollbar-hide">
        {children}
      </div>

      {/* Scroll fade */}
      <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-white to-transparent pointer-events-none z-[5]" />
    </div>
  );
}
