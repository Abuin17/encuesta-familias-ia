// Definicion unica del cuestionario. La usan el formulario (cliente) y la validacion (servidor).
// Cambiar una pregunta aqui la cambia en los dos sitios.

export type Opcion = {
  v: string;          // valor que se guarda
  t: string;          // texto que se muestra
  fija?: boolean;     // no se baraja (va al final)
  exclusiva?: boolean; // en multirrespuesta, anula las demas
  ayuda?: string;
};

export type Condicion = { id: string; en?: string[]; noEn?: string[] };

export type Pregunta = {
  id: string;
  texto: string;
  ayuda?: string;
  tipo: "unica" | "multiple" | "escala" | "orden" | "texto";
  opciones?: Opcion[];
  mezclar?: boolean;       // barajar opciones no fijas
  maxSel?: number;         // multiple / orden
  min?: number;            // escala
  max?: number;            // escala
  extremos?: [string, string];
  mostrarSi?: Condicion;
  opcional?: boolean;
  maxLen?: number;         // texto
};

export type Bloque = { id: "A" | "B" | "C" | "D" | "E"; titulo: string; intro?: string; preguntas: Pregunta[] };

const NS: Opcion = { v: "ns", t: "No lo sé", fija: true };
const FRECUENCIA: Opcion[] = [
  { v: "nunca", t: "Nunca" },
  { v: "menos_mensual", t: "Menos de una vez al mes" },
  { v: "mensual", t: "Alguna vez al mes" },
  { v: "semanal", t: "Cada semana" },
  { v: "diario", t: "A diario" },
  NS,
];
const ACUERDO: [string, string] = ["Nada de acuerdo", "Totalmente de acuerdo"];

