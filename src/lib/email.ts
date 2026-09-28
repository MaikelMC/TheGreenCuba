import { Resend } from "resend";

/**
 * Envío de correo transaccional con Resend.
 *
 * Sin `RESEND_API_KEY` todo queda en no-op y se registra en el log del
 * servidor: las funciones críticas (alta de negocio, ticket de soporte) no
 * dependen del correo para responder — el correo es un aviso, no la escritura.
 *
 * **Sobre el remitente:** Resend solo envía desde dominios verificados en su
 * panel, y `gmail.com` no se puede verificar. Mientras se verifica un dominio
 * propio (p. ej. `laverde.cu`, cuyo DNS ya controla el equipo), el remitente
 * sale del sandbox `onboarding@resend.dev` — que solo entrega a correos de la
 * cuenta de Resend — y el `Reply-To` apunta a `soporte@laverde.cu`, así
 * que toda respuesta del correo cae en el buzón de soporte. Con el dominio
 * verificado, basta con `RESEND_FROM="La Verde <avisos@laverde.cu>"`.
 *
 * Los destinatarios de administración salen de `RESEND_NOTIFY_EMAILS` (lista
 * separada por comas) o, si no existe, se extraen de `AUTH_BOOTSTRAP_ROLES`,
 * que ya nombra a los dos administradores del sistema.
 */

const resend = new Resend(process.env.RESEND_API_KEY?.trim());

