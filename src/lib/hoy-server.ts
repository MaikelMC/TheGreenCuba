import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { pedidos, reservasDias } from "@/lib/db/schema";
import { clientesConPremio, configFidelidadDe } from "@/lib/fidelidad-server";
import { suscripcionDe } from "@/lib/plans-server";
import { DIAS_AVISO_PAGO, DIAS_GRACIA_VENCIDO, diasHastaPago } from "@/lib/recordatorios-pago";
import { estaAgotado } from "@/lib/disponibilidad";
import { ofertasVigentes } from "@/lib/ofertas";
import { DEV_PLACE_ID } from "@/lib/dev-place";
import type { Funcion } from "@/lib/plans";
import type { PermisoNegocio } from "@/lib/permisos-negocio";
import type { UserPlace } from "@/lib/places-store";
import type { PackMedidaResumen } from "@/lib/pack-medida";

/**
 * «Necesita tu atención»: los avisos de la pantalla Hoy, en el orden en que se
 * pintan. Cada uno trae lo justo para su frase y para la acción que lo resuelve.
 */
export type AvisoHoy =
  | { tipo: "pedidos"; pendientes: number; masAntiguo: string }
  | {
      tipo: "premio";
      clienteId: string;
      nombre: string | null;
      telefonoEnmascarado: string;
      premio: string;
      metaIndice: number;
    }
  | { tipo: "agotados"; total: number; nombres: string[] }
  | { tipo: "tasa"; tasa: number | null }
  | { tipo: "reservas"; ocupadas: number; cupo: number }
  | { tipo: "oferta"; titulo: string }
  | { tipo: "ficha"; pct: number; seccion: string; falta: string }
  | { tipo: "plan"; dias: number }
  | { tipo: "pack"; precioUsd: number }
  | { tipo: "publicada" };

const FORMATO_DIA = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Havana",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** «YYYY-MM-DD» en el calendario de Cuba. */
function diaCuba(fecha: Date | number): string {
  return FORMATO_DIA.format(typeof fecha === "number" ? new Date(fecha) : fecha);
}

/**
 * Qué le falta a la ficha, en el orden en que se le pide al dueño. Cada punto
 * apunta a la `FormSection` del editor que lo resuelve.
 */
function completitudFicha(place: UserPlace): { pct: number; seccion: string; falta: string } | null {
  const puntos: { ok: boolean; seccion: string; falta: string }[] = [
    {
      ok: Boolean(place.logoUrl || place.photos?.length),
      seccion: "fotos",
      falta: "Faltan fotos o el logo",
    },
    {
      ok: (place.description ?? "").trim().length >= 30,
      seccion: "basico",
      falta: "Falta una descripción",
    },
    {
      ok: Boolean(place.horario || place.schedule?.trim()),
      seccion: "horario",
      falta: "Falta el horario",
    },
    {
      ok: Boolean(place.lat && place.lng),
      seccion: "ubicacion",
      falta: "Falta marcarla en el mapa",
    },
    {
      ok: Boolean(place.whatsapp?.trim() || place.phone?.trim()),
      seccion: "contacto",
      falta: "Falta un teléfono o WhatsApp",
    },
  ];
  const hechos = puntos.filter((p) => p.ok).length;
  const primero = puntos.find((p) => !p.ok);
  if (!primero) return null;
  return {
    pct: Math.round((hechos / puntos.length) * 100),
    seccion: primero.seccion,
    falta: primero.falta,
  };
}

/**
 * Los avisos de Hoy para este negocio y esta cuenta.
 *
 * **Barato a propósito.** Lo que ya viene en la ficha (carta, ofertas, tasa,
 * completitud, publicación) se calcula sin consultar. Lo que necesita la base
 * va en paralelo y solo si el negocio tiene la función y la cuenta el permiso:
 * - pedidos pendientes: un `count` y un `min` en una sola consulta;
 * - premios listos: las tarjetas que ya llegan a la meta más baja (máx. 20) y
 *   sus canjes;
 * - reservas de hoy: una fila por (negocio, fecha);
 * - vencimiento del plan: la fila de la suscripción (solo el dueño).
 * Un fallo en una consulta no tumba Hoy: ese aviso no sale.
 */
