import { getAppUser } from "@/lib/auth/user";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * SSE stream de notificaciones.
 *
 * Mantiene la conexión abierta y empuja cambios al cliente en lugar de
 * que el cliente haga polling. Si el cliente no soporta SSE, el
 * `UserMenu` cae en polling adaptativo (exponential backoff).
 *
 * La conexión se cierra automáticamente tras 55 s (límite de vercel/edge)
 * y el cliente reconecta. Para producción con carga alta, mover a
 * WebSocket o servicio de push dedicado.
 */
export async function GET() {
  const user = await getAppUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const userId = user.id;
  const encoder = new TextEncoder();

  function fetchAndEncode() {
    return db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(20)
      .then((rows) => encoder.encode(`data: ${JSON.stringify(rows)}\n\n`));
  }

  const stream = new ReadableStream({
    async start(controller) {
      // Envío inicial
      const initial = await fetchAndEncode();
      controller.enqueue(initial);

      // Heartbeat cada 15 s para mantener la conexión viva
      const heartbeat = setInterval(async () => {
        const data = await fetchAndEncode();
        controller.enqueue(data);
      }, 15000);

      // Cierre limpio al desconectar el cliente
      const abortHandler = () => {
        clearInterval(heartbeat);
        controller.close();
      };

      // Usar AbortSignal nativo del controller
      const signal = (
        controller as ReadableStreamDefaultController & { signal?: AbortSignal }
      ).signal;
      signal?.addEventListener("abort", abortHandler);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // desactiva buffering en nginx
    },
  });
}
