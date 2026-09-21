// Simulacion contra un servidor en marcha (local o de pruebas). NO usar contra produccion:
// crea respuestas sinteticas.
// Uso: BASE=http://localhost:3100 N=2000 node --experimental-strip-types tests/simulacion.ts [codigo1 codigo2 ...]
import { BLOQUES, visible, type Pregunta, type Respuestas } from "../lib/encuesta.ts";

const BASE = process.env.BASE ?? "http://localhost:3100";
const N = Number(process.env.N ?? 200);
const codigos = process.argv.slice(2);

const azar = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

function responder(p: Pregunta): string | string[] | number | undefined {
  const ops = (p.opciones ?? []).map((o) => o);
  switch (p.tipo) {
    case "unica":
    case "lista": return azar(ops).v;
    case "escala": return (p.min ?? 0) + Math.floor(Math.random() * ((p.max ?? 10) - (p.min ?? 0) + 1));
    case "texto": return Math.random() < 0.5 ? "Mi hijo Pablo copió un trabajo con ChatGPT, llamadme al 600123456" : undefined;
    case "multiple":
    case "orden": {
      const normales = ops.filter((o) => !o.exclusiva);
      if (Math.random() < 0.1 && ops.some((o) => o.exclusiva)) return [ops.find((o) => o.exclusiva)!.v];
      const k = 1 + Math.floor(Math.random() * Math.min(p.maxSel ?? 3, normales.length));
      return [...normales].sort(() => Math.random() - 0.5).slice(0, k).map((o) => o.v);
    }
  }
}

function rellenar(bloqueId: string): Respuestas {
  const b = BLOQUES.find((x) => x.id === bloqueId)!;
  const r: Respuestas = {};
  for (const p of b.preguntas) {
    if (!visible(p, r)) continue;
    const v = responder(p);
    if (v !== undefined) r[p.id] = v;
  }
  if (bloqueId === "C") r.C6 = Math.random() < 0.95 ? "4" : "2";
  return r;
}

async function post(ruta: string, cuerpo: unknown) {
  const r = await fetch(BASE + ruta, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
  return { status: r.status, json: await r.json().catch(() => ({})) as Record<string, unknown> };
}

let completas = 0, cerradas = 0, abandonos = 0, errores = 0;
async function uno(i: number) {
  const codigo = codigos[i];
  const s = await post("/api/start", codigo ? { canal: "examia", codigo } : { canal: "redes" });
  if (s.status !== 200) { errores++; return; }
  const id = s.json.id as string;
  const orden = s.json.ordenCD === 2 ? ["B", "D", "C", "E"] : ["B", "C", "D", "E"];
  const f = await post("/api/filtro", { id, datos: rellenar("A") });
  if (f.json.cerrada) { cerradas++; return; }
  if (f.status !== 200) { errores++; console.error("filtro", f); return; }
  for (const b of orden) {
    if (Math.random() < 0.03) { abandonos++; return; }
    const r = await post("/api/bloque", { id, bloque: b, datos: rellenar(b) });
    if (r.status !== 200) { errores++; console.error(b, r); return; }
  }
  const fin = await post("/api/fin", { id, duracion: 300 + Math.random() * 600 });
  if (fin.status !== 200) { errores++; return; }
  completas++;
}

const LOTE = 20;
for (let i = 0; i < N; i += LOTE) {
  await Promise.all(Array.from({ length: Math.min(LOTE, N - i) }, (_, j) => uno(i + j)));
}
console.log(JSON.stringify({ N, completas, cerradas, abandonos, errores }));
