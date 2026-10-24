/**
 * Tipos de `web-push`.
 *
 * El paquete (3.6.7) no publica declaraciones y `@types/web-push` no está
 * instalado: sin esto, TypeScript rechaza el import. Se declara solo lo que se
 * usa —configurar VAPID, enviar y leer el código de estado del error—, no la
 * API entera.
 */
declare module "web-push" {
  export interface PushSubscription {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  }

  export interface SendResult {
    statusCode: number;
    body: string;
    headers: Record<string, string>;
  }

  export interface WebPushError extends Error {
    /** Código HTTP que devolvió el servicio push (410, 404, 429…). */
    statusCode?: number;
  }

  export interface SendOptions {
    TTL?: number;
    urgency?: "very-low" | "low" | "normal" | "high";
    topic?: string;
  }

  export interface WebPush {
    setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
    sendNotification(
      subscription: PushSubscription,
      payload?: string | Buffer | null,
      options?: SendOptions,
    ): Promise<SendResult>;
  }

  const webpush: WebPush;
  export default webpush;
}
