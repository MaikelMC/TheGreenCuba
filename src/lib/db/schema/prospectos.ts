import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { places } from "./places";
import { users } from "./users";

/**
 * Un prospecto comercial: alguien a quien se está intentando convertir en
 * negocio de La Verde.
 *
 * No es una ficha ni una solicitud. La ficha es lo que ya existe y se publica;
 * el prospecto es el seguimiento previo, con su etapa y su próximo paso. Cuando
 * llega a `pagando` y ya tiene ficha, `negocio_id` deja el enlace; mientras
 * tanto puede seguir sin negocio y sin inventar una relación que no existe.
 */
export const prospectos = pgTable(
  "prospectos",
  {
    id: text("id").primaryKey(),
    nombre: text("nombre").notNull(),
    provincia: text("provincia").notNull(),

    origen: text("origen", {
      enum: ["visita_propia", "afiliado", "analytics"],
    })
      .default("visita_propia")
      .notNull(),
    /** El código del afiliado o el término de analytics, según el origen. */
    origenDetalle: text("origen_detalle"),

    etapa: text("etapa", {
      enum: ["contactado", "visitado", "interesado", "pack_enviado", "pagando"],
    })
      .default("contactado")
      .notNull(),
    proximoPaso: text("proximo_paso").notNull().default(""),
    /** Fecha límite del próximo paso; el texto dice qué hay que hacer. */
    proximoPasoEn: timestamp("proximo_paso_en"),
    notas: text("notas").notNull().default(""),

    adminResponsableId: text("admin_responsable_id").references(() => users.id, {
      onDelete: "set null",
    }),
    negocioId: text("negocio_id").references(() => places.id, {
      onDelete: "set null",
    }),

    etapaCambiadaEn: timestamp("etapa_cambiada_en").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    etapaIdx: index("prospectos_etapa_idx").on(table.etapa),
    responsableIdx: index("prospectos_responsable_idx").on(
      table.adminResponsableId,
    ),
    negocioIdx: index("prospectos_negocio_idx").on(table.negocioId),
    actualizadoIdx: index("prospectos_actualizado_idx").on(table.updatedAt),
  }),
);

export const prospectoRelations = relations(prospectos, ({ one }) => ({
  responsable: one(users, {
    fields: [prospectos.adminResponsableId],
    references: [users.id],
  }),
  negocio: one(places, {
    fields: [prospectos.negocioId],
    references: [places.id],
  }),
}));