export async function avisosHoy({
  place,
  funciones,
  esDueno,
  permisos,
  packMedida,
  ahora = new Date(),
}: {
  place: UserPlace;
  funciones: readonly Funcion[];
  esDueno: boolean;
  permisos: readonly PermisoNegocio[];
  packMedida: PackMedidaResumen | null;
  ahora?: Date;
}): Promise<AvisoHoy[]> {
  const tiene = (f: Funcion) => funciones.includes(f);
  const puede = (p: PermisoNegocio) => esDueno || permisos.includes(p);
  const real = place.id !== DEV_PLACE_ID;
  const hoy = diaCuba(ahora);
  const seguro = <T,>(p: Promise<T>, porDefecto: T) => p.catch(() => porDefecto);

  const [pendientes, premios, reservas, suscripcion] = await Promise.all([
    real && puede("pedidos") && tiene("whatsapp_pedido")
      ? seguro(
          db
            .select({
              n: sql<number>`count(*)::int`,
              masAntiguo: sql<string | null>`min(${pedidos.createdAt})`,
            })
            .from(pedidos)
            .where(and(eq(pedidos.placeId, place.id), eq(pedidos.estado, "nuevo")))
            .then(([fila]) => fila ?? null),
          null,
        )
      : Promise.resolve(null),
    real && puede("pedidos") && tiene("cliente_frecuente")
      ? seguro(
          configFidelidadDe(place.id).then((config) =>
            config?.activo ? clientesConPremio(place.id, config, 3) : [],
          ),
          [],
        )
      : Promise.resolve([]),
    real &&
    puede("ficha") &&
    tiene("reservas_whatsapp") &&
    place.aceptaReservas &&
    place.aforoDiarioPersonas
      ? seguro(
          db
            .select({ personas: reservasDias.personas })
            .from(reservasDias)
            .where(and(eq(reservasDias.placeId, place.id), eq(reservasDias.fecha, hoy)))
            .limit(1)
            .then(([fila]) => fila?.personas ?? 0),
          null,
        )
      : Promise.resolve(null),
    real && esDueno ? seguro(suscripcionDe(place.id), null) : Promise.resolve(null),
  ]);

  const avisos: AvisoHoy[] = [];

  if (pendientes && pendientes.n > 0 && pendientes.masAntiguo) {
    avisos.push({
      tipo: "pedidos",
      pendientes: pendientes.n,
      masAntiguo: new Date(pendientes.masAntiguo).toISOString(),
    });
  }

  for (const premio of premios) avisos.push({ tipo: "premio", ...premio });

  if (puede("catalogo")) {
    const agotados = place.menu.filter((p) => !p.oculto && estaAgotado(p, ahora.getTime()));
    if (agotados.length > 0) {
      avisos.push({
        tipo: "agotados",
        total: agotados.length,
        nombres: agotados.slice(0, 3).map((p) => p.name),
      });
    }
  }

  if (esDueno && place.tasaActiva) {
    const actualizada = place.tasaActualizadaEn;
    if (!actualizada || diaCuba(actualizada) < hoy) {
      avisos.push({ tipo: "tasa", tasa: place.tasaUsdCup ?? null });
    }
  }

  if (reservas !== null && place.aforoDiarioPersonas) {
    avisos.push({ tipo: "reservas", ocupadas: reservas, cupo: place.aforoDiarioPersonas });
  }

  if (puede("catalogo") && tiene("ofertas_flash")) {
    const terminaHoy = ofertasVigentes(place.ofertas, ahora.getTime()).find(
      (o) => diaCuba(o.termina) === hoy,
    );
    if (terminaHoy) avisos.push({ tipo: "oferta", titulo: terminaHoy.titulo });
  }

  if (puede("ficha")) {
    const ficha = completitudFicha(place);
    if (ficha) avisos.push({ tipo: "ficha", ...ficha });
  }

  if (esDueno && suscripcion && suscripcion.estado === "activa") {
    const dias = [suscripcion.trialHasta, suscripcion.venceEn]
      .filter((f): f is Date => Boolean(f))
      .map((f) => diasHastaPago(f, ahora))
      .filter((d) => d <= DIAS_AVISO_PAGO && d >= -DIAS_GRACIA_VENCIDO)
      .sort((a, b) => a - b)[0];
    if (dias !== undefined) avisos.push({ tipo: "plan", dias });
  }
  if (esDueno && packMedida?.estado === "enviado") {
    avisos.push({ tipo: "pack", precioUsd: packMedida.precioUsd });
  }

  if (!place.isActive) avisos.push({ tipo: "publicada" });

  return avisos;
}
