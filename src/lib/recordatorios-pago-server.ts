import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { cargarCatalogo } from "@/lib/catalogo-server";
import { db } from "@/lib/db";
import {
  businessOwners,
  packsMedida,
  places,
  recordatoriosPago,
  suscripciones,
  users,
} from "@/lib/db/schema";
import { DEV_PLACE_ID } from "@/lib/dev-place";
import {
  emailConfigured,
  paymentReminderEmailHtml,
  sendEmail,
} from "@/lib/email";
import { aSuscripcion, funcionesDe, nombreDe, precioConDescuento, usdDe } from "@/lib/plans";
import { enviarPushAUsuarios } from "@/lib/push-server";
import {
  avisoDePago,
  diasHastaPago,
  etapaDePago,
  sugerenciasParaProbar,
  type EtapaPago,
} from "@/lib/recordatorios-pago";
import { generateId } from "@/lib/utils";

/**
 * El recordatorio mensual de pago del negocio.
 *
 * Corre a diario y decide a quién le toca hoy: cinco días antes del vencimiento,
 * el día antes y —si no renovó— al día siguiente. No hay un «cron de los pagos»
 * por negocio: cada ficha tiene su fecha, así que el trabajo barre todas las
 * suscripciones y compara contra el calendario.
 *
 * **La fecha del ciclo es la que manda.** Un negocio en prueba paga cuando acaba
 * la prueba (`trial_hasta`); uno que ya paga, cuando vence el mes (`vence_en`).
 * Si las dos existen y están cerca, se avisa de la más urgente, que es la que
 * apaga las funciones primero.
 *
 * **Nada de esto puede tumbar el trabajo entero.** Un negocio con un error
 * —un dueño borrado, un correo raro— se registra y se sigue con el siguiente.
 * Y el registro en `recordatorios_pago` se escribe **antes** de enviar: si el
 * envío falla, la fila queda con el canal pendiente y el siguiente día lo
 * reintenta, pero no vuelve a mandar lo que ya llegó.
 */

export interface ResumenRecordatorios {
  /** Suscripciones activas que se miraron. */
  revisados: number;
  /** Negocios a los que les tocaba aviso hoy. */
  avisados: number;
  /** Push entregados (una suscripción de navegador cada uno). */
  push: number;
  /** Correos aceptados por Resend. */
  emails: number;
  /** Canales que se dejaron para otro día: sin VAPID, sin Resend o sin dueño. */
  pendientes: number;
}

interface FilaSuscripcion {
  negocioId: string;
  nombre: string;
  plan: "gratis" | "esencial" | "publicidad_max" | "pro";
  estado: "activa" | "cancelada";
  trialHasta: Date | null;
  venceEn: Date | null;
  modulos: { clave: string; desde: string; hasta: string | null }[];
  descuentoPct: number | null;
}

/** La URL base del correo: sin barra final y sin `undefined` si falta la variable. */
function baseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://laverde.cu"
  ).replace(/\/+$/, "");
}

/** Un nombre de negocio con `<` no puede romper el HTML del correo. */
function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * La fecha del ciclo que toca recordar hoy, si hay alguna.
 *
 * Entre prueba y pago se elige **la más próxima**: es la que primero le quita
 * funciones al negocio y, por tanto, la que de verdad hay que pagar. Las que ya
 * pasaron de la ventana de gracia no cuentan.
 */
function fechaDelAviso(
  fila: FilaSuscripcion,
  ahora: Date,
): { fecha: Date; etapa: EtapaPago; dias: number } | null {
  let elegida: { fecha: Date; etapa: EtapaPago; dias: number } | null = null;

  for (const fecha of [fila.trialHasta, fila.venceEn]) {
    if (!fecha) continue;
    const dias = diasHastaPago(fecha, ahora);
    const etapa = etapaDePago(dias);
    if (!etapa) continue;
    if (!elegida || dias < elegida.dias) elegida = { fecha, etapa, dias };
  }

  return elegida;
}

