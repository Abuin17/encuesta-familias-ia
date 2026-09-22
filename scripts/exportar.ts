// Exporta las respuestas completas a CSV, una columna por variable. Nunca se exporta el id interno.
//
// Dos modos:
//   node --experimental-strip-types scripts/exportar.ts            -> para compartir (por defecto)
//     Sin texto libre (C5) y con k-anonimato (k = 5) sobre zona, edad, sexo y tipo de centro:
//     si alguna combinacion tiene menos de 5 respuestas, se agrupan categorias y, como ultimo
//     recurso, se suprime la zona en esas filas.
//   node --experimental-strip-types scripts/exportar.ts --interno  -> solo para quien analiza
//     Todas las variables sin agrupar. No se comparte ni se sube a ningun sitio.
import { writeFileSync } from "node:fs";
import postgres from "postgres";
import { BLOQUES, ZONA_MACRO, type Respuestas } from "../lib/encuesta.ts";
import { libroCodigos } from "./libro-codigos.ts";

const K = 5;
const CUASI = ["A7", "A3", "A4", "A6"] as const; // lo que un tercero podria saber de una familia: zona, edad, sexo, centro

export type Fila = Record<string, string | number>;

export function aplanar(datos: Record<string, Respuestas>, meta: { canal: number; semana: number; orden_cd: number; duracion: number | null }): Fila {
  const f: Fila = {
    CANAL: meta.canal,
    SEMANA: meta.semana,
    ORDEN_CD: meta.orden_cd,
    DURACION: meta.duracion ?? "",
  };
  for (const b of BLOQUES) {
    const r = datos[b.id] ?? {};
    for (const p of b.preguntas) {
      const v = r[p.id];
      if (p.tipo === "multiple") {
        for (const o of p.opciones ?? []) f[`${p.id}_${o.v}`] = v === undefined ? "" : (v as string[]).includes(o.v) ? 1 : 0;
      } else if (p.tipo === "orden") {
        const lista = (v as string[] | undefined) ?? [];
        for (let i = 0; i < (p.maxSel ?? 3); i++) f[`${p.id}_${i + 1}`] = lista[i] ?? "";
        for (const o of p.opciones ?? []) {
          if (o.exclusiva) continue;
          const pos = lista.indexOf(o.v);
          f[`${p.id}_puntos_${o.v}`] = pos < 0 ? 0 : (p.maxSel ?? 3) - pos; // Borda: 3, 2, 1
        }
      } else {
        f[p.id] = v === undefined ? "" : (v as string | number);
      }
    }
  }
  // Derivadas del libro de codigos
  const B = datos.B ?? {};
  f.USO_SEMANAL = B.B2 === "semanal" || B.B2 === "diario" ? 1 : B.B2 === "ns" ? "" : 0;
  f.PAGA_EXTRA = datos.A?.A12 === "0" ? 0 : 1;
  f.ALARMA = datos.C?.C3 === "si" ? 1 : 0;
  f.ATENCION = datos.C?.C6 === "4" ? 1 : 0;
  f.NS_TOTAL = Object.values(B).filter((x) => x === "ns" || (Array.isArray(x) && x.includes("ns"))).length;
  return f;
}

// Generalizaciones sucesivas hasta cumplir k-anonimato.
// La zona (A7, codigo INE de comunidad 01-19) se agrupa en las 7 macrozonas NUTS1 de Eurostat: el mismo criterio
// oficial para las 19 comunidades. Si aun asi hay menos de k, el ultimo recurso es suprimir la zona.
const PASOS: { col: string; mapa: Record<string, string> }[] = [
  { col: "A7", mapa: ZONA_MACRO },
  { col: "A6", mapa: { publico: "publico", concertado: "concertado_privado", privado: "concertado_privado", ns: "ns" } },
];

function grupos(filas: Fila[]) {
  const m = new Map<string, number>();
  for (const f of filas) {
    const k = CUASI.map((c) => f[c]).join("|");
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

export function anonimizar(filas: Fila[]): { filas: Fila[]; informe: string[] } {
  const informe: string[] = [];
  let actual = filas.map((f) => ({ ...f }));
  for (const paso of PASOS) {
    const pequenos = [...grupos(actual).values()].filter((n) => n < K).length;
    if (pequenos === 0) break;
    informe.push(`${pequenos} combinaciones con menos de ${K}: se agrupa ${paso.col}`);
    actual = actual.map((f) => ({ ...f, [paso.col]: paso.mapa[String(f[paso.col])] ?? f[paso.col] }));
  }
  // Ultimo recurso: suprimir la zona en las filas que siguen siendo unicas.
  const g = grupos(actual);
  let suprimidas = 0;
  actual = actual.map((f) => {
    const k = CUASI.map((c) => f[c]).join("|");
    if ((g.get(k) ?? 0) < K) { suprimidas++; return { ...f, A7: "" }; }
    return f;
  });
  if (suprimidas) informe.push(`${suprimidas} filas con la zona suprimida por seguir siendo identificables`);
  if (informe.length === 0) informe.push(`Todas las combinaciones tienen al menos ${K} respuestas: sin cambios`);
  return { filas: actual, informe };
}

function csv(filas: Fila[]): string {
  if (filas.length === 0) return "";
  const cols = Object.keys(filas[0]);
  const esc = (x: unknown) => {
    const s = String(x ?? "");
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...filas.map((f) => cols.map((c) => esc(f[c])).join(","))].join("\n") + "\n";
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error("Falta DATABASE_URL"); process.exit(1); }
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  const sql = postgres(url, { prepare: false, max: 1, ssl: local ? false : "require" });
  const rows = await sql`select canal, semana, orden_cd, duracion, datos from respuestas where completa order by random()`;
  await sql.end();

  const interno = process.argv.includes("--interno");
  const planas = rows.map((r) => aplanar(r.datos as Record<string, Respuestas>, r as never));
  const fecha = new Date().toISOString().slice(0, 10);
  if (interno) {
    const fichero = `export-interno-${fecha}.csv`;
    writeFileSync(fichero, csv(planas.map(libroCodigos)));
    console.log(`${planas.length} respuestas completas en ${fichero}. USO INTERNO: no compartir ni subir a ningun sitio.`);
    console.log("PESO no se incluye: se calcula en el analisis final (raking), no en esta exportacion.");
    return;
  }
  const sinTexto = planas.map(({ C5: _c5, ...resto }) => resto as Fila);
  const { filas, informe } = anonimizar(sinTexto);
  const fichero = `export-compartir-${fecha}.csv`;
  writeFileSync(fichero, csv(filas.map(libroCodigos)));
  console.log(`${filas.length} respuestas completas exportadas a ${fichero} (sin texto libre)`);
  for (const l of informe) console.log(`k-anonimato: ${l}`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
