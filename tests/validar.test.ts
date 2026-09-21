import { test } from "node:test";
import assert from "node:assert/strict";
import { validarBloque } from "../lib/validar.ts";
import { limpiarTexto } from "../lib/limpiar.ts";
import { BLOQUE_POR_ID, CCAA_INE, CCAA_POR_PROVINCIA, OPCIONES_PROVINCIA, PROVINCIAS_INE, categoriaCuota, nombreNatural } from "../lib/encuesta.ts";
import { readFileSync } from "node:fs";
import { anonimizar } from "../scripts/exportar.ts";

const INE = JSON.parse(readFileSync(new URL("./ine-2026.json", import.meta.url), "utf8"));
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

test("la tabla de zonas coincide con la fuente oficial del INE (1 de enero de 2026)", () => {
  assert.equal(PROVINCIAS_INE.length, 52);
  assert.equal(Object.keys(CCAA_INE).length, 19);
  assert.deepEqual(CCAA_INE, INE.comunidades);
  assert.deepEqual(Object.fromEntries(PROVINCIAS_INE.map(([p, l]) => [p, l])), INE.provincias);
  assert.deepEqual(CCAA_POR_PROVINCIA, INE.asignacion);
  assert.deepEqual(PROVINCIAS_INE.map((p) => p[0]), Array.from({ length: 52 }, (_, i) => String(i + 1).padStart(2, "0")));
});

test("los nombres se muestran como se dicen, no invertidos como en el INE", () => {
  const esperado: Record<string, string> = {
    "Balears, Illes": "Illes Balears", "Coruña, A": "A Coruña", "Palmas, Las": "Las Palmas", "Rioja, La": "La Rioja",
    "Asturias, Principado de": "Principado de Asturias", "Madrid, Comunidad de": "Comunidad de Madrid",
    "Murcia, Región de": "Región de Murcia", "Navarra, Comunidad Foral de": "Comunidad Foral de Navarra",
    "Castilla - La Mancha": "Castilla-La Mancha", "Comunitat Valenciana": "Comunitat Valenciana",
    "Alicante/Alacant": "Alicante/Alacant", "Araba/Álava": "Araba/Álava",
  };
  for (const [ine, natural] of Object.entries(esperado)) assert.equal(nombreNatural(ine), natural);
  for (const o of OPCIONES_PROVINCIA) assert.ok(!o.t.includes(","), `«${o.t}» conserva la coma del INE`);
  for (const o of OPCIONES_PROVINCIA) assert.ok(!o.grupo?.includes(","), `grupo «${o.grupo}» conserva la coma del INE`);
});

test("el desplegable nunca repite el nombre: una comunidad de una sola provincia sale como una opcion suelta", () => {
  for (const o of OPCIONES_PROVINCIA) assert.notEqual(o.t, o.grupo, `${o.t} > ${o.grupo}`);
  const sueltas = OPCIONES_PROVINCIA.filter((o) => !o.grupo).map((o) => `${o.v} ${o.t}`);
  // Van en su sitio alfabetico segun el nombre corriente (Asturias, Baleares, Cantabria...), no por «Principado de...».
  assert.deepEqual(sueltas, [
    "33 Principado de Asturias", "07 Illes Balears", "39 Cantabria", "51 Ceuta", "28 Comunidad de Madrid",
    "52 Melilla", "30 Región de Murcia", "31 Comunidad Foral de Navarra", "26 La Rioja",
  ]);
  const grupos = [...new Set(OPCIONES_PROVINCIA.filter((o) => o.grupo).map((o) => o.grupo))];
  assert.deepEqual(grupos, ["Andalucía", "Aragón", "Canarias", "Castilla-La Mancha", "Castilla y León", "Cataluña",
    "Comunitat Valenciana", "Extremadura", "Galicia", "País Vasco"]);
  assert.equal(new Set(OPCIONES_PROVINCIA.map((o) => o.t)).size, 52 - 0, "etiquetas repetidas");
  const enCanarias = OPCIONES_PROVINCIA.filter((o) => o.grupo === "Canarias").map((o) => o.t);
  assert.deepEqual(enCanarias, ["Las Palmas", "Santa Cruz de Tenerife"]);
  const enGalicia = OPCIONES_PROVINCIA.filter((o) => o.grupo === "Galicia").map((o) => o.t);
  assert.deepEqual(enGalicia, ["A Coruña", "Lugo", "Ourense", "Pontevedra"]);
  const enCyL = OPCIONES_PROVINCIA.filter((o) => o.grupo === "Castilla y León").map((o) => o.t);
  assert.equal(enCyL[0], "Ávila");
});

test("A7 acepta cualquier provincia y rechaza lo demas", () => {
  for (const [v, l] of PROVINCIAS_INE) assert.equal(validarBloque("A", { ...BASE_A, A7: v }).ok, true, l);
  for (const malo of ["madrid", "norte", "53", "0", "", "28 ", "CA13", undefined]) {
    assert.equal(validarBloque("A", { ...BASE_A, A7: malo }).ok, false, String(malo));
  }
  const opciones = BLOQUE_POR_ID.A.preguntas.find((p) => p.id === "A7")!.opciones!;
  assert.equal(opciones.length, 52);
});

test("la cuota de zona sigue usando las 6 macrozonas de la base de datos", () => {
  const esperado: Record<string, string> = { "28": "madrid", "41": "andalucia", "08": "cataluna", "46": "valencia", "50": "norte", "15": "norte", "48": "norte", "47": "norte", "45": "resto", "35": "resto", "07": "resto", "51": "resto", "52": "resto", "30": "resto" };
  for (const [prov, zona] of Object.entries(esperado)) assert.equal(categoriaCuota("A7", { A7: prov }), zona, prov);
  const validas = new Set(["madrid", "andalucia", "cataluna", "valencia", "norte", "resto"]);
  for (const [v, l] of PROVINCIAS_INE) assert.ok(validas.has(categoriaCuota("A7", { A7: v })), l);
  assert.equal(categoriaCuota("A3", { A3: "8-12" }), "8-12");
});

test("k-anonimato: las provincias sueltas se agrupan por comunidad", () => {
  const fila = (A7: string) => ({ A7, A3: "13-15", A4: "chica", A6: "publico" });
  const andaluzas = ["04", "11", "14", "18", "21", "23"].map(fila); // 6 provincias distintas, 1 respuesta cada una
  const { filas, informe } = anonimizar(andaluzas);
  assert.ok(filas.every((f) => f.A7 === "CA01"), JSON.stringify(filas.map((f) => f.A7)));
  assert.ok(informe.some((l) => l.includes("A7")));
  const madrilenas = Array.from({ length: 6 }, () => fila("28")); // ya cumplen k: no se toca
  assert.ok(anonimizar(madrilenas).filas.every((f) => f.A7 === "28"));
  const varias = ["15", "27", "32", "36", "33", "39"].map(fila); // Galicia (4), Asturias, Cantabria: se agrupan en "otras"
  assert.ok(anonimizar(varias).filas.every((f) => ["CA12", "otras"].includes(String(f.A7))));
});
