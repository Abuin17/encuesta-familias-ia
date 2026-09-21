-- Usuario propio de la aplicacion, con permisos minimos. Se ejecuta despues de esquema.sql.
-- La contrasena se fija fuera de este fichero (nunca se guarda en el repositorio).
-- create role encuesta_app login password '<verificador SCRAM>';

grant usage on schema public to encuesta_app;
grant select, insert, update, delete on respuestas to encuesta_app;
grant select, insert, update on codigos to encuesta_app;
grant select, update on cuotas to encuesta_app;
grant select, update on contadores to encuesta_app;

-- RLS sigue activa: solo este usuario tiene politicas. anon y authenticated no tienen ninguna.
create policy app_respuestas on respuestas for all to encuesta_app using (true) with check (true);
create policy app_codigos    on codigos    for all to encuesta_app using (true) with check (true);
create policy app_cuotas     on cuotas     for all to encuesta_app using (true) with check (true);
create policy app_contadores on contadores for all to encuesta_app using (true) with check (true);
