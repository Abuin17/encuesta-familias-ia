import postgres from "postgres";
import { createHash, randomInt } from "node:crypto";

// Conexion unica por instancia. En Supabase usar la cadena del "Transaction pooler" (puerto 6543).
const url = process.env.DATABASE_URL;
let cliente: ReturnType<typeof postgres> | null = null;

export function db() {
  if (!url) throw new Error("Falta DATABASE_URL");
  if (!cliente) {
    const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
    cliente = postgres(url, { prepare: false, max: 1, idle_timeout: 20, ssl: local ? false : "require" });
  }
  return cliente;
}

export const CANALES = { examia: 1, redes: 2 } as const;

export function semanaDeCampo(ahora = new Date()): number {
  const inicio = process.env.CAMPO_INICIO ? new Date(`${process.env.CAMPO_INICIO}T00:00:00Z`) : null;
  if (!inicio || Number.isNaN(inicio.getTime())) return 1;
  const s = Math.floor((ahora.getTime() - inicio.getTime()) / (7 * 24 * 3600 * 1000)) + 1;
  return Math.min(52, Math.max(1, s));
}

export function normalizarCodigo(codigo: string): string {
  return codigo.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function hashCodigo(codigo: string): string {
  return createHash("sha256").update(normalizarCodigo(codigo)).digest("hex");
}

export function ordenAleatorio(): 1 | 2 {
  return randomInt(2) === 0 ? 1 : 2;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function esUuid(x: unknown): x is string {
  return typeof x === "string" && UUID.test(x);
}

// Lee el cuerpo JSON con un limite de tamano. No se registra nada de la peticion.
export async function leerJson(req: Request, max = 16_000): Promise<Record<string, unknown> | null> {
  const texto = await req.text();
  if (texto.length > max) return null;
  try {
    const j = JSON.parse(texto);
    return j && typeof j === "object" && !Array.isArray(j) ? j : null;
  } catch {
    return null;
  }
}

export function respuesta(cuerpo: unknown, status = 200) {
  return Response.json(cuerpo, { status, headers: { "Cache-Control": "no-store" } });
}
