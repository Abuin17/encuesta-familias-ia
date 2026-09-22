import { test } from "node:test";
import assert from "node:assert/strict";
import { BLOQUE_POR_ID, CCAA_INE } from "../lib/encuesta.ts";
import { aplanar } from "../scripts/exportar.ts";
import { libroCodigos } from "../scripts/libro-codigos.ts";

// Recorre las 19 comunidades una vez, con un episodio en C3-C4-C5 y todos los bloques a valores validos,
// para que las preguntas condicionales (B1b, B3, B4, C4, C5) tambien pasen por el libro de codigos.
function respuestaBase(a7: string) {
  return {
    A: { A3: "13-15", A4: "chico", A6: "publico", A7: a7, A8: "madre", A9: "35-44", A10: "univ", A11: "semanal", A12: "1-50", A13: ["idiomas", "otra"] },
    B: { B1: "si", B1b: "10-11", B2: "semanal", B3: ["chatgpt", "gemini"], B4: ["buscar", "personal"], B5: "a_veces", B6: 3, B7: "permite", B8: "mensual", B9: "2-4" },
    C: { C1: 7, C2: ["dependencia", "trampa", "privacidad"], C3: "si", C4: ["personal", "otro"], C5: "cuenta algo", C6: "4", C7: "-1" },
    D: { D1: "ensenar", D2: ["hablar", "normas"], D3: 4, D4: 2, D5: "familia" },
    E: { E1: "mencion", E2: ["colegio", "expertos"], E3: "ambos", E4: ["estudiar", "crear"] },
  };
}
const META = { canal: 2, semana: 1, orden_cd: 1, duracion: 320 };

test("meta e identidad: CANAL, SEMANA, ORDEN_CD, DURACION y COMPLETA pasan igual", () => {
  const out = libroCodigos(aplanar(respuestaBase("28"), META));
  assert.deepEqual([out.CANAL, out.SEMANA, out.ORDEN_CD, out.DURACION, out.COMPLETA], [2, 1, 1, 320, 1]);
});

test("cada opcion real de cada pregunta de respuesta unica tiene un codigo (no cae en blanco por defecto)", () => {
  // Id de pregunta -> nombre de variable del libro de codigos, para las preguntas de tipo "unica".
  const VARIABLE: Record<string, string> = {
    A3: "EDAD_GRUPO", A4: "SEXO_H", A6: "TITULARIDAD", A8: "REL", A9: "EDAD_P", A10: "EDUC_P", A11: "USO_IA_P", A12: "GASTO_EXTRA",
    B1: "MOVIL_H", B1b: "EDAD_MOVIL_H", B2: "USO_IA_H", B5: "USO_FUERA", B7: "NORMA_CENTRO", B8: "LECTURA_H", B9: "PANTALLA_H",
    C7: "APRENDE", D1: "POSTURA", D5: "RESPONSABLE", E1: "FORM_COLEGIO", E3: "DECISOR",
  };
  for (const [qid, variable] of Object.entries(VARIABLE)) {
    const bid = qid[0] as "A" | "B" | "C" | "D" | "E";
    const pregunta = BLOQUE_POR_ID[bid].preguntas.find((p) => p.id === qid)!;
    for (const o of pregunta.opciones ?? []) {
      const base = respuestaBase("28");
      (base as any)[bid][qid] = o.v;
      const out = libroCodigos(aplanar(base, META));
      assert.notEqual(out[variable], "", `${qid}=${o.v} (${variable}) no tiene codigo asignado`);
      assert.equal(typeof out[variable], "number", `${qid}=${o.v} (${variable}) deberia ser numerico`);
    }
  }
});

test("no lo se se codifica siempre como 9, nunca como el punto medio de una escala", () => {
  const conNS = (bid: "A" | "B" | "C" | "D" | "E", qid: string, variable: string) => {
    const base: any = respuestaBase("28");
    base[bid][qid] = "ns";
    const out = libroCodigos(aplanar(base, META));
    assert.equal(out[variable], 9, `${qid} con "ns" deberia dar ${variable}=9`);
  };
  conNS("A", "A6", "TITULARIDAD"); conNS("B", "B2", "USO_IA_H"); conNS("B", "B5", "USO_FUERA");
  conNS("B", "B7", "NORMA_CENTRO"); conNS("B", "B8", "LECTURA_H"); conNS("B", "B9", "PANTALLA_H");
  conNS("D", "D1", "POSTURA"); conNS("E", "E1", "FORM_COLEGIO");
  const c7 = respuestaBase("28"); (c7 as any).C.C7 = "ns";
  assert.equal(libroCodigos(aplanar(c7, META)).APRENDE, 9);
});

