import crypto from "node:crypto";

// Notificaciones de la waitlist, sin dependencias externas.
// - Telegram: fetch nativo a la API del bot.
// - Google Sheets: cuenta de servicio con JWT (RS256) hecho con node:crypto + fetch.
// Si falta configuración (env), la función no hace nada: la app sigue funcionando.

export interface Cupo {
  nombre: string;
  telefono: string;
  tipo: "usuario" | "negocio";
  source: string;
  ts: number;
}

// ---------- Telegram ----------

export async function notifyTelegram(registro: Cupo): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const esNegocio = registro.tipo === "negocio";
  const emoji = esNegocio ? "🔵" : "🟢";
  const etiqueta = esNegocio ? "TENGO UN NEGOCIO" : "USUARIO";
  const fecha = new Date(registro.ts).toLocaleString("es-CU");

  const texto = [
    `${emoji} Nueva solicitud de cupo · ${etiqueta}`,
    `Nombre: ${registro.nombre}`,
    `Teléfono: ${registro.telefono}`,
    `Fecha: ${fecha}`
  ].join("\n");

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: /^\d+$/.test(chatId) ? Number(chatId) : chatId,
      text: texto,
      disable_web_page_preview: true
    })
  });
  if (!res.ok) throw new Error(`telegram ${res.status}`);
}

// ---------- Google Sheets (cuenta de servicio, sin googleapis) ----------

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

function b64url(data: string): string {
  return Buffer.from(data, "utf8").toString("base64url");
}

// Construye y firma un JWT RS256 con la clave privada de la cuenta de servicio.
function createJwt(account: ServiceAccount): string {
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const claims = b64url(
    JSON.stringify({
      iss: account.client_email,
      scope: "https://www.googleapis.com/auth/spreadsheets",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600
    })
  );
  const input = `${header}.${claims}`;
  const signature = crypto
    .createSign("RSA-SHA256")
    .update(input)
    .sign(account.private_key)
    .toString("base64url");
  return `${input}.${signature}`;
}

async function getAccessToken(account: ServiceAccount): Promise<string> {
  const jwt = createJwt(account);
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: jwt
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString()
  });
  if (!res.ok) throw new Error(`oauth ${res.status}`);
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("oauth no token");
  return data.access_token;
}

export async function notifySheet(registro: Cupo): Promise<void> {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const sheetId = process.env.WAITLIST_SPREADSHEET_ID;
  if (!raw || !sheetId) return;

  const account = JSON.parse(raw) as ServiceAccount;
  const token = await getAccessToken(account);

  const range = process.env.WAITLIST_SHEET_RANGE || "Cupos!A:E";
  const fechaIso = new Date(registro.ts).toISOString();
  const url =
    "https://sheets.googleapis.com/v4/spreadsheets/" +
    encodeURIComponent(sheetId) +
    "/values/" +
    encodeURIComponent(range) +
    ":append?valueInputOption=RAW";

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      values: [[registro.nombre, registro.telefono, registro.tipo, registro.source, fechaIso]]
    })
  });
  if (!res.ok) throw new Error(`sheets ${res.status}`);
}

// Lanza ambas en paralelo; si una falla, la otra no se ve afectada.
export async function notificarTodo(registro: Cupo): Promise<void> {
  await Promise.allSettled([notifyTelegram(registro), notifySheet(registro)]);
}