/** Los dueños que pagan: la cuenta se le manda al rol `owner`, no a un editor. */
async function dueñosDe(
  negocioId: string,
): Promise<{ userId: string; email: string }[]> {
  return db
    .select({ userId: users.id, email: users.email })
    .from(businessOwners)
    .innerJoin(users, eq(users.id, businessOwners.userId))
    .where(
      and(
        eq(businessOwners.placeId, negocioId),
        eq(businessOwners.role, "owner"),
      ),
    );
}

/**
 * Crea el registro del aviso, o devuelve el que ya existía.
 *
 * `onConflictDoNothing` es la guarda contra dos ejecuciones a la vez —un cron y
 * un `curl` manual, por ejemplo—: la segunda no crea fila y trabaja sobre la
 * primera, así que el correo no sale dos veces.
 */
async function reclamarAviso(input: {
  negocioId: string;
  fechaPago: Date;
  etapa: EtapaPago;
  concepto?: "plan" | "pack_medida";
}): Promise<{
  pushEnviadoEn: Date | null;
  emailEnviadoEn: Date | null;
} | null> {
  const concepto = input.concepto ?? "plan";

  const [creada] = await db
    .insert(recordatoriosPago)
    .values({
      id: generateId(),
      negocioId: input.negocioId,
      fechaPago: input.fechaPago,
      tipo: input.etapa,
      concepto,
    })
    .onConflictDoNothing({
      target: [
        recordatoriosPago.negocioId,
        recordatoriosPago.fechaPago,
        recordatoriosPago.tipo,
        recordatoriosPago.concepto,
      ],
    })
    .returning({
      pushEnviadoEn: recordatoriosPago.pushEnviadoEn,
      emailEnviadoEn: recordatoriosPago.emailEnviadoEn,
    });

  if (creada) return creada;

  const [existente] = await db
    .select({
      pushEnviadoEn: recordatoriosPago.pushEnviadoEn,
      emailEnviadoEn: recordatoriosPago.emailEnviadoEn,
    })
    .from(recordatoriosPago)
    .where(
      and(
        eq(recordatoriosPago.negocioId, input.negocioId),
        eq(recordatoriosPago.fechaPago, input.fechaPago),
        eq(recordatoriosPago.tipo, input.etapa),
        eq(recordatoriosPago.concepto, concepto),
      ),
    )
    .limit(1);

  return existente ?? null;
}

async function marcarCanal(
  input: {
    negocioId: string;
    fechaPago: Date;
    etapa: EtapaPago;
    concepto?: "plan" | "pack_medida";
  },
  canal: "push" | "email",
): Promise<void> {
  await db
    .update(recordatoriosPago)
    .set(
      canal === "push"
        ? { pushEnviadoEn: new Date() }
        : { emailEnviadoEn: new Date() },
    )
    .where(
      and(
        eq(recordatoriosPago.negocioId, input.negocioId),
        eq(recordatoriosPago.fechaPago, input.fechaPago),
        eq(recordatoriosPago.tipo, input.etapa),
        eq(recordatoriosPago.concepto, input.concepto ?? "plan"),
      ),
    );
}

/** El nombre del plan tal como se le cuenta al dueño, con la prueba aparte. */
function planDelAviso(
  fila: FilaSuscripcion,
  fecha: Date,
): { plan: string; precioUsd: number | null } {
  const esPrueba = Boolean(
    fila.trialHasta && fila.trialHasta.getTime() === fecha.getTime(),
  );

  if (esPrueba) return { plan: "Pro (en prueba)", precioUsd: null };
  if (fila.plan === "gratis") return { plan: "Gratis", precioUsd: null };

  const { final } = precioConDescuento(usdDe(fila.plan), fila.descuentoPct);
  return { plan: nombreDe(fila.plan), precioUsd: final };
}

/**
 * Envía los avisos que toquen para `ahora`.
 *
 * Devuelve un resumen y no lanza: el cron necesita terminar con el resto de
 * negocios aunque uno falle, y el 200 con el recuento es más útil que un 500 sin
 * saber a quién se le llegó a avisar.
 */
