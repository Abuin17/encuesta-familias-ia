import { BLOQUE_POR_ID, visible, type Bloque, type Respuestas } from "./encuesta.ts";
import { limpiarTexto } from "./limpiar.ts";

export type Resultado = { ok: true; datos: Respuestas } | { ok: false; error: string };

// Valida un bloque completo contra la definicion del cuestionario.
// Devuelve solo los campos esperados, ya limpios. Cualquier campo desconocido se descarta.
export function validarBloque(id: string, entrada: unknown): Resultado {
  const bloque = BLOQUE_POR_ID[id as Bloque["id"]];
  if (!bloque) return { ok: false, error: "bloque desconocido" };
  if (!entrada || typeof entrada !== "object" || Array.isArray(entrada)) return { ok: false, error: "formato" };
  const r = entrada as Record<string, unknown>;
  const datos: Respuestas = {};

  for (const p of bloque.preguntas) {
    const valor = r[p.id];
    // La visibilidad se evalua con lo ya validado del mismo bloque (las condiciones siempre apuntan hacia atras).
    if (!visible(p, datos)) continue;

    const vacio = valor === undefined || valor === null || valor === "" || (Array.isArray(valor) && valor.length === 0);
    if (vacio) {
      if (p.opcional) continue;
      return { ok: false, error: `falta ${p.id}` };
    }

    const permitidos = new Set((p.opciones ?? []).map((o) => o.v));
    const exclusivos = new Set((p.opciones ?? []).filter((o) => o.exclusiva).map((o) => o.v));

    switch (p.tipo) {
      case "unica": {
        if (typeof valor !== "string" || !permitidos.has(valor)) return { ok: false, error: `valor ${p.id}` };
        datos[p.id] = valor;
        break;
      }
      case "multiple":
      case "orden": {
        if (!Array.isArray(valor) || !valor.every((x) => typeof x === "string" && permitidos.has(x))) {
          return { ok: false, error: `valor ${p.id}` };
        }
        if (new Set(valor).size !== valor.length) return { ok: false, error: `repetido ${p.id}` };
        if (p.maxSel && valor.length > p.maxSel) return { ok: false, error: `demasiadas ${p.id}` };
        if (valor.some((x) => exclusivos.has(x)) && valor.length > 1) return { ok: false, error: `exclusiva ${p.id}` };
        datos[p.id] = valor as string[];
        break;
      }
      case "escala": {
        const n = typeof valor === "number" ? valor : Number.NaN;
        if (!Number.isInteger(n) || n < (p.min ?? 0) || n > (p.max ?? 10)) return { ok: false, error: `valor ${p.id}` };
        datos[p.id] = n;
        break;
      }
      case "texto": {
        if (typeof valor !== "string") return { ok: false, error: `valor ${p.id}` };
        const limpio = limpiarTexto(valor.slice(0, p.maxLen ?? 280));
        if (limpio) datos[p.id] = limpio;
        break;
      }
    }
  }
  return { ok: true, datos };
}
