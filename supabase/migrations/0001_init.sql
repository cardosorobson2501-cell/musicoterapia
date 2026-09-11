-- =====================================================================
-- Musicoterapia - schema inicial
-- Cole este arquivo inteiro no SQL Editor do Supabase e execute.
-- =====================================================================
-- Convencoes gerais:
--   * id uuid gerado NO CLIENTE (necessario para o app funcionar offline)
--   * updated_at vem do cliente e e a base da resolucao de conflitos
--   * deleted_at: exclusao logica, necessaria para sincronizar remocoes
--   * RLS em todas as tabelas, sempre por therapist_id = auth.uid()
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- therapists: perfil do profissional, espelha auth.users
-- ---------------------------------------------------------------------
create table if not exists public.therapists (
  id           uuid primary key references auth.users(id) on delete cascade,
  full_name    text not null default '',
  council_id   text not null default '',           -- registro profissional
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Cria o perfil automaticamente quando um usuario se cadastra.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  insert into public.therapists (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$fn$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- institutions: locais de atendimento
-- ---------------------------------------------------------------------
create table if not exists public.institutions (
  id           uuid primary key,
  therapist_id uuid not null references public.therapists(id) on delete cascade,
  name         text not null,
  kind         text not null default '',           -- clinica, escola, domiciliar...
  notes        text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

-- ---------------------------------------------------------------------
-- patients: ficha do paciente
-- ---------------------------------------------------------------------
create table if not exists public.patients (
  id                uuid primary key,
  therapist_id      uuid not null references public.therapists(id) on delete cascade,
  -- code e o pseudonimo estavel usado na exportacao anonimizada (P001, P002...).
  -- Nunca muda depois de criado: e o que permite a IA acompanhar o mesmo caso
  -- ao longo de varias exportacoes.
  code              text not null,
  full_name         text not null,
  nickname          text not null default '',      -- como e chamado; entra na anonimizacao
  birth_date        date,
  guardians         jsonb not null default '[]'::jsonb,
  -- guardians: [{ name, relationship, phone, is_whatsapp_contact }]
  diagnosis         text not null default '',
  allergies         text not null default '',
  initial_condition text not null default '',
  main_demand       text not null default '',
  institution_id    uuid references public.institutions(id) on delete set null,
  schedule          jsonb not null default '[]'::jsonb,
  -- schedule: [{ weekday: 0-6, start_time: "14:00", duration_min: 50 }]
  whatsapp_target   jsonb not null default '{}'::jsonb,
  -- whatsapp_target: { mode: "contact" | "group", phone: "5511999999999", label: "Grupo Joao" }
  status            text not null default 'active' check (status in ('active','paused','discharged')),
  notes             text not null default '',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  unique (therapist_id, code)
);

create index if not exists patients_therapist_idx on public.patients (therapist_id, status);

-- ---------------------------------------------------------------------
-- activities: catalogo de atividades estruturadas
-- ---------------------------------------------------------------------
create table if not exists public.activities (
  id               uuid primary key,
  therapist_id     uuid not null references public.therapists(id) on delete cascade,
  name             text not null,
  description      text not null default '',
  objective        text not null default '',
  -- Como o desempenho e medido nesta atividade:
  --   trials        -> tentativa a tentativa (acerto / erro / com ajuda)
  --   prompt_levels -> nivel de ajuda por tentativa (independente ... fisica total)
  --   scale         -> uma nota por atividade (ex.: 0 a 5)
  --   duration      -> cronometro (tempo de engajamento, latencia...)
  --   count         -> contagem livre de ocorrencias
  measurement_type text not null check (measurement_type in ('trials','prompt_levels','scale','duration','count')),
  -- config guarda os rotulos e limites desse tipo de medicao. Exemplos:
  --   trials:        { "target_trials": 10 }
  --   prompt_levels: { "levels": ["Independente","Verbal","Gestual","Fisica parcial","Fisica total"] }
  --   scale:         { "min": 0, "max": 5, "labels": { "0": "Nao realizou", "5": "Independente" } }
  config           jsonb not null default '{}'::jsonb,
  mastery_criteria text not null default '',       -- ex.: "80% em 3 sessoes consecutivas"
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);

-- ---------------------------------------------------------------------
-- patient_activities: quais atividades estao ativas para cada paciente.
-- E o que monta a tela de atendimento sem precisar procurar nada.
-- ---------------------------------------------------------------------
create table if not exists public.patient_activities (
  id             uuid primary key,
  therapist_id   uuid not null references public.therapists(id) on delete cascade,
  patient_id     uuid not null references public.patients(id) on delete cascade,
  activity_id    uuid not null references public.activities(id) on delete cascade,
  target         text not null default '',         -- alvo individualizado deste paciente
  sort_order     integer not null default 0,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  unique (patient_id, activity_id)
);

create index if not exists patient_activities_patient_idx on public.patient_activities (patient_id, is_active);

-- ---------------------------------------------------------------------
-- sessions: o prontuario de atendimento
-- ---------------------------------------------------------------------
create table if not exists public.sessions (
  id               uuid primary key,
  therapist_id     uuid not null references public.therapists(id) on delete cascade,
  patient_id       uuid not null references public.patients(id) on delete cascade,
  institution_id   uuid references public.institutions(id) on delete set null,
  session_date     date not null,
  start_time       text not null default '',
  end_time         text not null default '',
  -- Blocos do prontuario
  objectives       text not null default '',
  resources        text not null default '',       -- instrumentos, musicas, materiais
  description      text not null default '',
  patient_response text not null default '',
  incidents        text not null default '',       -- intercorrencias
  conduct          text not null default '',       -- conduta / plano proxima sessao
  status           text not null default 'draft' check (status in ('draft','final')),
  sent_clinica_at  timestamptz,
  sent_whatsapp_at timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);

create index if not exists sessions_patient_date_idx on public.sessions (patient_id, session_date desc);
create index if not exists sessions_therapist_date_idx on public.sessions (therapist_id, session_date desc);

-- ---------------------------------------------------------------------
-- activity_records: desempenho registrado durante a sessao
-- ---------------------------------------------------------------------
create table if not exists public.activity_records (
  id               uuid primary key,
  therapist_id     uuid not null references public.therapists(id) on delete cascade,
  session_id       uuid not null references public.sessions(id) on delete cascade,
  patient_id       uuid not null references public.patients(id) on delete cascade,
  activity_id      uuid not null references public.activities(id) on delete restrict,
  -- Copia do tipo e da config NO MOMENTO do registro: editar a atividade
  -- depois nao pode reinterpretar dados historicos.
  measurement_type text not null,
  config_snapshot  jsonb not null default '{}'::jsonb,
  activity_name    text not null default '',
  -- trials: [{ n, result, prompt_level, note }]
  trials           jsonb not null default '[]'::jsonb,
  score            numeric,                        -- scale
  duration_seconds integer,                        -- duration
  count_value      integer,                        -- count
  computed_percent numeric,                        -- % de acerto / independencia
  notes            text not null default '',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);

create index if not exists activity_records_session_idx on public.activity_records (session_id);
create index if not exists activity_records_evolution_idx on public.activity_records (patient_id, activity_id, created_at);

-- ---------------------------------------------------------------------
-- export_logs: rastreabilidade das exportacoes (boa pratica de LGPD)
-- ---------------------------------------------------------------------
create table if not exists public.export_logs (
  id             uuid primary key,
  therapist_id   uuid not null references public.therapists(id) on delete cascade,
  exported_at    timestamptz not null default now(),
  period_start   date,
  period_end     date,
  patient_count  integer not null default 0,
  anonymized     boolean not null default true,
  format         text not null default 'markdown',
  contents       text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- =====================================================================
-- Row Level Security
-- Nenhuma linha e visivel fora do terapeuta dono dela.
-- =====================================================================
alter table public.therapists         enable row level security;
alter table public.institutions       enable row level security;
alter table public.patients           enable row level security;
alter table public.activities         enable row level security;
alter table public.patient_activities enable row level security;
alter table public.sessions           enable row level security;
alter table public.activity_records   enable row level security;
alter table public.export_logs        enable row level security;

drop policy if exists therapists_self on public.therapists;
create policy therapists_self on public.therapists
  for all using (id = (select auth.uid())) with check (id = (select auth.uid()));

do $rls$
declare t text;
begin
  foreach t in array array[
    'institutions','patients','activities','patient_activities',
    'sessions','activity_records','export_logs'
  ]
  loop
    execute format('drop policy if exists %I_owner on public.%I;', t, t);
    execute format(
      'create policy %I_owner on public.%I for all
         using (therapist_id = (select auth.uid()))
         with check (therapist_id = (select auth.uid()));', t, t);
  end loop;
end
$rls$;
