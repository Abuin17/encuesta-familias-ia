import { DIMENSIONES_CUOTA } from "../../../lib/encuesta.ts";
import { db, esUuid, leerJson, respuesta } from "../../../lib/servidor.ts";
import { validarBloque } from "../../../lib/validar.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Guarda el bloque A y comprueba las cuotas. Si el perfil ya esta cubierto,
// se borra la respuesta vacia y solo se suma 1 al contador de cuota llena.
export async function POST(req: Request) {
  const j = await leerJson(req);
  if (!j || !esUuid(j.id)) return respuesta({ error: "id" }, 400);
  const v = validarBloque("A", j.datos);
  if (!v.ok) return respuesta({ error: v.error }, 400);

  const sql = db();
  const [fila] = await sql`select canal from respuestas where id = ${j.id} and filtrada = false and completa = false`;
  if (!fila) return respuesta({ error: "estado" }, 409);

  const pares: [string, string][] = DIMENSIONES_CUOTA.map((d) => [d, String(v.datos[d])]);
  pares.push(["canal", String(fila.canal)]);
  const dims = pares.map((p) => p[0]);
  const cats = pares.map((p) => p[1]);
  const llenas = await sql`
    select 1 from cuotas c
    join unnest(${dims}::text[], ${cats}::text[]) as x(dimension, categoria)
      on c.dimension = x.dimension and c.categoria = x.categoria
    where c.actual >= c.objetivo
    limit 1`;

  if (llenas.length > 0) {
    await sql.begin(async (tx) => {
      await tx`delete from respuestas where id = ${j.id as string}`;
      await tx`update contadores set n = n + 1 where clave = 'cuota_llena'`;
    });
    return respuesta({ cerrada: true });
  }

  await sql`
    update respuestas
    set datos = datos || jsonb_build_object('A', ${sql.json(v.datos)}::jsonb), filtrada = true
    where id = ${j.id}`;
  return respuesta({ ok: true });
}
