/**
 * Radio escrito por el usuario dentro de la consulta («…a menos de 1 km»).
 *
 * Vive en su propio módulo y no dentro de `place-search.ts` porque es texto
 * puro: allí arrastraría el cliente de Neon, que se construye al importar y
 * revienta sin `DATABASE_URL`. Así esta función se puede comprobar sin base de
 * datos ni red.
 */

/* `ponytail:` es un regex, no comprensión del lenguaje — «cerca de aquí» o «a un
   paso» no los detecta, y para eso está la ubicación del usuario, que ya
   prioriza por cercanía real. Subir a un parser de cantidades el día que
   alguien pida «a 20 cuadras». */
const RADIUS_RE = /\ba\s+menos\s+de\s+(\d+(?:[.,]\d+)?)\s*(km|m|metros|kil[oó]metros)\b/i;

/** Metros, o `null` si la consulta no pide ningún radio. */
export function explicitRadiusM(query: string): number | null {
  const m = RADIUS_RE.exec(query);
  if (!m) return null;
  const value = Number(m[1]!.replace(",", "."));
  if (!Number.isFinite(value) || value <= 0) return null;
  const unit = m[2]!.toLowerCase();
  const meters = unit.startsWith("k") ? value * 1000 : value;
  /* Sin tope, un «a menos de 5000 km» no filtra nada y engaña al usuario
     haciéndole creer que filtró. */
  return Math.min(meters, 100_000);
}
