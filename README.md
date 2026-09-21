# Encuesta a familias: IA y adolescentes

Formulario anónimo (Next.js en Vercel + Postgres en Supabase). No guarda IP, fecha exacta, datos del dispositivo ni contactos.

## Puesta en marcha (unos 20 minutos)

### 1. Supabase
1. Crea un proyecto nuevo en **región Central EU (Frankfurt)**. Guarda la contraseña de la base de datos.
2. En *SQL Editor*, pega el contenido de `db/esquema.sql` y ejecútalo.
3. En *Connect > Connection string*, copia la del **Transaction pooler** (puerto 6543). Es tu `DATABASE_URL`.
4. Activa el doble factor en tu cuenta de Supabase.

### 2. Vercel
1. Sube esta carpeta a un repositorio privado de GitHub e impórtalo en Vercel (o usa `npx vercel` desde la carpeta).
2. En *Settings > Environment Variables* añade las variables de `.env.ejemplo`:
   - `DATABASE_URL`: la cadena del paso anterior.
   - `CAMPO_INICIO`: primer día de campo (AAAA-MM-DD).
   - `NEXT_PUBLIC_CONTACTO`: email de contacto que aparece en el aviso.
   - `NEXT_PUBLIC_RESPONSABLE`: nombre del responsable.
   - `NEXT_PUBLIC_INFORME_URL` (opcional): dónde se publicarán los resultados.
3. Despliega. La región de las funciones ya está fijada en Fráncfort (`vercel.json`).
4. No actives Vercel Analytics ni Speed Insights.

### 3. Enlaces
- Redes propias: `https://TU-DOMINIO/`
- EXAMIA: `https://TU-DOMINIO/?c=examia` (pide un código de un solo uso).

## Scripts (desde tu ordenador, con `DATABASE_URL` en el entorno)

| Comando | Qué hace |
| --- | --- |
| `npm run codigos -- 900` | Genera 900 códigos para EXAMIA. En la base de datos solo guarda su hash; los códigos salen en un CSV para entregar. Bórralo después |
| `npm run estado` | Respuestas, abandonos por bloque, reparto del orden C/D, cuotas y contadores |
| `npm run exportar` | CSV para compartir: sin texto libre y con k-anonimato (k = 5) sobre zona, edad, sexo y centro |
| `npm run exportar -- --interno` | CSV completo solo para quien analiza. No se comparte ni se sube a ningún sitio |

Durante el campo, exporta el CSV interno una vez al día como copia de seguridad (el plan gratuito de Supabase no la hace).

## Cuotas
Están en la tabla `cuotas` (techos por perfil). Se pueden cambiar en cualquier momento desde el editor de tablas de Supabase. Cuando un perfil llega a su techo, las nuevas familias con ese perfil ven un mensaje de agradecimiento y no se guarda nada suyo.

## Cambiar preguntas
Todo el cuestionario está en `lib/encuesta.ts`. La misma definición la usan el formulario y la validación del servidor. No cambies preguntas con el campo abierto: rompe la comparabilidad.

## Pruebas
- `npm test`: validación y limpieza de texto.
- `tests/simulacion.ts`: respuestas sintéticas contra un servidor de pruebas. **Nunca contra producción.**
