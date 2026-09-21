import { test } from "node:test";
import assert from "node:assert/strict";
import { validarBloque } from "../lib/validar.ts";
import { limpiarTexto } from "../lib/limpiar.ts";
import { BLOQUE_POR_ID, CCAA_INE, OPCIONES_CCAA, ZONA_MACRO, categoriaCuota, nombreNatural, zonaMacro } from "../lib/encuesta.ts";
import { readFileSync } from "node:fs";
import { anonimizar } from "../scripts/exportar.ts";

const INE = JSON.parse(readFileSync(new URL("./ine-2026.json", import.meta.url), "utf8"));
const NUTS = JSON.parse(readFileSync(new URL("./nuts-2024.json", import.meta.url), "utf8"));
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
  const base = { A3: "13-15", A4: "chica", A6: "publico", A7: "13", A8: "madre", A9: "35-44", A10: "univ", A11: "semanal" };
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

test("las 19 comunidades coinciden con la fuente oficial del INE (1 de enero de 2026)", () => {
  assert.equal(Object.keys(CCAA_INE).length, 19);
  assert.deepEqual(CCAA_INE, INE.comunidades);
  assert.deepEqual(Object.keys(CCAA_INE).sort(), Array.from({ length: 19 }, (_, i) => String(i + 1).padStart(2, "0")));
});

test("los nombres se muestran como se dicen, no invertidos como en el INE", () => {
  const esperado: Record<string, string> = {
    "Balears, Illes": "Illes Balears", "Rioja, La": "La Rioja", "Asturias, Principado de": "Principado de Asturias",
    "Madrid, Comunidad de": "Comunidad de Madrid", "Murcia, Región de": "Región de Murcia",
    "Navarra, Comunidad Foral de": "Comunidad Foral de Navarra", "Castilla - La Mancha": "Castilla-La Mancha",
    "Comunitat Valenciana": "Comunitat Valenciana", "Andalucía": "Andalucía",
  };
  for (const [ine, natural] of Object.entries(esperado)) assert.equal(nombreNatural(ine), natural);
  for (const o of OPCIONES_CCAA) assert.ok(!o.t.includes(","), `«${o.t}» conserva la coma del INE`);
});

test("A7 lista las 19 comunidades y ciudades autonomas, todas tratadas igual y sin agrupar", () => {
  const opciones = BLOQUE_POR_ID.A.preguntas.find((p) => p.id === "A7")!.opciones!;
  assert.equal(opciones.length, 19);
  assert.ok(opciones.every((o) => !o.grupo), "ninguna comunidad va bajo un encabezado");
  assert.equal(new Set(opciones.map((o) => o.t)).size, 19, "etiquetas repetidas");
  // Orden alfabetico segun el literal del INE (ignora tildes): cada una aparece bajo su nombre.
  assert.deepEqual(opciones.map((o) => o.t), [
    "Andalucía", "Aragón", "Principado de Asturias", "Illes Balears", "Canarias", "Cantabria", "Castilla-La Mancha",
    "Castilla y León", "Cataluña", "Ceuta", "Comunitat Valenciana", "Extremadura", "Galicia", "Comunidad de Madrid",
    "Melilla", "Región de Murcia", "Comunidad Foral de Navarra", "País Vasco", "La Rioja",
  ]);
  const literales = opciones.map((o) => CCAA_INE[o.v].normalize("NFD").replace(/\p{M}/gu, "").toLowerCase());
  assert.deepEqual(literales, [...literales].sort());
});

test("A7 acepta las 19 comunidades y rechaza lo demas", () => {
  for (const cod of Object.keys(CCAA_INE)) assert.equal(validarBloque("A", { ...BASE_A, A7: cod }).ok, true, CCAA_INE[cod]);
  for (const malo of ["madrid", "norte", "resto", "20", "00", "0", "", "13 ", "CA13", "28", undefined]) {
    assert.equal(validarBloque("A", { ...BASE_A, A7: malo }).ok, false, String(malo));
  }
});

