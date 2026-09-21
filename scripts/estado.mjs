// Estado del campo: respuestas, abandonos, cuotas y contadores. Sin datos individuales.
// Uso: DATABASE_URL=... node scripts/estado.mjs
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) { console.error("Falta DATABASE_URL"); process.exit(1); }
const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
const sql = postgres(url, { prepare: false, max: 1, ssl: local ? false : "require" });

const [t] = await sql`
  select count(*)::int as iniciadas,
         count(*) filter (where filtrada)::int as filtradas,
         count(*) filter (where completa)::int as completas,
         count(*) filter (where completa and canal = 1)::int as examia,
         count(*) filter (where completa and canal = 2)::int as redes
  from respuestas`;
console.log("\nRespuestas");
console.table(t);

const abandono = await sql`
  select case
      when not filtrada then 'A (perfil)'
      when not (datos ? 'B') then 'B'
      when orden_cd = 1 and not (datos ? 'C') then 'C'
      when orden_cd = 1 and not (datos ? 'D') then 'D'
      when orden_cd = 2 and not (datos ? 'D') then 'D'
      when orden_cd = 2 and not (datos ? 'C') then 'C'
      else 'E' end as abandona_en,
    count(*)::int as n
  from respuestas where not completa group by 1 order by 1`;
console.log("Abandonos por bloque (respuestas sin terminar)");
console.table(abandono);

const orden = await sql`select orden_cd, count(*)::int as n from respuestas where completa group by 1 order by 1`;
console.log("Orden de los bloques C y D (completas)");
console.table(orden);

const cuotas = await sql`select dimension, categoria, actual, objetivo, round(100.0 * actual / nullif(objetivo, 0))::int as pct from cuotas order by dimension, categoria`;
console.log("Cuotas");
console.table(cuotas);

const contadores = await sql`select clave, n from contadores order by clave`;
console.log("Contadores");
console.table(contadores);

const [c] = await sql`select count(*)::int as total, count(*) filter (where usado)::int as usados from codigos`;
console.log("Codigos EXAMIA");
console.table(c);
await sql.end();
