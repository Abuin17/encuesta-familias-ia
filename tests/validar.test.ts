import { test } from "node:test";
import assert from "node:assert/strict";
import { validarBloque } from "../lib/validar.ts";
import { limpiarTexto } from "../lib/limpiar.ts";

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
  const base = { A3: "13-15", A4: "chica", A6: "publico", A7: "madrid", A8: "madre", A9: "35-44", A10: "univ", A11: "semanal" };
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