// Correspondencia comunidad INE -> region NUTS2 de Eurostat (ES11 Galicia, ES12 Asturias...).
const NUTS2_DE_CCAA: Record<string, string> = {
  "01": "ES61", "02": "ES24", "03": "ES12", "04": "ES53", "05": "ES70", "06": "ES13", "07": "ES41", "08": "ES42", "09": "ES51",
  "10": "ES52", "11": "ES43", "12": "ES11", "13": "ES30", "14": "ES62", "15": "ES22", "16": "ES21", "17": "ES23", "18": "ES63", "19": "ES64",
};
const MACRO_DE_NUTS1: Record<string, string> = { ES1: "noroeste", ES2: "noreste", ES3: "madrid", ES4: "centro", ES5: "este", ES6: "sur", ES7: "canarias" };

test("las 7 macrozonas son las regiones NUTS1 oficiales de Eurostat, aplicadas igual a las 19 comunidades", () => {
  assert.deepEqual(Object.keys(NUTS.nuts1).sort(), Object.keys(MACRO_DE_NUTS1).sort());
  assert.equal(Object.keys(NUTS.nuts2).length, 19);
  assert.deepEqual(Object.keys(NUTS2_DE_CCAA).sort(), Object.keys(CCAA_INE).sort());
  for (const [cod, nuts2] of Object.entries(NUTS2_DE_CCAA)) {
    assert.ok(nuts2 in NUTS.nuts2, `${nuts2} no existe en NUTS`);
    // el nombre NUTS2 coincide con el de la comunidad (salvo «Ciudad de Ceuta/Melilla»)
    const nombre = NUTS.nuts2[nuts2].replace(/^Ciudad de /, "");
    assert.equal(nombre, nombreNatural(CCAA_INE[cod]), `${cod} ${CCAA_INE[cod]} vs ${NUTS.nuts2[nuts2]}`);
    assert.equal(ZONA_MACRO[cod], MACRO_DE_NUTS1[nuts2.slice(0, 3)], `${CCAA_INE[cod]}`);
  }
  assert.deepEqual(Object.keys(ZONA_MACRO).sort(), Object.keys(CCAA_INE).sort());
  assert.equal(new Set(Object.values(ZONA_MACRO)).size, 7);
});

test("la cuota de zona usa las 7 macrozonas y no rompe con valores raros", () => {
  const esperado: Record<string, string> = {
    "13": "madrid", "01": "sur", "09": "este", "10": "este", "04": "este", "03": "noroeste", "12": "noroeste",
    "16": "noreste", "17": "noreste", "07": "centro", "05": "canarias", "18": "sur", "19": "sur", "14": "sur",
  };
  for (const [cod, zona] of Object.entries(esperado)) assert.equal(categoriaCuota("A7", { A7: cod }), zona, cod);
  assert.equal(categoriaCuota("A3", { A3: "8-12" }), "8-12");
  assert.equal(zonaMacro("05"), "canarias");
});

test("k-anonimato: las comunidades sueltas se agrupan en su macrozona", () => {
  const fila = (A7: string) => ({ A7, A3: "13-15", A4: "chica", A6: "publico" });
  const noroeste = ["12", "03", "06", "12", "03"].map(fila); // Galicia, Asturias, Cantabria: ninguna llega a 5 sola
  const { filas, informe } = anonimizar(noroeste);
  assert.ok(filas.every((f) => f.A7 === "noroeste"), JSON.stringify(filas.map((f) => f.A7)));
  assert.ok(informe.some((l) => l.includes("A7")));
  const madrilenas = Array.from({ length: 6 }, () => fila("13")); // ya cumplen k: no se toca
  assert.ok(anonimizar(madrilenas).filas.every((f) => f.A7 === "13"));
  const sola = anonimizar([...Array.from({ length: 5 }, () => fila("13")), fila("05")]); // una canaria aislada: se suprime la zona
  assert.equal(sola.filas.filter((f) => f.A7 === "").length, 1);
});
