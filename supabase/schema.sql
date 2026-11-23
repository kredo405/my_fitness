-- Forma MVP: service-role access is restricted to Vercel serverless functions.
create table if not exists public.profiles (
  telegram_id bigint primary key,
  first_name text not null default '',
  goal text not null default 'fitness' check (goal in ('strength','fat_loss','fitness','endurance')),
  experience text not null default 'beginner' check (experience in ('beginner','intermediate','advanced')),
  age smallint check (age between 16 and 100),
  sessions_per_week smallint check (sessions_per_week between 1 and 14),
  height_cm numeric check (height_cm between 100 and 230),
  weight_kg numeric check (weight_kg between 30 and 300),
  limitations text not null default '',
  equipment text not null default '',
  dietary_preferences text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.daily_logs (
  id bigint generated always as identity primary key,
  telegram_id bigint not null references public.profiles(telegram_id) on delete cascade,
  log_date date not null default current_date,
  mood smallint check (mood between 1 and 5),
  stress smallint check (stress between 1 and 5),
  sleep_hours numeric check (sleep_hours between 0 and 24),
  weight_kg numeric check (weight_kg between 30 and 300),
  calories_kcal integer check (calories_kcal between 0 and 10000),
  protein_g numeric check (protein_g between 0 and 1000),
  water_ml integer not null default 0 check (water_ml between 0 and 10000),
  notes text not null default '',
  updated_at timestamptz not null default now(),
  unique (telegram_id, log_date)
);
create table if not exists public.workouts (
  id bigint generated always as identity primary key,
  telegram_id bigint not null references public.profiles(telegram_id) on delete cascade,
  title text not null,
  details jsonb not null default '{}'::jsonb,
  completed_at timestamptz not null default now()
);
create table if not exists public.coach_messages (
  id bigint generated always as identity primary key,
  telegram_id bigint not null references public.profiles(telegram_id) on delete cascade,
  role text not null check(role in ('user','assistant')),
  content text not null check(length(content) <= 5000),
  created_at timestamptz not null default now()
);
create index if not exists daily_logs_user_date_idx on public.daily_logs(telegram_id,log_date desc);
create index if not exists workouts_user_time_idx on public.workouts(telegram_id,completed_at desc);
create index if not exists coach_messages_user_time_idx on public.coach_messages(telegram_id,created_at desc);
alter table public.profiles enable row level security;
alter table public.daily_logs enable row level security;
alter table public.workouts enable row level security;
alter table public.coach_messages enable row level security;
-- No anon/authenticated policies: all access goes through authenticated Vercel functions using the service key.
revoke all on public.profiles,public.daily_logs,public.workouts,public.coach_messages from anon,authenticated;
grant all on public.profiles,public.daily_logs,public.workouts,public.coach_messages to service_role;
grant usage,select on all sequences in schema public to service_role;
