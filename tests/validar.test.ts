import { test } from "node:test";
import assert from "node:assert/strict";
import { validarBloque } from "../lib/validar.ts";
import { limpiarTexto } from "../lib/limpiar.ts";
import { BLOQUE_POR_ID, CCAA, CCAA_POR_PROVINCIA, PROVINCIAS, categoriaCuota } from "../lib/encuesta.ts";
import { anonimizar } from "../scripts/exportar.ts";

const BASE_A = { A3: "13-15", A4: "chica", A6: "publico", A8: "madre", A9: "35-44", A10: "univ", A11: "semanal", A12: "0" };

test("limpia email, telefono, enlace y nombres", () => {
  const t = limpiarTexto("Mi hijo Pablo copió con ChatGPT. Escribidme a ana@gmail.com o al 600 123 456, ver www.x.com");
  assert.ok(!t.includes("Pablo"), t);
  assert.ok(t.includes("ChatGPT"), t);
  assert.ok(t.includes("[email]") && t.includes("[telefono]") && t.includes("[enlace]"), t);
});

test("colegio con nombre propio se borra", () => {
  const t = limpiarTexto("En el colegio San Agustín le pillaron");
  assert.ok(!t.includes("Agustín"), t);
});

test("bloque A valido y salto de A13", () => {
  const base = { A3: "13-15", A4: "chica", A6: "publico", A7: "28", A8: "madre", A9: "35-44", A10: "univ", A11: "semanal" };
  assert.equal(validarBloque("A", { ...base, A12: "0" }).ok, true);
  assert.equal(validarBloque("A", { ...base, A12: "1-50" }).ok, false, "falta A13");
  const r = validarBloque("A", { ...base, A12: "0", A13: ["idiomas"], extra: "ip" });
  assert.equal(r.ok, true);
  if (r.ok) { assert.equal(r.datos.A13, undefined); assert.equal((r.datos as any).extra, undefined); }
});

test("exclusiva y maximos", () => {
  const b = { B1: "no", B2: "semanal", B3: ["ns", "chatgpt"], B4: ["buscar"], B5: "nunca", B6: 3, B7: "ns", B8: "nunca", B9: "1-2" };
  assert.equal(validarBloque("B", b).ok, false);
  assert.equal(validarBloque("B", { ...b, B3: ["ns"] }).ok, true);
  assert.equal(validarBloque("B", { ...b, B6: 9 }).ok, false);
  const e = { E1: "ns", E2: ["prensa"], E3: "yo", E4: ["estudiar", "crear", "detectar"] };
  assert.equal(validarBloque("E", e).ok, false);
});

test("orden C2 y texto opcional", () => {
  const c = { C1: 7, C2: ["trampa", "no_piense"], C3: "si", C4: ["notas"], C6: "4", C7: "-1" };
  const r = validarBloque("C", c);
  assert.equal(r.ok, true);
  assert.equal(validarBloque("C", { ...c, C2: ["nada", "trampa"] }).ok, false);
});

test("hay exactamente las 52 provincias, sin repetir y todas con comunidad", () => {
  assert.equal(PROVINCIAS.length, 52);
  assert.equal(new Set(PROVINCIAS.map((p) => p.v)).size, 52);
  assert.deepEqual([...PROVINCIAS.map((p) => p.v)].sort(), Array.from({ length: 52 }, (_, i) => String(i + 1).padStart(2, "0")));
  for (const p of PROVINCIAS) assert.ok(p.ccaa in CCAA, `${p.t} sin comunidad valida`);
  assert.equal(Object.keys(CCAA).length, 19);
  for (const c of Object.keys(CCAA)) assert.ok(PROVINCIAS.some((p) => p.ccaa === c), `${c} sin provincias`);
});

test("A7 acepta cualquier provincia y rechaza lo demas", () => {
  for (const p of PROVINCIAS) assert.equal(validarBloque("A", { ...BASE_A, A7: p.v }).ok, true, p.t);
  for (const malo of ["madrid", "norte", "53", "0", "", "28 ", undefined]) {
    assert.equal(validarBloque("A", { ...BASE_A, A7: malo }).ok, false, String(malo));
  }
  const opciones = BLOQUE_POR_ID.A.preguntas.find((p) => p.id === "A7")!.opciones!;
  assert.equal(opciones.length, 52);
  assert.ok(opciones.every((o) => o.grupo));
});

test("la cuota de zona sigue usando las 6 macrozonas de la base de datos", () => {
  const esperado: Record<string, string> = { "28": "madrid", "41": "andalucia", "08": "cataluna", "46": "valencia", "50": "norte", "15": "norte", "48": "norte", "47": "norte", "45": "resto", "35": "resto", "07": "resto", "51": "resto", "52": "resto", "30": "resto" };
  for (const [prov, zona] of Object.entries(esperado)) assert.equal(categoriaCuota("A7", { A7: prov }), zona, prov);
  const validas = new Set(["madrid", "andalucia", "cataluna", "valencia", "norte", "resto"]);
  for (const p of PROVINCIAS) assert.ok(validas.has(categoriaCuota("A7", { A7: p.v })), p.t);
  assert.equal(categoriaCuota("A3", { A3: "8-12" }), "8-12");
  assert.equal(CCAA_POR_PROVINCIA["28"], "madrid");
});

test("k-anonimato: las provincias sueltas se agrupan por comunidad", () => {
  const fila = (A7: string) => ({ A7, A3: "13-15", A4: "chica", A6: "publico" });
  const andaluzas = ["04", "11", "14", "18", "21", "23"].map(fila); // 6 provincias distintas, 1 respuesta cada una
  const { filas, informe } = anonimizar(andaluzas);
  assert.ok(filas.every((f) => f.A7 === "andalucia"), JSON.stringify(filas.map((f) => f.A7)));
  assert.ok(informe.some((l) => l.includes("A7")));
  const madrilenas = Array.from({ length: 6 }, () => fila("28")); // ya cumplen k: no se toca
  assert.ok(anonimizar(madrilenas).filas.every((f) => f.A7 === "28"));
});
