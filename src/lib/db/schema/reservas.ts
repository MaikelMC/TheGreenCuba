import { pgTable, text, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { places } from "./places";

/**
 * El cupo de reservas que va gastando cada fecha.
 *
 * Una fila por negocio y día reservado, y **nada más**: no guarda quién
 * reservó, ni su nombre, ni su teléfono, ni el mensaje. La Verde sigue sin
 * guardar la reserva —eso lo cierra el negocio por WhatsApp, como siempre—;
 * esto solo lleva la cuenta de cuántas personas van comprometidas, que es lo
 * único que hace falta para no sobrevender un local.
 *
 * Ese `personas` es un **acumulador**, no un evento: se incrementa al enviar la
 * reserva (`onConflictDoUpdate`) y el dueño puede ponerlo a cero para liberar
 * el día. Por eso es una tabla aparte de `eventos_diarios`, que es analítica de
 * solo sumar y nunca se corrige a mano.
 *
 * `fecha` es **la fecha reservada**, en «YYYY-MM-DD», no el día en que se hizo
 * la reserva —al revés que en `eventos_diarios`—. Es la clave de todo: como el
 * cupo se guarda contra el día reservado, se recarga solo al cambiar de fecha,
 * sin cron ni contador que reiniciar. El tope contra el que se compara es
 * `places.aforo_diario_personas`, que se lee al vuelo: si el dueño lo baja, las
 * reservas ya comprometidas siguen ahí y las nuevas dejan de caber, que es lo
 * que se quiere.
 */
export const reservasDias = pgTable(
  "reservas_dias",
  {
    id: text("id").primaryKey(),
    placeId: text("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    /** La fecha reservada, «YYYY-MM-DD». */
    fecha: text("fecha").notNull(),
    /** Personas comprometidas para esa fecha. Es lo que se compara con el cupo. */
    personas: integer("personas").notNull().default(0),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    /* La clave del upsert, del `liberar` y de la lectura: una fila por negocio y
       fecha, y todo filtra por negocio, así que este índice sirve a las tres. */
    claveUnique: unique("reservas_dias_clave_unique").on(
      table.placeId,
      table.fecha,
    ),
  }),
);
