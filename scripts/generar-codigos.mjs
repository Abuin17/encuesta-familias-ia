// Genera codigos de un solo uso para el canal EXAMIA.
// Uso: DATABASE_URL=... node scripts/generar-codigos.mjs 900
// Guarda en la base de datos SOLO el hash de cada codigo y escribe un CSV con los codigos
// para entregar a EXAMIA. EXAMIA debe repartirlos sin anotar a quien da cada uno.
import { createHash, randomInt } from "node:crypto";
import { writeFileSync } from "node:fs";
import postgres from "postgres";

const n = Number(process.argv[2] ?? 0);
if (!Number.isInteger(n) || n < 1 || n > 20000) {
  console.error("Indica cuantos codigos generar (1 a 20000). Ejemplo: node scripts/generar-codigos.mjs 900");
  process.exit(1);
}
const url = process.env.DATABASE_URL;
if (!url) { console.error("Falta DATABASE_URL"); process.exit(1); }

// Sin caracteres ambiguos (0/O, 1/I/L).
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const nuevo = () => Array.from({ length: 8 }, () => ALFABETO[randomInt(ALFABETO.length)]).join("");
const hash = (c) => createHash("sha256").update(c.toUpperCase().replace(/[^A-Z0-9]/g, "")).digest("hex");

const codigos = new Set();
while (codigos.size < n) codigos.add(nuevo());
const lista = [...codigos];

const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
const sql = postgres(url, { prepare: false, max: 1, ssl: local ? false : "require" });
let insertados = 0;
for (let i = 0; i < lista.length; i += 500) {
  const trozo = lista.slice(i, i + 500).map((c) => ({ hash: hash(c), canal: 1 }));
  const r = await sql`insert into codigos ${sql(trozo)} on conflict do nothing returning 1`;
  insertados += r.length;
}
await sql.end();

const fecha = new Date().toISOString().slice(0, 10);
const fichero = `codigos-examia-${fecha}-${Date.now()}.csv`;
writeFileSync(fichero, "codigo\n" + lista.map((c) => `${c.slice(0, 4)}-${c.slice(4)}`).join("\n") + "\n");
console.log(`${insertados} codigos guardados (solo el hash) y entregables en ${fichero}`);
console.log("Borra el CSV cuando EXAMIA lo haya recibido.");
