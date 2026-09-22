// Libro de códigos: traduce las respuestas ya aplanadas (identificador de pregunta -> valor de la
// opción) a las variables y codificaciones numéricas del documento de diseño ("Encuesta a familias:
// IA y adolescentes"). Se aplica solo al exportar (scripts/exportar.ts); en la base de datos se
// guarda siempre el valor original de cada opción, nunca el código numérico.
//
// Convención del documento: "no lo sé" se codifica siempre como 9 y nunca se trata como el punto
// medio de una escala. Una pregunta oculta por un salto, o una opcional sin contestar, se deja en
// blanco: no es lo mismo no saber algo que la pregunta no aplicar.
//
// PESO (la ponderación final por raking) no se calcula aquí: es un paso del análisis final, una vez
// cerrado el campo, no de cada exportación intermedia.
import { BLOQUES, CCAA_INE, type Pregunta } from "../lib/encuesta.ts";
import type { Fila } from "./exportar.ts";

const PREGUNTA_POR_ID: Record<string, Pregunta> = Object.fromEntries(BLOQUES.flatMap((b) => b.preguntas.map((p) => [p.id, p])));

type Mapa = Record<string, number>;

// [nombre de la variable, valor de la opción -> código] para las preguntas de respuesta única.
const UNICA: Record<string, [string, Mapa]> = {
  A3: ["EDAD_GRUPO", { "8-12": 1, "13-15": 2, "16-17": 3 }],
  A4: ["SEXO_H", { chico: 1, chica: 2, nc: 9 }],
  // 4: generalizado por el k-anonimato de la exportación para compartir (concertada o privada, sin distinguir). No está en el documento original.
  A6: ["TITULARIDAD", { publico: 1, concertado: 2, privado: 3, ns: 9, concertado_privado: 4 }],
  A8: ["REL", { madre: 1, padre: 2, otro: 3 }],
  A9: ["EDAD_P", { "<35": 1, "35-44": 2, "45-54": 3, "55+": 4 }],
  A10: ["EDUC_P", { eso: 1, bach_fp: 2, univ: 3 }],
  A11: ["USO_IA_P", { nunca: 0, alguna: 1, mensual: 2, semanal: 3, diaria: 4 }],
  A12: ["GASTO_EXTRA", { "0": 0, "1-50": 1, "51-100": 2, "101-200": 3, "200+": 4 }],
  B1: ["MOVIL_H", { si: 1, no: 0 }],
  // No está en el libro de códigos del documento de diseño (la pregunta se añadió después);
  // se codifica con el mismo criterio que el resto de edades del progenitor/menor (NS = 9).
  B1b: ["EDAD_MOVIL_H", { "<10": 1, "10-11": 2, "12-13": 3, "14+": 4, ns: 9 }],
  B2: ["USO_IA_H", { nunca: 0, menos_mensual: 1, mensual: 2, semanal: 3, diario: 4, ns: 9 }],
  B5: ["USO_FUERA", { nunca: 0, a_veces: 1, a_menudo: 2, ns: 9 }],
  B7: ["NORMA_CENTRO", { prohibe: 1, permite: 2, sin_norma: 3, ns: 9 }],
  B8: ["LECTURA_H", { nunca: 0, menos_mensual: 1, mensual: 2, semanal: 3, diario: 4, ns: 9 }],
  B9: ["PANTALLA_H", { "<1": 1, "1-2": 2, "2-4": 3, "4+": 4, ns: 9 }],
  C7: ["APRENDE", { "-2": -2, "-1": -1, "0": 0, "1": 1, "2": 2, ns: 9 }],
  D1: ["POSTURA", { restringir: 1, normas: 2, ensenar: 3, libre: 4, ns: 9 }],
  D5: ["RESPONSABLE", { familia: 1, colegio: 2, administracion: 3, empresas: 4, academias: 5 }],
  E1: ["FORM_COLEGIO", { ninguna: 0, mencion: 1, asignatura: 2, ns: 9 }],
  E3: ["DECISOR", { yo: 1, pareja: 2, ambos: 3, hijo: 4 }],
};

// Escalas que ya son numéricas en el rango del documento: se copian igual, solo cambia el nombre.
const ESCALA: Record<string, string> = { C1: "PREOC", D3: "AUTOEFIC", D4: "COLEGIO" };

// Preguntas de opción múltiple: prefijo de columna (una binaria 0/1 por opción, con el código de la opción como sufijo).
const MULTIPLE: Record<string, string> = {
  A13: "EXTRA_", B3: "HERR_", B4: "USOS_", C4: "EPISODIO_", D2: "ACCION_", E2: "FUENTE_", E4: "META_",
};

// A7 (zona): 01-19 = código INE de la comunidad autónoma; si el k-anonimato la generalizó a una
// macrozona NUTS1, 20-26; si la suprimió del todo, 99. El documento de diseño dice "ZONA: Nominal,
// 1 a 6" (versión anterior a preguntar la comunidad autónoma real); esta tabla lo sustituye, pendiente
// de actualizar el documento.
const ZONA: Mapa = {
  ...Object.fromEntries(Object.keys(CCAA_INE).map((c) => [c, Number(c)])),
  noroeste: 20, noreste: 21, madrid: 22, centro: 23, este: 24, sur: 25, canarias: 26,
};

function copiar(fila: Fila, out: Fila, clave: string, destino = clave) {
  if (clave in fila) out[destino] = fila[clave];
}

export function libroCodigos(fila: Fila): Fila {
  const out: Fila = { CANAL: fila.CANAL, SEMANA: fila.SEMANA, ORDEN_CD: fila.ORDEN_CD, DURACION: fila.DURACION, COMPLETA: 1 };

  for (const [qid, [nombre, mapa]] of Object.entries(UNICA)) {
    const v = fila[qid];
    out[nombre] = v === undefined || v === "" ? "" : (mapa[String(v)] ?? "");
  }
  out.ZONA = fila.A7 === "" ? 99 : (ZONA[String(fila.A7)] ?? 99);
  for (const [qid, nombre] of Object.entries(ESCALA)) copiar(fila, out, qid, nombre);

  for (const [qid, prefijo] of Object.entries(MULTIPLE)) {
    for (const o of PREGUNTA_POR_ID[qid].opciones ?? []) copiar(fila, out, `${qid}_${o.v}`, `${prefijo}${o.v}`);
  }

  // C2: las 3 primeras preocupaciones (código de la opción, tal cual) y la puntuación Borda de cada opción.
  for (let i = 1; i <= 3; i++) copiar(fila, out, `C2_${i}`, `PREOC_TOP${i}`);
  for (const o of PREGUNTA_POR_ID.C2.opciones ?? []) {
    if (o.exclusiva) continue;
    copiar(fila, out, `C2_puntos_${o.v}`, `PREOC_SCORE_${o.v}`);
  }

  // Derivadas que ya se calculan con el nombre correcto del documento al aplanar la respuesta.
  for (const nombre of ["PAGA_EXTRA", "ALARMA", "ATENCION", "USO_SEMANAL", "NS_TOTAL"]) copiar(fila, out, nombre);
  copiar(fila, out, "C5", "RELATO"); // solo presente en la exportación interna (la de compartir quita el texto libre antes)

  return out;
}
