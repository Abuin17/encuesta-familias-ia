import { DIMENSIONES_CUOTA, categoriaCuota } from "../../../lib/encuesta.ts";
import { db, esUuid, leerJson, respuesta } from "../../../lib/servidor.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Marca la respuesta como completa (si tiene todos los bloques) y suma a las cuotas.
export async function POST(req: Request) {
  const j = await leerJson(req, 500);
  if (!j || !esUuid(j.id)) return respuesta({ error: "id" }, 400);
  const bruta = typeof j.duracion === "number" && Number.isFinite(j.duracion) ? j.duracion : null;
  const duracion = bruta === null ? null : Math.min(86400, Math.max(0, Math.round(bruta / 10) * 10));
  const id = j.id;

  const hecho = await db().begin(async (tx) => {
    const [fila] = await tx`
      update respuestas set completa = true, duracion = ${duracion}
      where id = ${id} and filtrada = true and completa = false
        and datos ?& array['A','B','C','D','E']
      returning canal, datos->'A' as a`;
    if (!fila) return false;
    const a = fila.a as Record<string, unknown>;
    const pares: [string, string][] = DIMENSIONES_CUOTA.map((d) => [d, categoriaCuota(d, a)]);
    pares.push(["canal", String(fila.canal)]);
    for (const [dimension, categoria] of pares) {
      await tx`update cuotas set actual = actual + 1 where dimension = ${dimension} and categoria = ${categoria}`;
    }
    return true;
  });

  if (!hecho) return respuesta({ error: "estado" }, 409);
  return respuesta({ ok: true });
}
