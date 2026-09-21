import { db, leerJson, respuesta } from "../../../lib/servidor.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PERMITIDAS = new Set(["no_apto", "sin_consentimiento"]);

// Suma 1 a un contador agregado. No guarda nada individual.
export async function POST(req: Request) {
  const j = await leerJson(req, 200);
  const clave = j?.clave;
  if (typeof clave !== "string" || !PERMITIDAS.has(clave)) return respuesta({ error: "clave" }, 400);
  await db()`update contadores set n = n + 1 where clave = ${clave}`;
  return respuesta({ ok: true });
}
