"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BLOQUE_POR_ID, ordenBloques, visible, type Bloque, type Opcion, type Pregunta, type Respuestas } from "../lib/encuesta.ts";
import { validarBloque } from "../lib/validar.ts";

type Fase = "cargando" | "intro" | "codigo" | "bloque" | "fin" | "cerrada" | "no_apto" | "no_consiente" | "ya" | "caducada";
type Sesion = { id: string; ordenCD: 1 | 2 };
type Estado = {
  fase: Fase;
  canal: "examia" | "redes";
  sesion: Sesion | null;
  paso: number;
  respuestas: Partial<Record<Bloque["id"], Respuestas>>;
  orden: Record<string, string[]>;
  inicio: number | null;
};

const CLAVE_ESTADO = "encuesta_ia_estado";
const CLAVE_HECHA = "encuesta_ia_completada";
const RESPONSABLE = process.env.NEXT_PUBLIC_RESPONSABLE || "Manu Abuín";
const CONTACTO = process.env.NEXT_PUBLIC_CONTACTO || "";
const INFORME = process.env.NEXT_PUBLIC_INFORME_URL || "";

// Almacenamiento del navegador protegido: si falla (modo privado, bloqueo), la encuesta sigue funcionando.
const guardar = (k: string, v: string, local = false) => {
  try { (local ? localStorage : sessionStorage).setItem(k, v); } catch { /* sin almacenamiento */ }
};
const leer = (k: string, local = false) => {
  try { return (local ? localStorage : sessionStorage).getItem(k); } catch { return null; }
};
const borrar = (k: string) => { try { sessionStorage.removeItem(k); } catch { /* nada */ } };

function barajar(opciones: Opcion[]): string[] {
  const movibles = opciones.filter((o) => !o.fija).map((o) => o.v);
  for (let i = movibles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [movibles[i], movibles[j]] = [movibles[j], movibles[i]];
  }
  return [...movibles, ...opciones.filter((o) => o.fija).map((o) => o.v)];
}