export const BLOQUES: Bloque[] = [
  {
    id: "A",
    titulo: "Sobre vosotros",
    intro: "Si tienes varios hijos o hijas de entre 8 y 17 años, responde pensando en el que cumple años antes.",
    preguntas: [
      { id: "A3", texto: "¿En qué tramo de edad está?", tipo: "unica", opciones: [
        { v: "8-12", t: "De 8 a 12 años" }, { v: "13-15", t: "De 13 a 15 años" }, { v: "16-17", t: "16 o 17 años" } ] },
      { id: "A4", texto: "¿Es chico o chica?", tipo: "unica", opciones: [
        { v: "chico", t: "Un chico" }, { v: "chica", t: "Una chica" }, { v: "nc", t: "Prefiero no decirlo", fija: true } ] },
      { id: "A6", texto: "¿Qué tipo de centro educativo?", tipo: "unica", opciones: [
        { v: "publico", t: "Público" }, { v: "concertado", t: "Concertado" }, { v: "privado", t: "Privado" }, NS ] },
      { id: "A7", texto: "¿En qué zona vivís?", tipo: "unica", opciones: [
        { v: "madrid", t: "Comunidad de Madrid" },
        { v: "andalucia", t: "Andalucía" },
        { v: "cataluna", t: "Cataluña" },
        { v: "valencia", t: "Comunitat Valenciana" },
        { v: "norte", t: "Norte y noroeste", ayuda: "Galicia, Asturias, Cantabria, País Vasco, Navarra, La Rioja, Castilla y León, Aragón" },
        { v: "resto", t: "Resto de España", ayuda: "Castilla-La Mancha, Extremadura, Murcia, Baleares, Canarias, Ceuta, Melilla" } ] },
      { id: "A8", texto: "Tu relación con él o ella", tipo: "unica", opciones: [
        { v: "madre", t: "Madre" }, { v: "padre", t: "Padre" }, { v: "otro", t: "Otra", fija: true } ] },
      { id: "A9", texto: "Tu edad", tipo: "unica", opciones: [
        { v: "<35", t: "Menos de 35" }, { v: "35-44", t: "De 35 a 44" }, { v: "45-54", t: "De 45 a 54" }, { v: "55+", t: "55 o más" } ] },
      { id: "A10", texto: "Tu nivel de estudios terminado", tipo: "unica", opciones: [
        { v: "eso", t: "Hasta ESO" }, { v: "bach_fp", t: "Bachillerato o FP" }, { v: "univ", t: "Universitarios o posgrado" } ] },
      { id: "A11", texto: "¿Con qué frecuencia usas tú herramientas de IA como ChatGPT?", tipo: "unica", opciones: [
        { v: "nunca", t: "Nunca" }, { v: "alguna", t: "Alguna vez" }, { v: "mensual", t: "Cada mes" }, { v: "semanal", t: "Cada semana" }, { v: "diaria", t: "A diario" } ] },
      { id: "A12", texto: "¿Cuánto pagáis al mes, más o menos, en actividades o clases extraescolares para este hijo o hija?", tipo: "unica", opciones: [
        { v: "0", t: "Nada" }, { v: "1-50", t: "Hasta 50 €" }, { v: "51-100", t: "De 51 a 100 €" }, { v: "101-200", t: "De 101 a 200 €" }, { v: "200+", t: "Más de 200 €" } ] },
      { id: "A13", texto: "¿Qué tipo de extraescolares?", ayuda: "Puedes marcar varias.", tipo: "multiple", mezclar: true,
        mostrarSi: { id: "A12", noEn: ["0"] }, opciones: [
        { v: "idiomas", t: "Idiomas" }, { v: "refuerzo", t: "Refuerzo escolar" }, { v: "deporte", t: "Deporte" },
        { v: "musica_arte", t: "Música o arte" }, { v: "tecnologia", t: "Tecnología o programación" }, { v: "otra", t: "Otra", fija: true } ] },
    ],
  },
  {
    id: "B",
    titulo: "Cómo usa la IA",
    intro: "No hay respuestas correctas. Si no lo sabes, dilo: también es una respuesta útil.",
    preguntas: [
      { id: "B1", texto: "¿Tiene móvil propio?", tipo: "unica", opciones: [ { v: "si", t: "Sí" }, { v: "no", t: "No" } ] },
      { id: "B1b", texto: "¿A qué edad lo tuvo?", tipo: "unica", mostrarSi: { id: "B1", en: ["si"] }, opciones: [
        { v: "<10", t: "Antes de los 10" }, { v: "10-11", t: "A los 10 u 11" }, { v: "12-13", t: "A los 12 o 13" }, { v: "14+", t: "Con 14 o más" }, NS ] },
      { id: "B2", texto: "¿Con qué frecuencia usa la IA (ChatGPT, Gemini u otras) para estudiar o hacer deberes?", tipo: "unica", opciones: FRECUENCIA },
      { id: "B3", texto: "¿Qué herramientas usa?", ayuda: "Puedes marcar varias.", tipo: "multiple", mezclar: true,
        mostrarSi: { id: "B2", noEn: ["nunca"] }, opciones: [
        { v: "chatgpt", t: "ChatGPT" }, { v: "gemini", t: "Gemini" }, { v: "meta_ai", t: "Meta AI (WhatsApp o Instagram)" },
        { v: "copilot", t: "Copilot" }, { v: "snapchat", t: "My AI de Snapchat" }, { v: "otra", t: "Otra", fija: true },
        { v: "ns", t: "No lo sé", fija: true, exclusiva: true } ] },
      { id: "B4", texto: "¿Para qué la usa?", ayuda: "Puedes marcar varias.", tipo: "multiple", mezclar: true,
        mostrarSi: { id: "B2", noEn: ["nunca"] }, opciones: [
        { v: "buscar", t: "Buscar información" }, { v: "resumir", t: "Resumir textos" }, { v: "redactar", t: "Redactar trabajos" },
        { v: "ejercicios", t: "Resolver ejercicios" }, { v: "traducir", t: "Traducir" }, { v: "explicar", t: "Que le explique algo que no entiende" },
        { v: "personal", t: "Conversar o pedir consejo personal" }, { v: "ns", t: "No lo sé", fija: true, exclusiva: true } ] },
      { id: "B5", texto: "¿La usa también para cosas que no tienen que ver con el colegio?", tipo: "unica",
        mostrarSi: { id: "B2", noEn: ["nunca"] }, opciones: [
        { v: "nunca", t: "Nunca" }, { v: "a_veces", t: "A veces" }, { v: "a_menudo", t: "A menudo" }, NS ] },
      { id: "B6", texto: "¿Cuánto crees que sabes de cómo usa la IA?", tipo: "escala", min: 1, max: 5, extremos: ["Nada", "Todo"] },
      { id: "B7", texto: "¿Qué norma tiene su centro sobre la IA?", tipo: "unica", opciones: [
        { v: "prohibe", t: "La prohíbe" }, { v: "permite", t: "La permite con normas" }, { v: "sin_norma", t: "No hay una norma clara" }, NS ] },
      { id: "B8", texto: "¿Con qué frecuencia lee por gusto, fuera de las lecturas obligatorias?", tipo: "unica", opciones: FRECUENCIA },
      { id: "B9", texto: "Un día de colegio, ¿cuántas horas pasa con pantallas en su tiempo libre?", tipo: "unica", opciones: [
        { v: "<1", t: "Menos de 1 hora" }, { v: "1-2", t: "De 1 a 2 horas" }, { v: "2-4", t: "De 2 a 4 horas" }, { v: "4+", t: "Más de 4 horas" }, NS ] },
    ],
  },
  {
    id: "C",
    titulo: "Lo que te preocupa",
    preguntas: [
      { id: "C1", texto: "¿Cuánto te preocupa cómo usa la IA?", tipo: "escala", min: 0, max: 10, extremos: ["Nada", "Muchísimo"] },
      { id: "C2", texto: "Elige hasta 3 cosas que más te preocupan, por orden", ayuda: "Toca primero la que más te preocupa.", tipo: "orden", maxSel: 3, mezclar: true, opciones: [
        { v: "no_piense", t: "Que no aprenda a pensar por sí mismo" },
        { v: "trampa", t: "Que copie o haga trampa" },
        { v: "falsa", t: "Que se crea información falsa" },
        { v: "lectura", t: "Que lea y se concentre menos" },
        { v: "privacidad", t: "La privacidad de sus datos" },
        { v: "dependencia", t: "Que dependa emocionalmente de un chatbot" },
        { v: "inapropiado", t: "Que vea contenido inapropiado" },
        { v: "atras", t: "Que se quede atrás en el futuro si no la domina" },
        { v: "nada", t: "Nada me preocupa", fija: true, exclusiva: true } ] },
      { id: "C3", texto: "En los últimos 6 meses, ¿ha pasado algo concreto con la IA que te haya preocupado?", tipo: "unica", opciones: [
        { v: "si", t: "Sí" }, { v: "no", t: "No" }, { v: "no_seguro", t: "No estoy seguro", fija: true } ] },
      { id: "C4", texto: "¿Qué pasó?", ayuda: "Puedes marcar varias.", tipo: "multiple", mezclar: true, mostrarSi: { id: "C3", en: ["si"] }, opciones: [
        { v: "pillado", t: "Le pillaron entregando algo hecho con IA" },
        { v: "notas", t: "Sacó buenas notas sin haber aprendido" },
        { v: "falso", t: "Se creyó algo falso" },
        { v: "profesor", t: "Nos avisó un profesor" },
        { v: "personal", t: "Tenía conversaciones personales con un chatbot" },
        { v: "otro", t: "Otra cosa", fija: true } ] },
      { id: "C5", texto: "Si quieres, cuéntalo en una o dos frases", ayuda: "No escribas nombres, colegios ni nada que permita identificar a nadie.",
        tipo: "texto", maxLen: 280, opcional: true, mostrarSi: { id: "C3", en: ["si"] } },
      { id: "C6", texto: "Para comprobar que lees las preguntas, marca «Bastante de acuerdo».", tipo: "unica", opciones: [
        { v: "1", t: "Nada de acuerdo" }, { v: "2", t: "Poco de acuerdo" }, { v: "3", t: "Ni de acuerdo ni en desacuerdo" },
        { v: "4", t: "Bastante de acuerdo" }, { v: "5", t: "Totalmente de acuerdo" } ] },
      { id: "C7", texto: "En conjunto, la IA hace que aprenda…", tipo: "unica", opciones: [
        { v: "-2", t: "Mucho menos" }, { v: "-1", t: "Algo menos" }, { v: "0", t: "Igual" }, { v: "1", t: "Algo más" }, { v: "2", t: "Mucho más" }, NS ] },
    ],
  },
  {
    id: "D",
    titulo: "Qué hacéis en casa",
    preguntas: [
      { id: "D1", texto: "¿Qué crees que es mejor para tu hijo o hija?", tipo: "unica", mezclar: true, opciones: [
        { v: "restringir", t: "Restringir la IA al máximo" },
        { v: "normas", t: "Permitirla con normas estrictas" },
        { v: "ensenar", t: "Enseñarle a usarla con criterio" },
        { v: "libre", t: "Dejar que aprenda por sí mismo" }, NS ] },
      { id: "D2", texto: "¿Qué has hecho hasta ahora?", ayuda: "Puedes marcar varias.", tipo: "multiple", mezclar: true, opciones: [
        { v: "hablar", t: "Hablar con él o ella" }, { v: "normas", t: "Poner normas" }, { v: "control", t: "Usar control parental" },
        { v: "revisar", t: "Revisar sus deberes" }, { v: "colegio", t: "Consultar al colegio" },
        { v: "nada", t: "Nada por ahora", fija: true, exclusiva: true } ] },
      { id: "D3", texto: "Me siento capaz de enseñarle a usar bien la IA", tipo: "escala", min: 1, max: 5, extremos: ACUERDO },
      { id: "D4", texto: "El colegio le enseñará a usarla bien", tipo: "escala", min: 1, max: 5, extremos: ACUERDO },
      { id: "D5", texto: "¿Quién debería ser el principal responsable de enseñarle a usar la IA?", tipo: "unica", mezclar: true, opciones: [
        { v: "familia", t: "La familia" }, { v: "colegio", t: "El colegio" }, { v: "administracion", t: "La Administración" },
        { v: "empresas", t: "Las empresas tecnológicas" }, { v: "academias", t: "Academias o formación privada" } ] },
    ],
  },
  {
    id: "E",
    titulo: "Para terminar",
    preguntas: [
      { id: "E1", texto: "¿Ha recibido alguna formación sobre IA en el colegio?", tipo: "unica", opciones: [
        { v: "asignatura", t: "Sí, una asignatura o un taller" }, { v: "mencion", t: "Alguna mención puntual" }, { v: "ninguna", t: "Ninguna" }, NS ] },
      { id: "E2", texto: "¿Dónde te informas sobre cómo educar en el uso de la tecnología?", ayuda: "Puedes marcar varias.", tipo: "multiple", mezclar: true, opciones: [
        { v: "colegio", t: "Colegio o tutores" }, { v: "padres", t: "Otros padres y madres" }, { v: "redes", t: "Redes sociales" },
        { v: "prensa", t: "Prensa" }, { v: "podcasts", t: "Podcasts" }, { v: "expertos", t: "Libros o expertos" },
        { v: "no_informo", t: "No me informo", fija: true, exclusiva: true } ] },
      { id: "E3", texto: "¿Quién decide en casa sobre las actividades extraescolares?", tipo: "unica", opciones: [
        { v: "yo", t: "Yo" }, { v: "pareja", t: "Mi pareja" }, { v: "ambos", t: "Los dos juntos" }, { v: "hijo", t: "Mi hijo o hija tiene la última palabra" } ] },
      { id: "E4", texto: "¿Qué te gustaría que supiera hacer con la IA al cumplir 18 años?", ayuda: "Elige 2 como máximo.", tipo: "multiple", maxSel: 2, mezclar: true, opciones: [
        { v: "estudiar", t: "Usarla para estudiar mejor" }, { v: "cuando_no", t: "Saber cuándo no usarla" },
        { v: "detectar", t: "Detectar cuándo se equivoca" }, { v: "trabajo", t: "Usarla en el trabajo" },
        { v: "entender", t: "Entender cómo funciona" }, { v: "crear", t: "Crear cosas con ella" },
        { v: "nada", t: "Nada en especial", fija: true, exclusiva: true } ] },
    ],
  },
];

export const BLOQUE_POR_ID = Object.fromEntries(BLOQUES.map((b) => [b.id, b])) as Record<Bloque["id"], Bloque>;

export type Respuestas = Record<string, string | string[] | number>;

export function visible(p: Pregunta, r: Respuestas): boolean {
  const c = p.mostrarSi;
  if (!c) return true;
  const v = r[c.id];
  if (v === undefined) return false;
  const s = String(v);
  if (c.en) return c.en.includes(s);
  if (c.noEn) return !c.noEn.includes(s);
  return true;
}

// Orden de bloques segun el sorteo C/D hecho en el servidor.
export function ordenBloques(ordenCD: 1 | 2): Bloque["id"][] {
  return ordenCD === 1 ? ["A", "B", "C", "D", "E"] : ["A", "B", "D", "C", "E"];
}

// Dimensiones de cuota que se leen del bloque A.
export const DIMENSIONES_CUOTA = ["A3", "A4", "A7", "A8"] as const;
