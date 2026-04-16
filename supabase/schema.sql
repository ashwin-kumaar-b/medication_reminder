create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  password text not null,
  role text not null check (role in ('patient', 'caretaker')),
  age integer,
  illness text,
  date_of_birth date,
  height_cm integer,
  weight_kg numeric(6,2),
  chronic_diseases text[] default '{}',
  infection_history text[] default '{}',
  allergies jsonb default '[]'::jsonb,
  emergency_contact_email text,
  profile_json jsonb default '{}'::jsonb,
  ui_mode text check (ui_mode in ('younger', 'older')),
  linked_patient_id uuid null references users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table users add column if not exists age integer;
alter table users add column if not exists illness text;
alter table users add column if not exists date_of_birth date;
alter table users add column if not exists height_cm integer;
alter table users add column if not exists weight_kg numeric(6,2);
alter table users add column if not exists chronic_diseases text[] default '{}';
alter table users add column if not exists infection_history text[] default '{}';
alter table users add column if not exists allergies jsonb default '[]'::jsonb;
alter table users add column if not exists emergency_contact_email text;
alter table users add column if not exists profile_json jsonb default '{}'::jsonb;
alter table users add column if not exists ui_mode text;

create table if not exists medications (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references users(id) on delete cascade,
  drug_name text not null,
  dosage text not null,
  photo_url text,
  food_timing text not null default 'before-food' check (food_timing in ('before-food', 'after-food')),
  category text not null check (category in ('blood-pressure', 'diabetes', 'thyroid', 'antibiotic', 'blood-thinner', 'other')),
  criticality text not null check (criticality in ('low', 'medium', 'high')),
  schedule_time text not null,
  frequency text not null check (frequency in ('daily', 'twice', 'weekly')),
  created_at timestamptz not null default now()
);

alter table medications add column if not exists photo_url text;
alter table medications add column if not exists food_timing text not null default 'before-food';

create table if not exists logs (
  id uuid primary key default gen_random_uuid(),
  medication_id uuid not null references medications(id) on delete cascade,
  patient_id uuid not null references users(id) on delete cascade,
  date date not null,
  scheduled_time text not null,
  status text not null check (status in ('pending', 'taken', 'delayed', 'missed', 'skipped')),
  timestamp_marked timestamptz null,
  delay_count integer not null default 0,
  marked_by text not null default 'system' check (marked_by in ('user', 'system', 'caretaker', 'ai')),
  status_reason text,
  status_meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (medication_id, date, scheduled_time)
);

alter table logs add column if not exists marked_by text not null default 'system';
alter table logs add column if not exists status_reason text;
alter table logs add column if not exists status_meta jsonb not null default '{}'::jsonb;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'logs_medication_id_date_key'
  ) then
    alter table logs drop constraint logs_medication_id_date_key;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'logs_medication_id_date_scheduled_time_key'
  ) then
    alter table logs
      add constraint logs_medication_id_date_scheduled_time_key
      unique (medication_id, date, scheduled_time);
  end if;
end
$$;

create index if not exists idx_logs_patient_date on logs (patient_id, date desc);
create index if not exists idx_logs_medication_date on logs (medication_id, date desc);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references users(id) on delete cascade,
  caretaker_id uuid null references users(id) on delete set null,
  medication_id uuid null references medications(id) on delete set null,
  level text not null check (level in ('green', 'yellow', 'red')),
  type text not null check (type in ('patient-reminder', 'patient-risk', 'caretaker-alert')),
  title text not null,
  message text not null,
  dedupe_key text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists caretaker_patients (
  id uuid primary key default gen_random_uuid(),
  caretaker_id uuid not null references users(id) on delete cascade,
  patient_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (caretaker_id, patient_id)
);

create table if not exists user_health_profiles (
  user_id uuid primary key references users(id) on delete cascade,
  date_of_birth date,
  height_cm integer,
  weight_kg numeric(6,2),
  chronic_diseases text[] default '{}',
  infection_history text[] default '{}',
  allergies jsonb default '[]'::jsonb,
  emergency_contact_email text,
  profile_json jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_health_profiles_emergency_email
  on user_health_profiles (emergency_contact_email);

-- Backfill any already stored health details from users into the new table.
insert into user_health_profiles (
  user_id,
  date_of_birth,
  height_cm,
  weight_kg,
  chronic_diseases,
  infection_history,
  allergies,
  emergency_contact_email,
  profile_json
)
select
  id,
  date_of_birth,
  height_cm,
  weight_kg,
  coalesce(chronic_diseases, '{}'),
  coalesce(infection_history, '{}'),
  coalesce(allergies, '[]'::jsonb),
  emergency_contact_email,
  coalesce(profile_json, '{}'::jsonb)
from users
on conflict (user_id) do update set
  date_of_birth = excluded.date_of_birth,
  height_cm = excluded.height_cm,
  weight_kg = excluded.weight_kg,
  chronic_diseases = excluded.chronic_diseases,
  infection_history = excluded.infection_history,
  allergies = excluded.allergies,
  emergency_contact_email = excluded.emergency_contact_email,
  profile_json = excluded.profile_json,
  updated_at = now();

alter table users enable row level security;
alter table medications enable row level security;
alter table logs enable row level security;
alter table notifications enable row level security;
alter table caretaker_patients enable row level security;
alter table user_health_profiles enable row level security;

drop policy if exists users_select_all on users;
create policy users_select_all on users for select using (true);

drop policy if exists users_insert_all on users;
create policy users_insert_all on users for insert with check (true);

drop policy if exists users_update_all on users;
create policy users_update_all on users for update using (true);

drop policy if exists medications_all on medications;
create policy medications_all on medications for all using (true) with check (true);

drop policy if exists logs_all on logs;
create policy logs_all on logs for all using (true) with check (true);

drop policy if exists notifications_all on notifications;
create policy notifications_all on notifications for all using (true) with check (true);

drop policy if exists caretaker_patients_all on caretaker_patients;
create policy caretaker_patients_all on caretaker_patients for all using (true) with check (true);

drop policy if exists user_health_profiles_all on user_health_profiles;
create policy user_health_profiles_all on user_health_profiles for all using (true) with check (true);
