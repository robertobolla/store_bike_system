-- ================================================================
-- Registro de tiempos de respuesta a clientes.
--
-- Sirve para medir cuanto se tarda en contestar y por que medio, y con
-- eso decidir donde reforzar la atencion.
--
-- El tiempo se guarda SIEMPRE en minutos, aunque en la pantalla se
-- cargue en horas o dias. Guardar el numero tal como se tecleo junto a
-- su unidad obligaria a convertir en cada consulta y haria imposible
-- promediar filas con unidades distintas.
-- ================================================================

create table if not exists response_logs (
  id             uuid primary key default gen_random_uuid(),

  customer_name  text not null default '',
  phone          text not null default '',
  email          text not null default '',

  -- Medio por el que se respondio. Texto y no enum: si manana aparece
  -- otro canal, no hace falta migrar el tipo.
  channel        text not null default 'otro',
  -- Detalle libre del canal. Es lo que se escribe cuando el medio es
  -- 'otro' (p.ej. "llamada", "presencial"), o una aclaracion del resto.
  channel_detail text not null default '',

  -- Minutos que se tardo en responder. Sin tope superior: una respuesta
  -- puede tardar dias y ese dato es justamente el que interesa ver.
  response_minutes int not null check (response_minutes >= 0),

  notes          text not null default '',
  -- Fecha a la que corresponde el registro, separada de created_at para
  -- poder cargar respuestas de dias anteriores.
  logged_at      date not null default current_date,

  created_at     timestamptz not null default now(),
  created_by     uuid references auth.users(id)
);

create index if not exists idx_response_logs_logged on response_logs(logged_at desc);
create index if not exists idx_response_logs_channel on response_logs(channel);

alter table response_logs enable row level security;

-- Mismo criterio que el resto de las tablas de la app: cualquier usuario
-- autenticado opera sobre ellas.
drop policy if exists rl_auth on response_logs;
create policy rl_auth on response_logs
  for all to authenticated using (true) with check (true);
