import fs from "node:fs";
import path from "node:path";

export type WaitlistStatus = "nuevo" | "contactado" | "agregado";

export interface WaitlistOffer {
  text: string;
  expiry: string;
}

export interface WaitlistEntry {
  id: string;
  businessName: string;
  category: string;
  city: string;
  address: string;
  schedule: string;
  days: string[];
  payments: string[];
  description: string;
  offer: WaitlistOffer | null;
  contactName: string;
  phone: string;
  email: string;
  notes: string;
  status: WaitlistStatus;
  createdAt: number;
}

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "waitlist.json");

/** Caché en memoria (write-through): evita leer/parsear el archivo en cada request. */
let cachedWaitlist: WaitlistEntry[] | null = null;

export function readWaitlist(): WaitlistEntry[] {
  if (cachedWaitlist) return cachedWaitlist;
  let result: WaitlistEntry[] = [];
  try {
    if (!fs.existsSync(FILE)) {
      cachedWaitlist = result;
      return result;
    }
    const raw = fs.readFileSync(FILE, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      result = parsed.filter(
        (e) =>
          !!e &&
          typeof e.id === "string" &&
          typeof e.businessName === "string" &&
          typeof e.contactName === "string",
      ) as WaitlistEntry[];
    }
  } catch {
    result = [];
  }
  cachedWaitlist = result;
  return result;
}

export function writeWaitlist(entries: WaitlistEntry[]): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(entries, null, 2), "utf-8");
  cachedWaitlist = entries;
}

export function makeWaitlistId(): string {
  return `w-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
