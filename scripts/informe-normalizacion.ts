/**
 * Informe de normalización de barrios y direcciones.
 *
 * Lee la base y escribe `INFORME-BARRIOS-DIRECCIONES.md` con las filas que
 * cambiarían si se limpiaran. **No escribe en la base.** El barrio y la
 * dirección se normalizan al mostrar y al crear fichas nuevas; reescribir las
 * existentes necesita una decisión aparte.
 *
 * Uso:
 *   npx tsx --env-file-if-exists=.env scripts/informe-normalizacion.ts
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { db, pool } from "@/lib/db";
import { places } from "@/lib/db/schema";
import {
  formatearBarrio,
  formatearDireccion,
} from "@/lib/texto-lugar";
import { listarTiposSospechosos } from "@/lib/admin-tipos-sospechosos-server";

function celda(valor: string): string {
  return valor.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

async function main() {
  const filas = await db
    .select({
      id: places.id,
      name: places.name,
      address: places.address,
      neighborhood: places.neighborhood,
      city: places.city,
    })
    .from(places)
    .orderBy(places.name);

  const barrios: { id: string; name: string; antes: string; despues: string }[] = [];
  const direcciones: { id: string; name: string; antes: string; despues: string }[] = [];

  for (const fila of filas) {
    const barrioAntes = (fila.neighborhood || fila.city || "").trim();
    const barrioDespues = formatearBarrio(barrioAntes);
    if (barrioAntes && barrioAntes !== barrioDespues) {
      barrios.push({ id: fila.id, name: fila.name, antes: barrioAntes, despues: barrioDespues });
    }

    const direccionAntes = (fila.address ?? "").trim();
    const direccionDespues = formatearDireccion(direccionAntes);
    if (direccionAntes && direccionAntes !== direccionDespues) {
      direcciones.push({
        id: fila.id,
        name: fila.name,
        antes: direccionAntes,
        despues: direccionDespues,
      });
    }
  }

  const tipos = await listarTiposSospechosos();

  const lineas: string[] = [
    "# Informe de barrios y direcciones",
    "",
    "Generado por `scripts/informe-normalizacion.ts`. **No se ha reescrito nada en la base.**",
    "",
    `- Fichas leídas: ${filas.length}`,
    `- Barrios que cambiarían al mostrar: ${barrios.length}`,
    `- Direcciones que cambiarían al mostrar (prefijo o espacios): ${direcciones.length}`,
    "",
    "## Barrios",
    "",
  ];

  if (barrios.length === 0) {
    lineas.push("No hay barrios que cambien con las reglas actuales.", "");
  } else {
    lineas.push("| id | Negocio | Antes | Después |", "|---|---|---|---|");
    for (const fila of barrios) {
      lineas.push(
        `| \`${celda(fila.id)}\` | ${celda(fila.name)} | ${celda(fila.antes)} | ${celda(fila.despues)} |`,
      );
    }
    lineas.push("");
  }

  lineas.push("## Direcciones", "");
  if (direcciones.length === 0) {
    lineas.push("No hay direcciones que pierdan prefijo con las reglas actuales.", "");
  } else {
    lineas.push("| id | Negocio | Antes | Después |", "|---|---|---|---|");
    for (const fila of direcciones) {
      lineas.push(
        `| \`${celda(fila.id)}\` | ${celda(fila.name)} | ${celda(fila.antes)} | ${celda(fila.despues)} |`,
      );
    }
    lineas.push("");
  }

  const destino = join(process.cwd(), "INFORME-BARRIOS-DIRECCIONES.md");
  writeFileSync(destino, lineas.join("\n"), "utf8");

  const lineasTipos: string[] = [
    "# Tipos de negocio sospechosos",
    "",
    "Generado por `scripts/informe-normalizacion.ts` a partir de la misma función que alimenta",
    "`/api/admin/tipos-sospechosos`. **No se ha cambiado ninguna categoría.** La lista es para",
    "revisarla desde el panel de administración.",
    "",
    `- Sospechosos: ${tipos.length}`,
    "",
  ];

  if (tipos.length === 0) {
    lineasTipos.push("No hay fichas sospechosas con las reglas actuales.");
  } else {
    lineasTipos.push(
      "| id | Negocio | Categoría actual | Sugerida | Confianza | Motivo | Coincidencias |",
      "|---|---|---|---|---|---|---|",
    );
    for (const tipo of tipos) {
      lineasTipos.push(
        `| \`${celda(tipo.id)}\` | ${celda(tipo.name)} | ${celda(tipo.category)} | ${celda(tipo.sugerida)} | ${tipo.confianza} | ${celda(tipo.motivo)} | ${celda(tipo.coincidencias.join(", "))} |`,
      );
    }
  }

  writeFileSync(
    join(process.cwd(), "INFORME-TIPOS-SOSPECHOSOS.md"),
    lineasTipos.join("\n"),
    "utf8",
  );

  console.log(
    `Informes escritos: ${barrios.length} barrios, ${direcciones.length} direcciones, ${tipos.length} tipos sospechosos.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error("No se pudo generar el informe:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
