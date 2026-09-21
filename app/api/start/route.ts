import { CANALES, db, hashCodigo, leerJson, ordenAleatorio, respuesta, semanaDeCampo } from "../../../lib/servidor.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Crea una respuesta vacia. En el canal EXAMIA exige un codigo de un solo uso,
// que se marca como usado sin quedar vinculado a la respuesta.
export async function POST(req: Request) {
  const j = await leerJson(req, 500);
  const canal = j?.canal === "examia" ? CANALES.examia : CANALES.redes;
  const sql = db();

  if (canal === CANALES.examia) {
    const codigo = typeof j?.codigo === "string" ? j.codigo : "";
    if (codigo.length < 4 || codigo.length > 20) return respuesta({ error: "codigo" }, 400);
    const usado = await sql`
      update codigos set usado = true
      where hash = ${hashCodigo(codigo)} and usado = false
      returning canal`;
    if (usado.length === 0) return respuesta({ error: "codigo" }, 400);
  }

  const ordenCD = ordenAleatorio();
  const [fila] = await sql`
    insert into respuestas (canal, semana, orden_cd)
    values (${canal}, ${semanaDeCampo()}, ${ordenCD})
    returning id`;
  return respuesta({ id: fila.id, ordenCD });
}