export interface OutgoingEmail {
  to: string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

function adminRecipients(): string[] {
  const configured = process.env.RESEND_NOTIFY_EMAILS?.trim();
  if (configured) {
    return configured
      .split(",")
      .map((email) => email.trim())
      .filter((email) => email.includes("@"));
  }

  const bootstrap = process.env.AUTH_BOOTSTRAP_ROLES ?? "";
  return bootstrap
    .split(",")
    .map((pair) => pair.split("=")[0]?.trim() ?? "")
    .filter((email) => email.includes("@"));
}

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

/** Envía un correo. Devuelve el id de Resend, o `null` si no se envió. */
export async function sendEmail(email: OutgoingEmail): Promise<string | null> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.warn(
      "[email] RESEND_API_KEY no configurada: correo no enviado —",
      email.subject,
    );
    return null;
  }
  if (email.to.length === 0) {
    console.warn("[email] Sin destinatarios para:", email.subject);
    return null;
  }

  const from =
    process.env.RESEND_FROM?.trim() || "La Verde <onboarding@resend.dev>";
  const replyTo =
    email.replyTo?.trim() || process.env.SUPPORT_REPLY_TO?.trim() || undefined;

  try {
    const { data, error } = await resend.emails.send({
      from,
      to: email.to,
      subject: email.subject,
      html: email.html,
      ...(email.text ? { text: email.text } : {}),
      ...(replyTo ? { reply_to: replyTo } : {}),
    });

    if (error) {
      console.error("[email] Resend rechazó el envío:", error);
      return null;
    }

    return data?.id ?? null;
  } catch (error) {
    console.error(
      "[email] Falló el envío:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

/**
 * Plantilla de email para nueva solicitud de negocio.
 * Diseño acorde a La Verde: verde principal, tipografía limpia, tarjeta blanca.
 */
export function businessSubmissionEmailHtml(input: {
  businessName: string;
  category: string;
  ownerName: string;
  ownerEmail: string;
  plan: string;
  address: string;
  barrio: string;
  province: string;
  adminUrl: string;
}): string {
  const {
    businessName,
    category,
    ownerName,
    ownerEmail,
    plan,
    address,
    barrio,
    province,
    adminUrl,
  } = input;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nueva solicitud de negocio - La Verde</title>
</head>
<body style="margin:0;padding:0;background:#F6F3EC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;line-height:1.5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F6F3EC;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#FFFFFF;border-radius:20px;border:1px solid rgba(8,19,13,0.06);overflow:hidden;box-shadow:0 4px 24px -8px rgba(8,19,13,0.12);">
          
          <!-- Header -->
          <tr>
            <td style="padding:36px 32px 24px;background:linear-gradient(135deg,#35AF6D 0%,#2D9B5E 100%);">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="width:48px;height:48px;border-radius:14px;background:#FFFFFF;text-align:center;vertical-align:middle;">
                    <span style="display:inline-block;line-height:48px;font-size:20px;font-weight:800;color:#35AF6D;letter-spacing:-0.5px;">LV</span>
                  </td>
                  <td style="padding-left:16px;color:#FFFFFF;">
                    <div style="font-size:18px;font-weight:700;letter-spacing:-0.3px;">La Verde</div>
                    <div style="font-size:13px;opacity:0.9;margin-top:2px;">Panel de Administración</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding:36px 32px 8px;">
              <h1 style="margin:0 0 12px;font-size:24px;font-weight:700;color:#08130D;letter-spacing:-0.5px;">
                Nueva solicitud de negocio
              </h1>
              <p style="margin:0 0 24px;font-size:15px;color:#5B6B62;line-height:1.6;">
                Un usuario ha enviado su negocio para revisión. Revisa los detalles y aprueba o rechaza desde el panel.
              </p>

              <!-- Business Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F8FDF9;border:1px solid rgba(53,175,109,0.12);border-radius:16px;overflow:hidden;margin-bottom:24px;">
                <tr>
                  <td style="padding:24px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="width:56px;height:56px;border-radius:14px;background:#EAF7EF;text-align:center;vertical-align:middle;">
                          <span style="font-size:24px;">🏪</span>
                        </td>
                        <td style="padding-left:16px;">
                          <div style="font-size:18px;font-weight:700;color:#08130D;letter-spacing:-0.3px;">${businessName}</div>
                          <div style="font-size:13px;color:#35AF6D;font-weight:600;margin-top:4px;text-transform:uppercase;letter-spacing:0.5px;">${category}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Details Grid -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:28px;">
                <tr>
                  <td style="padding:8px 0;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#FFFFFF;border:1px solid rgba(8,19,13,0.05);border-radius:12px;">
                      <tr>
                        <td style="padding:16px 20px;border-bottom:1px solid rgba(8,19,13,0.04);">
                          <div style="font-size:12px;color:#94A39B;text-transform:uppercase;letter-spacing:0.8px;font-weight:600;">Propietario</div>
                          <div style="margin-top:4px;font-size:15px;color:#08130D;font-weight:600;">${ownerName}</div>
                          <div style="margin-top:2px;font-size:13px;color:#5B6B62;">${ownerEmail}</div>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:16px 20px;border-bottom:1px solid rgba(8,19,13,0.04);">
                          <div style="font-size:12px;color:#94A39B;text-transform:uppercase;letter-spacing:0.8px;font-weight:600;">Plan solicitado</div>
                          <div style="margin-top:4px;font-size:15px;color:#08130D;font-weight:600;">${plan}</div>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:16px 20px;">
                          <div style="font-size:12px;color:#94A39B;text-transform:uppercase;letter-spacing:0.8px;font-weight:600;">Ubicación</div>
                          <div style="margin-top:4px;font-size:14px;color:#08130D;font-weight:500;line-height:1.5;">${address}<br>${barrio}, ${province}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <a href="${adminUrl}" style="display:inline-block;padding:16px 32px;background:#35AF6D;color:#FFFFFF;font-size:15px;font-weight:700;border-radius:12px;text-decoration:none;letter-spacing:-0.2px;box-shadow:0 4px 16px -4px rgba(53,175,109,0.4);transition:background 0.2s;">
                      Revisar en el panel
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px 32px;background:#F8FDF9;border-top:1px solid rgba(8,19,13,0.04);">
              <p style="margin:0 0 8px;font-size:12px;color:#94A39B;text-align:center;">
                Aviso automático del panel de administración de La Verde
              </p>
              <p style="margin:0;font-size:12px;color:#94A39B;text-align:center;">
                <a href="${adminUrl}" style="color:#35AF6D;text-decoration:underline;">Administrar solicitudes →</a>
              </p>
            </td          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Plantilla de email para notificación genérica a admins.
 */
export function adminNoticeHtml(
  heading: string,
  rows: [string, string][],
  body?: string,
): string {
  const rowHtml = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:12px 0;color:#5B6B62;font-size:13px;width:140px;font-weight:500;">${label}</td><td style="padding:12px 0;color:#08130D;font-size:14px;font-weight:600;">${value}</td></tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${heading} - La Verde</title>
</head>
<body style="margin:0;padding:0;background:#F6F3EC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;line-height:1.5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F6F3EC;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#FFFFFF;border-radius:20px;border:1px solid rgba(8,19,13,0.06);overflow:hidden;">
          <tr>
            <td style="padding:32px 32px 20px;background:linear-gradient(135deg,#35AF6D 0%,#2D9B5E 100%);">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="width:44px;height:44px;border-radius:12px;background:#FFFFFF;text-align:center;vertical-align:middle;">
                    <span style="display:inline-block;line-height:44px;font-size:18px;font-weight:800;color:#35AF6D;letter-spacing:-0.5px;">LV</span>
                  </td>
                  <td style="padding-left:14px;color:#FFFFFF;">
                    <div style="font-size:16px;font-weight:700;">La Verde</div>
                    <div style="font-size:12px;opacity:0.9;margin-top:1px;">Administración</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px;">
              <h1 style="margin:0 0 10px;font-size:20px;font-weight:700;color:#08130D;">${heading}</h1>
              ${body ? `<p style="margin:0 0 20px;color:#5B6B62;font-size:14px;line-height:1.6;">${body}</p>` : ""}
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F8FDF9;border-radius:12px;border:1px solid rgba(53,175,109,0.1);">
                <tr><td style="padding:20px;">${rowHtml}</td></tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 28px;background:#F8FDF9;border-top:1px solid rgba(8,19,13,0.04);">
              <p style="margin:0;font-size:12px;color:#94A39B;text-align:center;">Aviso automático del panel de administración de La Verde</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Aviso a los administradores. No lanza: el fallo se registra y sigue. */
export async function notifyAdmins(input: {
  subject: string;
  heading: string;
  rows: [string, string][];
  body?: string;
}): Promise<void> {
  const recipients = adminRecipients();
  if (recipients.length === 0) {
    console.warn(
      "[email] Sin destinatarios de administración para:",
      input.subject,
    );
    return;
  }
  await sendEmail({
    to: recipients,
    subject: input.subject,
    html: adminNoticeHtml(input.heading, input.rows, input.body),
  });
}

/** Notifica a admins sobre nueva solicitud de negocio con plantilla rica. */
export async function notifyAdminsBusinessSubmission(input: {
  businessName: string;
  category: string;
  ownerName: string;
  ownerEmail: string;
  plan: string;
  address: string;
  barrio: string;
  province: string;
}): Promise<void> {
  const recipients = adminRecipients();
  if (recipients.length === 0) {
    console.warn(
      "[email] Sin destinatarios de administración para nueva solicitud",
    );
    return;
  }

  const adminUrl = `${process.env.NEXT_PUBLIC_APP_URL}/admin/solicitudes`;

  await sendEmail({
    to: recipients,
    subject: `[La Verde] Nueva solicitud: ${input.businessName}`,
    html: businessSubmissionEmailHtml({ ...input, adminUrl }),
  });
}

/** Notifica al propietario que su negocio fue aprobado. */
export async function notifyOwnerBusinessApproved(input: {
  ownerEmail: string;
  businessName: string;
  placeUrl: string;
}): Promise<void> {
  if (!input.ownerEmail) return;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Negocio aprobado - La Verde</title>
</head>
<body style="margin:0;padding:0;background:#F6F3EC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;line-height:1.5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F6F3EC;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#FFFFFF;border-radius:20px;border:1px solid rgba(8,19,13,0.06);overflow:hidden;">
          <tr>
            <td style="padding:36px 32px 24px;background:linear-gradient(135deg,#35AF6D 0%,#2D9B5E 100%);">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="width:48px;height:48px;border-radius:14px;background:#FFFFFF;text-align:center;vertical-align:middle;">
                    <span style="display:inline-block;line-height:48px;font-size:20px;font-weight:800;color:#35AF6D;letter-spacing:-0.5px;">LV</span>
                  </td>
                  <td style="padding-left:16px;color:#FFFFFF;">
                    <div style="font-size:18px;font-weight:700;letter-spacing:-0.3px;">La Verde</div>
                    <div style="font-size:13px;opacity:0.9;margin-top:2px;">Tu negocio está publicado</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 32px;">
              <div style="text-align:center;margin-bottom:24px;">
                <div style="width:72px;height:72px;border-radius:50%;background:#EAF7EF;display:inline-flex;align-items:center;justify-content:center;font-size:32px;">✓</div>
              </div>
              <h1 style="margin:0 0 12px;font-size:24px;font-weight:700;color:#08130D;text-align:center;letter-spacing:-0.5px;">
                ¡Tu negocio fue aprobado!
              </h1>
              <p style="margin:0 0 8px;font-size:15px;color:#5B6B62;text-align:center;line-height:1.6;">
                <strong>${input.businessName}</strong> ya está visible en La Verde.
              </p>
              <p style="margin:0 0 28px;font-size:15px;color:#5B6B62;text-align:center;line-height:1.6;">
                Los usuarios ya pueden encontrarlo, ver su información y guardarlo.
              </p>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <a href="${input.placeUrl}" style="display:inline-block;padding:16px 32px;background:#35AF6D;color:#FFFFFF;font-size:15px;font-weight:700;border-radius:12px;text-decoration:none;letter-spacing:-0.2px;box-shadow:0 4px 16px -4px rgba(53,175,109,0.4);">
                      Ver mi negocio en La Verde
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 32px;background:#F8FDF9;border-top:1px solid rgba(8,19,13,0.04);">
              <p style="margin:0;font-size:12px;color:#94A39B;text-align:center;">
                Gracias por confiar en La Verde para mostrar tu negocio.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  await sendEmail({
    to: [input.ownerEmail],
    subject: `✅ Tu negocio "${input.businessName}" fue aprobado en La Verde`,
    html,
  });
}

/** Notifica al propietario que su negocio fue rechazado. */
export async function notifyOwnerBusinessRejected(input: {
  ownerEmail: string;
  businessName: string;
  reason?: string;
  resubmitUrl: string;
}): Promise<void> {
  if (!input.ownerEmail) return;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Negocio no aprobado - La Verde</title>
</head>
<body style="margin:0;padding:0;background:#F6F3EC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;line-height:1.5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F6F3EC;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#FFFFFF;border-radius:20px;border:1px solid rgba(8,19,13,0.06);overflow:hidden;">
          <tr>
            <td style="padding:36px 32px 24px;background:linear-gradient(135deg,#E85D5D 0%,#C94242 100%);">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="width:48px;height:48px;border-radius:14px;background:#FFFFFF;text-align:center;vertical-align:middle;">
                    <span style="display:inline-block;line-height:48px;font-size:20px;font-weight:800;color:#E85D5D;letter-spacing:-0.5px;">LV</span>
                  </td>
                  <td style="padding-left:16px;color:#FFFFFF;">
                    <div style="font-size:18px;font-weight:700;letter-spacing:-0.3px;">La Verde</div>
                    <div style="font-size:13px;opacity:0.9;margin-top:2px;">Actualización de tu solicitud</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 32px;">
              <div style="text-align:center;margin-bottom:24px;">
                <div style="width:72px;height:72px;border-radius:50%;background:#FEF0F0;display:inline-flex;align-items:center;justify-content:center;font-size:32px;">✕</div>
              </div>
              <h1 style="margin:0 0 12px;font-size:24px;font-weight:700;color:#08130D;text-align:center;letter-spacing:-0.5px;">
                Tu solicitud no fue aprobada
              </h1>
              <p style="margin:0 0 8px;font-size:15px;color:#5B6B62;text-align:center;line-height:1.6;">
                Revisamos <strong>${input.businessName}</strong> y no pudimos publicarlo esta vez.
              </p>
              ${
                input.reason
                  ? `
              <div style="background:#FEF0F0;border:1px solid rgba(232,93,93,0.2);border-radius:12px;padding:20px;margin:24px 0;">
                <div style="font-size:12px;color:#94A39B;text-transform:uppercase;letter-spacing:0.8px;font-weight:600;margin-bottom:8px;">Motivo</div>
                <div style="font-size:14px;color:#C94242;line-height:1.6;">${input.reason}</div>
              </div>
              `
                  : ""
              }
              <p style="margin:0 0 28px;font-size:15px;color:#5B6B62;text-align:center;line-height:1.6;">
                Puedes corregir la información y enviarla de nuevo cuando quieras.
              </p>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <a href="${input.resubmitUrl}" style="display:inline-block;padding:16px 32px;background:#35AF6D;color:#FFFFFF;font-size:15px;font-weight:700;border-radius:12px;text-decoration:none;letter-spacing:-0.2px;box-shadow:0 4px 16px -4px rgba(53,175,109,0.4);">
                      Corregir y reenviar
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 32px;background:#F8FDF9;border-top:1px solid rgba(8,19,13,0.04);">
              <p style="margin:0;font-size:12px;color:#94A39B;text-align:center;">
                Estamos para ayudarte. Si tienes dudas, responde a este correo.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  await sendEmail({
    to: [input.ownerEmail],
    subject: `❌ Tu solicitud "${input.businessName}" no fue aprobada`,
    html,
  });
}