export async function enviarRecordatoriosDePago(
  ahora: Date = new Date(),
): Promise<ResumenRecordatorios> {
  const resumen: ResumenRecordatorios = {
    revisados: 0,
    avisados: 0,
    push: 0,
    emails: 0,
    pendientes: 0,
  };

  const filas = await db
    .select({
      negocioId: places.id,
      nombre: places.name,
      plan: suscripciones.plan,
      estado: suscripciones.estado,
      trialHasta: suscripciones.trialHasta,
      venceEn: suscripciones.venceEn,
      modulos: suscripciones.modulos,
      descuentoPct: suscripciones.descuentoPct,
    })
    .from(suscripciones)
    .innerJoin(places, eq(places.id, suscripciones.negocioId))
    .where(and(eq(suscripciones.estado, "activa"), eq(places.isActive, true)));

  resumen.revisados = filas.length;

  /* Primero se decide a quién le toca, y solo después se consulta la tabla de
     enviados. Así la consulta de existentes lleva solo los ids que importan en
     vez de todo el histórico. */
  const pendientes: {
    fila: FilaSuscripcion;
    aviso: { fecha: Date; etapa: EtapaPago; dias: number };
  }[] = [];

  for (const fila of filas) {
    const aviso = fechaDelAviso(fila, ahora);
    if (!aviso) continue;
    /* El negocio de prueba es un fixture: no tiene dueño real ni forma de pagar. */
    if (fila.negocioId === DEV_PLACE_ID) continue;
    pendientes.push({ fila, aviso });
  }

  if (pendientes.length === 0) return resumen;

  const cat = await cargarCatalogo();
  const ids = [...new Set(pendientes.map((entrada) => entrada.fila.negocioId))];

  let yaEnviados: {
    negocioId: string;
    fechaPago: Date;
    tipo: EtapaPago;
    pushEnviadoEn: Date | null;
    emailEnviadoEn: Date | null;
  }[] = [];
  try {
    yaEnviados = await db
      .select({
        negocioId: recordatoriosPago.negocioId,
        fechaPago: recordatoriosPago.fechaPago,
        tipo: recordatoriosPago.tipo,
        pushEnviadoEn: recordatoriosPago.pushEnviadoEn,
        emailEnviadoEn: recordatoriosPago.emailEnviadoEn,
      })
      .from(recordatoriosPago)
      .where(inArray(recordatoriosPago.negocioId, ids));
  } catch (error) {
    /* Sin la tabla (migración pendiente) no se puede garantizar el «una sola
       vez»; se prefiere no mandar nada antes que mandar el mismo correo todos
       los días. */
    console.error(
      "[recordatorios-pago] no se pudo leer el histórico:",
      error instanceof Error ? error.message : error,
    );
    return resumen;
  }

  const indice = new Map(
    yaEnviados.map((fila) => [
      `${fila.negocioId}|${fila.fechaPago.getTime()}|${fila.tipo}`,
      fila,
    ]),
  );

  for (const { fila, aviso } of pendientes) {
    const clave = `${fila.negocioId}|${aviso.fecha.getTime()}|${aviso.etapa}`;
    const previo = indice.get(clave);

    /* Los dos canales ya salieron: este aviso no se vuelve a tocar, aunque el
       cron siga corriendo dentro de la ventana. */
    if (previo?.pushEnviadoEn && previo.emailEnviadoEn) continue;

    try {
      const registro = previo
        ? {
            pushEnviadoEn: previo.pushEnviadoEn,
            emailEnviadoEn: previo.emailEnviadoEn,
          }
        : await reclamarAviso({
            negocioId: fila.negocioId,
            fechaPago: aviso.fecha,
            etapa: aviso.etapa,
          });

      if (!registro) continue;

      const dueños = await dueñosDe(fila.negocioId);
      const userIds = dueños.map((dueño) => dueño.userId);
      const suscripcion = aSuscripcion(fila);
      const { plan, precioUsd } = planDelAviso(fila, aviso.fecha);
      const texto = avisoDePago({
        negocio: fila.nombre,
        plan,
        precioUsd,
        fechaPago: aviso.fecha,
        etapa: aviso.etapa,
        sugerencias: sugerenciasParaProbar(
          funcionesDe(suscripcion, ahora, cat),
          cat,
        ),
        ahora,
      });

      let quedaPendiente = false;

      if (!registro.pushEnviadoEn && userIds.length === 0) {
        /* Una ficha sin dueño vinculado no tiene a quién empujar: se cierra el
           canal para no volver a intentarlo cada mañana. */
        await marcarCanal(
          {
            negocioId: fila.negocioId,
            fechaPago: aviso.fecha,
            etapa: aviso.etapa,
          },
          "push",
        );
      }

      if (!registro.pushEnviadoEn && userIds.length > 0) {
        const envio = await enviarPushAUsuarios(userIds, {
          title: texto.push.title,
          body: texto.push.body,
          url: "/business?seccion=planes",
          tag: `pago-${fila.negocioId}-${aviso.etapa}`,
        });

        resumen.push += envio.enviados;

        if (envio.omitido) {
          /* Sin VAPID no se marca: el día que se configure, este aviso sale con
             la fecha que aún esté en ventana. */
          quedaPendiente = true;
        } else {
          await marcarCanal(
            {
              negocioId: fila.negocioId,
              fechaPago: aviso.fecha,
              etapa: aviso.etapa,
            },
            "push",
          );
        }
      }

      if (!registro.emailEnviadoEn) {
        if (!emailConfigured()) {
          quedaPendiente = true;
        } else if (dueños.length === 0) {
          /* Sin dueño con perfil no hay a quién escribir: se cierra el canal
             para no reintentarlo cada mañana. */
          await marcarCanal(
            {
              negocioId: fila.negocioId,
              fechaPago: aviso.fecha,
              etapa: aviso.etapa,
            },
            "email",
          );
        } else {
          let alguno = false;
          for (const dueño of dueños) {
            if (!dueño.email?.includes("@")) continue;
            const id = await sendEmail({
              to: [dueño.email],
              subject: texto.asunto,
              html: paymentReminderEmailHtml({
                titular: texto.titular,
                saludo: texto.saludo,
                negocio: escaparHtml(fila.nombre),
                plan,
                fechaPago: texto.fecha,
                parrafos: texto.parrafos,
                sugerencias: texto.sugerencias,
                cta: {
                  texto: texto.ctaTexto,
                  url: `${baseUrl()}/business?seccion=planes`,
                },
                vencido: aviso.etapa === "vencido",
              }),
            });
            if (id) {
              alguno = true;
              resumen.emails += 1;
            }
          }

          if (alguno) {
            await marcarCanal(
              {
                negocioId: fila.negocioId,
                fechaPago: aviso.fecha,
                etapa: aviso.etapa,
              },
              "email",
            );
          } else {
            quedaPendiente = true;
          }
        }
      }

      if (quedaPendiente) resumen.pendientes += 1;
      resumen.avisados += 1;
    } catch (error) {
      console.error(
        `[recordatorios-pago] falló el aviso de ${fila.negocioId}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  return resumen;
}

/**
 * Avisos de vencimiento de packs a medida.
 *
 * Mismo esquema que `enviarRecordatoriosDePago` pero para `packs_medida.vence_en`.
 * Los recordatorios llevan `concepto = 'pack_medida'` para no colisionar con los
 * del plan estándar aunque caigan el mismo día.
 *
 * Solo avisos push: el mensaje de pack es más personalizado y por ahora no hay
 * plantilla de correo específica. El correo se puede añadir sin cambiar la tabla.
 */
export async function enviarRecordatoriosDePackMedida(
  ahora: Date = new Date(),
): Promise<ResumenRecordatorios> {
  const resumen: ResumenRecordatorios = {
    revisados: 0,
    avisados: 0,
    push: 0,
    emails: 0,
    pendientes: 0,
  };

  /* Packs pagados cuyo vencimiento cae en alguna de las tres ventanas. */
  const filas = await db
    .select({
      id: packsMedida.id,
      negocioId: packsMedida.negocioId,
      nombre: places.name,
      venceEn: packsMedida.venceEn,
    })
    .from(packsMedida)
    .innerJoin(places, eq(places.id, packsMedida.negocioId))
    .where(
      and(
        eq(packsMedida.estado, "pagado"),
        eq(places.isActive, true),
        /* Solo los que aún no vencieron hace más de 24 h (ventana de gracia). */
        gt(packsMedida.venceEn, sql`now() - interval '1 day'`),
      ),
    );

  resumen.revisados = filas.length;

  const pendientes: { negocioId: string; nombre: string; venceEn: Date; etapa: EtapaPago }[] = [];

  for (const fila of filas) {
    if (!fila.venceEn || fila.negocioId === DEV_PLACE_ID) continue;
    const dias = diasHastaPago(fila.venceEn, ahora);
    const etapa = etapaDePago(dias);
    if (!etapa) continue;
    pendientes.push({ negocioId: fila.negocioId, nombre: fila.nombre, venceEn: fila.venceEn, etapa });
  }

  if (pendientes.length === 0) return resumen;

  const ids = [...new Set(pendientes.map((p) => p.negocioId))];

  let yaEnviados: { negocioId: string; fechaPago: Date; tipo: EtapaPago; pushEnviadoEn: Date | null; emailEnviadoEn: Date | null }[] = [];
  try {
    yaEnviados = await db
      .select({
        negocioId: recordatoriosPago.negocioId,
        fechaPago: recordatoriosPago.fechaPago,
        tipo: recordatoriosPago.tipo,
        pushEnviadoEn: recordatoriosPago.pushEnviadoEn,
        emailEnviadoEn: recordatoriosPago.emailEnviadoEn,
      })
      .from(recordatoriosPago)
      .where(
        and(
          inArray(recordatoriosPago.negocioId, ids),
          eq(recordatoriosPago.concepto, "pack_medida"),
        ),
      );
  } catch {
    return resumen;
  }

  const indice = new Map(
    yaEnviados.map((r) => [`${r.negocioId}|${r.fechaPago.getTime()}|${r.tipo}`, r]),
  );

  for (const { negocioId, nombre, venceEn, etapa } of pendientes) {
    const clave = `${negocioId}|${venceEn.getTime()}|${etapa}`;
    const previo = indice.get(clave);

    if (previo?.pushEnviadoEn) continue;

    try {
      const registro = previo
        ? { pushEnviadoEn: previo.pushEnviadoEn, emailEnviadoEn: previo.emailEnviadoEn }
        : await reclamarAviso({ negocioId, fechaPago: venceEn, etapa, concepto: "pack_medida" });

      if (!registro) continue;
      if (registro.pushEnviadoEn) continue;

      const dueños = await dueñosDe(negocioId);
      const userIds = dueños.map((d) => d.userId);

      if (userIds.length === 0) {
        await marcarCanal({ negocioId, fechaPago: venceEn, etapa, concepto: "pack_medida" }, "push");
        continue;
      }

      const dias = diasHastaPago(venceEn, ahora);
      const titulo = etapa === "vencido"
        ? `Tu pack a medida de «${nombre}» venció`
        : `Tu pack a medida vence en ${dias} día${dias === 1 ? "" : "s"}`;
      const cuerpo = etapa === "vencido"
        ? "Renueva tu pack para seguir con tus funciones extra."
        : `El pack de «${nombre}» vence pronto. Renuévalo para no perder el acceso.`;

      const envio = await enviarPushAUsuarios(userIds, {
        title: titulo,
        body: cuerpo,
        url: "/business?seccion=planes",
        tag: `pack-${negocioId}-${etapa}`,
      });

      resumen.push += envio.enviados;

      if (!envio.omitido) {
        await marcarCanal({ negocioId, fechaPago: venceEn, etapa, concepto: "pack_medida" }, "push");
      } else {
        resumen.pendientes += 1;
      }

      resumen.avisados += 1;
    } catch (error) {
      console.error(
        `[recordatorios-pack] falló el aviso de ${negocioId}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  return resumen;
}