async function post(ruta: string, cuerpo: unknown): Promise<{ status: number; json: Record<string, unknown> }> {
  const r = await fetch(ruta, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
  let json: Record<string, unknown> = {};
  try { json = await r.json(); } catch { /* vacio */ }
  return { status: r.status, json };
}

const INICIAL: Estado = { fase: "cargando", canal: "redes", sesion: null, paso: 0, respuestas: {}, orden: {}, inicio: null };

export default function Encuesta() {
  const [e, setE] = useState<Estado>(INICIAL);
  const [a2, setA2] = useState<"si" | "no" | "">("");
  const [codigo, setCodigo] = useState("");
  const [pendiente, setPendiente] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const tituloRef = useRef<HTMLHeadingElement>(null);

  // Arranque: canal por URL, marca de "ya respondida" y recuperacion tras recargar.
  useEffect(() => {
    const canal = new URLSearchParams(window.location.search).get("c") === "examia" ? "examia" : "redes";
    if (leer(CLAVE_HECHA, true) === "1") { setE({ ...INICIAL, canal, fase: "ya" }); return; }
    const previo = leer(CLAVE_ESTADO);
    if (previo) {
      try {
        const p = JSON.parse(previo) as Estado;
        if (p.fase === "bloque" && p.sesion) { setE(p); return; }
      } catch { /* ignorar */ }
    }
    setE({ ...INICIAL, canal, fase: "intro" });
  }, []);

  useEffect(() => {
    if (e.fase === "bloque") guardar(CLAVE_ESTADO, JSON.stringify(e));
    else if (e.fase !== "cargando") borrar(CLAVE_ESTADO);
  }, [e]);

  // Al cambiar de pantalla, el foco va al titulo (lectores de pantalla) y la vista arriba.
  useEffect(() => {
    window.scrollTo(0, 0);
    tituloRef.current?.focus();
  }, [e.fase, e.paso]);

  const orden = useMemo(() => (e.sesion ? ordenBloques(e.sesion.ordenCD) : ordenBloques(1)), [e.sesion]);
  const bloque = BLOQUE_POR_ID[orden[e.paso]];

  async function empezar(conCodigo?: string) {
    setError("");
    setEnviando(true);
    try {
      const r = await post("/api/start", { canal: e.canal, codigo: conCodigo });
      if (r.status === 400 && r.json.error === "codigo") { setError("El código no es válido o ya se ha usado."); return; }
      if (r.status !== 200) { setError("No hemos podido empezar. Inténtalo de nuevo en un momento."); return; }
      setE((s) => ({ ...s, fase: "bloque", paso: 0, sesion: { id: String(r.json.id), ordenCD: r.json.ordenCD === 2 ? 2 : 1 }, inicio: Date.now() }));
    } catch {
      setError("No hay conexión. Inténtalo de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  async function aceptar() {
    if (!a2) { setError("Responde primero a la pregunta."); return; }
    if (a2 === "no") {
      post("/api/contar", { clave: "no_apto" }).catch(() => {});
      setE((s) => ({ ...s, fase: "no_apto" }));
      return;
    }
    if (e.canal === "examia") { setError(""); setE((s) => ({ ...s, fase: "codigo" })); return; }
    await empezar();
  }

  function rechazar() {
    post("/api/contar", { clave: "sin_consentimiento" }).catch(() => {});
    setE((s) => ({ ...s, fase: "no_consiente" }));
  }

  function responder(id: string, valor: string | string[] | number | undefined) {
    setPendiente((p) => (p === id ? null : p));
    setE((s) => {
      const actuales = { ...(s.respuestas[bloque.id] ?? {}) };
      if (valor === undefined) delete actuales[id]; else actuales[id] = valor;
      return { ...s, respuestas: { ...s.respuestas, [bloque.id]: actuales } };
    });
  }

  // Orden aleatorio de opciones: se fija una vez por pregunta y persona al entrar en el bloque.
  useEffect(() => {
    if (e.fase !== "bloque" || !bloque) return;
    const faltan = bloque.preguntas.filter((p) => p.mezclar && !e.orden[p.id]);
    if (faltan.length === 0) return;
    setE((s) => {
      const orden = { ...s.orden };
      for (const p of faltan) orden[p.id] = barajar(p.opciones ?? []);
      return { ...s, orden };
    });
  }, [e.fase, e.paso, bloque, e.orden]);

  function opcionesOrdenadas(p: Pregunta): Opcion[] {
    const ops = p.opciones ?? [];
    const o = p.mezclar ? e.orden[p.id] : undefined;
    if (!o) return ops;
    const porValor = new Map(ops.map((x) => [x.v, x]));
    return o.map((v) => porValor.get(v)).filter(Boolean) as Opcion[];
  }

  async function siguiente() {
    if (!e.sesion) return;
    setError("");
    const actuales = e.respuestas[bloque.id] ?? {};
    const soloVisibles: Respuestas = {};
    for (const p of bloque.preguntas) if (visible(p, actuales) && actuales[p.id] !== undefined) soloVisibles[p.id] = actuales[p.id];

    const v = validarBloque(bloque.id, soloVisibles);
    if (!v.ok) {
      const id = v.error.split(" ")[1];
      setPendiente(id ?? null);
      document.getElementById(`p-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    setEnviando(true);
    try {
      const ultimo = e.paso === orden.length - 1;
      const r = bloque.id === "A"
        ? await post("/api/filtro", { id: e.sesion.id, datos: soloVisibles })
        : await post("/api/bloque", { id: e.sesion.id, bloque: bloque.id, datos: soloVisibles });

      if (r.status === 409) { setE((s) => ({ ...s, fase: "caducada" })); return; }
      if (r.status !== 200) { setError("No hemos podido guardar este bloque. Inténtalo de nuevo."); return; }
      if (r.json.cerrada) { setE((s) => ({ ...s, fase: "cerrada" })); return; }

      if (ultimo) {
        const duracion = e.inicio ? Math.round((Date.now() - e.inicio) / 1000) : null;
        const f = await post("/api/fin", { id: e.sesion.id, duracion });
        if (f.status !== 200) { setError("No hemos podido cerrar la encuesta. Inténtalo de nuevo."); return; }
        guardar(CLAVE_HECHA, "1", true);
        setE((s) => ({ ...s, fase: "fin" }));
      } else {
        setE((s) => ({ ...s, paso: s.paso + 1 }));
      }
    } catch {
      setError("No hay conexión. Tus respuestas siguen aquí: inténtalo de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  function reiniciar() {
    borrar(CLAVE_ESTADO);
    setE({ ...INICIAL, canal: e.canal, fase: "intro" });
    setA2("");
    setCodigo("");
  }

  if (e.fase === "cargando") return <main aria-busy="true" />;

  if (e.fase === "intro") {
    return (
      <main>
        <h1 ref={tituloRef} tabIndex={-1}>Familias e inteligencia artificial</h1>
        <p>Queremos entender cómo usan la IA los chicos y chicas de 8 a 17 años y qué preocupa a sus familias. Son unos 8 minutos.</p>
        <p><strong>Es anónima.</strong> No te pedimos nombre, email ni teléfono, y no guardamos tu dirección IP.</p>

        <details className="tarjeta aviso">
          <summary>Información sobre tus datos</summary>
          <ul>
            <li>Responsable: {RESPONSABLE}, dentro de un proyecto de investigación educativa.</li>
            <li>Finalidad: conocer el uso de la IA en las familias y publicar los resultados de forma agregada.</li>
            <li>No recogemos datos que te identifiquen. Las preguntas usan tramos (edad, zona, estudios) para que ninguna respuesta se pueda asociar a una familia.</li>
            <li>No guardamos tu IP, la fecha exacta ni datos del dispositivo. No hay cookies de seguimiento ni analítica.</li>
            <li>Al terminar, tu navegador guarda solo una marca de «encuesta hecha» para evitar respuestas repetidas. No contiene ningún dato tuyo.</li>
            <li>Conservamos las respuestas 24 meses. Como son anónimas, no podemos localizar la tuya para modificarla o borrarla.</li>
            {CONTACTO && <li>Contacto: <a href={`mailto:${CONTACTO}`}>{CONTACTO}</a></li>}
          </ul>
        </details>

        <div className="tarjeta">
          <fieldset>
            <legend>¿Tienes hijos o hijas de entre 8 y 17 años?</legend>
            <div className="opciones" role="radiogroup">
              {(["si", "no"] as const).map((v) => (
                <label key={v} className="opcion">
                  <input type="radio" name="A2" value={v} checked={a2 === v} onChange={() => { setA2(v); setError(""); }} />
                  <span>{v === "si" ? "Sí" : "No"}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        {error && <p className="error-general" role="alert">{error}</p>}
        <div className="acciones">
          <button className="boton" onClick={aceptar} disabled={enviando}>He leído la información y quiero participar</button>
          <button className="boton secundario" onClick={rechazar} disabled={enviando}>No quiero participar</button>
        </div>
      </main>
    );
  }

  if (e.fase === "codigo") {
    return (
      <main>
        <h1 ref={tituloRef} tabIndex={-1}>Tu código de participación</h1>
        <p>Escribe el código que te ha dado tu centro. Sirve solo para que cada familia responda una vez; no está asociado a tu nombre.</p>
        <form onSubmit={(ev) => { ev.preventDefault(); empezar(codigo); }}>
          <label htmlFor="codigo" className="suave">Código</label>
          <input id="codigo" type="text" inputMode="text" autoComplete="off" autoCapitalize="characters" spellCheck={false}
            maxLength={20} value={codigo} onChange={(ev) => setCodigo(ev.target.value)} />
          {error && <p className="error-general" role="alert">{error}</p>}
          <div className="acciones">
            <button className="boton" type="submit" disabled={enviando || codigo.trim().length < 4}>Empezar</button>
          </div>
        </form>
      </main>
    );
  }

  if (e.fase !== "bloque") {
    const textos: Record<string, [string, string]> = {
      fin: ["Gracias por participar", INFORME ? "Publicaremos los resultados en abierto." : "Publicaremos los resultados en abierto cuando termine el estudio."],
      cerrada: ["Gracias por tu interés", "Ya tenemos suficientes respuestas de familias con un perfil como el tuyo. No hemos guardado nada de lo que has contestado."],
      no_apto: ["Gracias por tu interés", "Esta encuesta es para familias con hijos o hijas de entre 8 y 17 años."],
      no_consiente: ["De acuerdo", "No hemos guardado ningún dato. Gracias por tu tiempo."],
      ya: ["Ya has respondido", "Desde este navegador ya se completó la encuesta. Gracias."],
      caducada: ["La sesión ha caducado", "No hemos podido continuar donde lo dejaste. Puedes volver a empezar."],
    };
    const [t, d] = textos[e.fase] ?? ["", ""];
    return (
      <main>
        <h1 ref={tituloRef} tabIndex={-1}>{t}</h1>
        <p>{d}</p>
        {e.fase === "fin" && INFORME && <p><a href={INFORME}>Ver dónde se publicarán los resultados</a></p>}
        {e.fase === "caducada" && <button className="boton" onClick={reiniciar}>Volver a empezar</button>}
      </main>
    );
  }

  const actuales = e.respuestas[bloque.id] ?? {};
  const progreso = Math.round((e.paso / orden.length) * 100);

  return (
    <main>
      <div className="progreso" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progreso} aria-label="Progreso">
        <div style={{ width: `${Math.max(4, progreso)}%` }} />
      </div>
      <p className="suave">Parte {e.paso + 1} de {orden.length}</p>
      <h1 ref={tituloRef} tabIndex={-1}>{bloque.titulo}</h1>
      {bloque.intro && <p className="suave">{bloque.intro}</p>}

      {bloque.preguntas.filter((p) => visible(p, actuales)).map((p) => (
        <PreguntaVista key={p.id} p={p} valor={actuales[p.id]} opciones={opcionesOrdenadas(p)}
          pendiente={pendiente === p.id} onCambio={(v) => responder(p.id, v)} />
      ))}

      {error && <p className="error-general" role="alert">{error}</p>}
      <div className="acciones">
        <button className="boton" onClick={siguiente} disabled={enviando}>
          {enviando ? "Guardando…" : e.paso === orden.length - 1 ? "Enviar respuestas" : "Continuar"}
        </button>
      </div>
    </main>
  );
}

function PreguntaVista({ p, valor, opciones, pendiente, onCambio }: {
  p: Pregunta;
  valor: string | string[] | number | undefined;
  opciones: Opcion[];
  pendiente: boolean;
  onCambio: (v: string | string[] | number | undefined) => void;
}) {
  const lista = Array.isArray(valor) ? valor : [];
  const exclusivas = new Set(opciones.filter((o) => o.exclusiva).map((o) => o.v));

  function alternar(v: string) {
    let nueva = lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v];
    if (!lista.includes(v)) {
      if (exclusivas.has(v)) nueva = [v];
      else nueva = nueva.filter((x) => !exclusivas.has(x));
    }
    onCambio(nueva.length ? nueva : undefined);
  }

  const lleno = !!p.maxSel && lista.length >= p.maxSel;

  return (
    <div id={`p-${p.id}`} className={`tarjeta pregunta${pendiente ? " pendiente" : ""}`}>
      <fieldset aria-describedby={p.ayuda ? `ay-${p.id}` : undefined}>
        <legend>{p.texto}</legend>
        {p.ayuda && <p className="ayuda" id={`ay-${p.id}`}>{p.ayuda}</p>}

        {p.tipo === "unica" && (
          <div className="opciones">
            {opciones.map((o) => (
              <label key={o.v} className="opcion">
                <input type="radio" name={p.id} value={o.v} checked={valor === o.v} onChange={() => onCambio(o.v)} />
                <span>{o.t}{o.ayuda && <small>{o.ayuda}</small>}</span>
              </label>
            ))}
          </div>
        )}

        {p.tipo === "multiple" && (
          <div className="opciones">
            {opciones.map((o) => {
              const marcada = lista.includes(o.v);
              const bloqueada = lleno && !marcada && !o.exclusiva;
              return (
                <label key={o.v} className={`opcion${bloqueada ? " desactivada" : ""}`}>
                  <input type="checkbox" name={p.id} value={o.v} checked={marcada} disabled={bloqueada} onChange={() => alternar(o.v)} />
                  <span>{o.t}</span>
                </label>
              );
            })}
          </div>
        )}

        {p.tipo === "orden" && (
          <div className="opciones">
            {opciones.map((o) => {
              const pos = lista.indexOf(o.v);
              const bloqueada = lleno && pos < 0 && !o.exclusiva;
              return (
                <button key={o.v} type="button" className={`opcion${pos >= 0 ? " elegida" : ""}${bloqueada ? " desactivada" : ""}`}
                  aria-pressed={pos >= 0} disabled={bloqueada} onClick={() => alternar(o.v)}>
                  <span className="orden-num" aria-hidden="true">{pos >= 0 && !o.exclusiva ? pos + 1 : ""}</span>
                  <span>{o.t}{pos >= 0 && !o.exclusiva && <span className="visually-hidden"> (posición {pos + 1})</span>}</span>
                </button>
              );
            })}
          </div>
        )}

        {p.tipo === "escala" && (
          <div className="escala">
            <div className="escala-botones" style={{ ["--n" as string]: Math.min(6, (p.max ?? 10) - (p.min ?? 0) + 1) }}>
              {Array.from({ length: (p.max ?? 10) - (p.min ?? 0) + 1 }, (_, i) => (p.min ?? 0) + i).map((n) => (
                <label key={n}>
                  <input type="radio" name={p.id} value={n} checked={valor === n} onChange={() => onCambio(n)}
                    aria-label={`${n}${n === p.min ? ` (${p.extremos?.[0]})` : n === p.max ? ` (${p.extremos?.[1]})` : ""}`} />
                  <span aria-hidden="true">{n}</span>
                </label>
              ))}
            </div>
            {p.extremos && <div className="escala-extremos" aria-hidden="true"><span>{p.extremos[0]}</span><span>{p.extremos[1]}</span></div>}
          </div>
        )}

        {p.tipo === "texto" && (
          <>
            <textarea name={p.id} maxLength={p.maxLen} value={typeof valor === "string" ? valor : ""}
              onChange={(ev) => onCambio(ev.target.value || undefined)} aria-label={p.texto} />
            <div className="contador">{(typeof valor === "string" ? valor.length : 0)}/{p.maxLen}</div>
          </>
        )}

        {pendiente && <p className="falta" role="alert">Falta responder esta pregunta.</p>}
      </fieldset>
    </div>
  );
}
