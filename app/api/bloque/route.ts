import { db, esUuid, leerJson, respuesta } from "../../../lib/servidor.ts";
import { validarBloque } from "../../../lib/validar.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BLOQUES = new Set(["B", "C", "D", "E"]);

// Guarda un bloque al terminarlo, para poder medir en que bloque abandona la gente.
export async function POST(req: Request) {
  const j = await leerJson(req);
  if (!j || !esUuid(j.id)) return respuesta({ error: "id" }, 400);
  const bloque = j.bloque;
  if (typeof bloque !== "string" || !BLOQUES.has(bloque)) return respuesta({ error: "bloque" }, 400);
  const v = validarBloque(bloque, j.datos);
  if (!v.ok) return respuesta({ error: v.error }, 400);

  const sql = db();
  const r = await sql`
    update respuestas
    set datos = datos || jsonb_build_object(${bloque}::text, ${sql.json(v.datos)}::jsonb)
    where id = ${j.id} and filtrada = true and completa = false
    returning 1`;
  if (r.length === 0) return respuesta({ error: "estado" }, 409);
  return respuesta({ ok: true });
}