test("una pregunta oculta por un salto se deja en blanco, no como si no se supiera", () => {
  const sinMovil = respuestaBase("28");
  (sinMovil as any).B.B1 = "no"; delete (sinMovil as any).B.B1b; delete (sinMovil as any).B.B3; delete (sinMovil as any).B.B4; delete (sinMovil as any).B.B5;
  const out = libroCodigos(aplanar(sinMovil, META));
  assert.equal(out.EDAD_MOVIL_H, "", "B1b oculta por B1=no deberia quedar en blanco");
  assert.equal(out.MOVIL_H, 0);
});

test("ZONA: comunidad (1-19), macrozona generalizada (20-26) y suprimida (99)", () => {
  for (const cod of Object.keys(CCAA_INE)) assert.equal(libroCodigos(aplanar(respuestaBase(cod), META)).ZONA, Number(cod), `comunidad ${cod}`);
  for (const [macro, codigo] of Object.entries({ noroeste: 20, noreste: 21, madrid: 22, centro: 23, este: 24, sur: 25, canarias: 26 })) {
    const f = aplanar(respuestaBase("28"), META); f.A7 = macro;
    assert.equal(libroCodigos(f).ZONA, codigo, macro);
  }
  const suprimida = aplanar(respuestaBase("28"), META); suprimida.A7 = "";
  assert.equal(libroCodigos(suprimida).ZONA, 99);
});

test("TITULARIDAD generalizada por k-anonimato (concertado/privado) da el codigo 4", () => {
  const f = aplanar(respuestaBase("28"), META); f.A6 = "concertado_privado";
  assert.equal(libroCodigos(f).TITULARIDAD, 4);
});

test("preguntas de opcion multiple: prefijo de columna con el codigo de la opcion como sufijo", () => {
  const out = libroCodigos(aplanar(respuestaBase("28"), META));
  assert.deepEqual([out.HERR_chatgpt, out.HERR_gemini, out.HERR_snapchat], [1, 1, 0]);
  assert.deepEqual([out.USOS_buscar, out.USOS_personal, out.USOS_traducir], [1, 1, 0]);
  assert.deepEqual([out.EPISODIO_personal, out.EPISODIO_otro, out.EPISODIO_notas], [1, 1, 0]);
  assert.deepEqual([out.ACCION_hablar, out.ACCION_normas, out.ACCION_control], [1, 1, 0]);
  assert.deepEqual([out.FUENTE_colegio, out.FUENTE_expertos, out.FUENTE_prensa], [1, 1, 0]);
  assert.deepEqual([out.META_estudiar, out.META_crear, out.META_nada], [1, 1, 0]);
  assert.deepEqual([out.EXTRA_idiomas, out.EXTRA_otra, out.EXTRA_deporte], [1, 1, 0]);
});

test("C2: PREOC_TOP1-3 con el codigo de la opcion, y PREOC_SCORE_* con la puntuacion Borda", () => {
  const out = libroCodigos(aplanar(respuestaBase("28"), META));
  assert.deepEqual([out.PREOC_TOP1, out.PREOC_TOP2, out.PREOC_TOP3], ["dependencia", "trampa", "privacidad"]);
  assert.deepEqual([out.PREOC_SCORE_dependencia, out.PREOC_SCORE_trampa, out.PREOC_SCORE_privacidad, out.PREOC_SCORE_falsa], [3, 2, 1, 0]);
});

test("escalas directas (PREOC, AUTOEFIC, COLEGIO) y derivadas ya calculadas pasan sin cambios", () => {
  const out = libroCodigos(aplanar(respuestaBase("28"), META));
  assert.deepEqual([out.PREOC, out.AUTOEFIC, out.COLEGIO], [7, 4, 2]);
  assert.equal(out.PAGA_EXTRA, 1);
  assert.equal(out.ALARMA, 1);
  assert.equal(out.ATENCION, 1);
  assert.equal(out.RELATO, "cuenta algo");
});

test("sin texto libre (exportacion para compartir), RELATO no aparece", () => {
  const { C5: _c5, ...sinTexto } = aplanar(respuestaBase("28"), META);
  assert.equal("RELATO" in libroCodigos(sinTexto), false);
});
