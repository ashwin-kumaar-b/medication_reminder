create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  password text not null,
  role text not null check (role in ('patient', 'caretaker')),
  age integer,
  illness text,
  ui_mode text check (ui_mode in ('younger', 'older')),
  linked_patient_id uuid null references users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table users add column if not exists age integer;
alter table users add column if not exists illness text;
alter table users add column if not exists ui_mode text;

create table if not exists medications (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references users(id) on delete cascade,
  drug_name text not null,
  dosage text not null,
  photo_url text,
  category text not null check (category in ('blood-pressure', 'diabetes', 'thyroid', 'antibiotic', 'blood-thinner', 'other')),
  criticality text not null check (criticality in ('low', 'medium', 'high')),
  schedule_time text not null,
  frequency text not null check (frequency in ('daily', 'twice', 'weekly')),
  created_at timestamptz not null default now()
);

alter table medications add column if not exists photo_url text;

create table if not exists logs (
  id uuid primary key default gen_random_uuid(),
  medication_id uuid not null references medications(id) on delete cascade,
  patient_id uuid not null references users(id) on delete cascade,
  date date not null,
  scheduled_time text not null,
  status text not null check (status in ('pending', 'taken', 'delayed', 'missed', 'skipped')),
  timestamp_marked timestamptz null,
  delay_count integer not null default 0,
  created_at timestamptz not null default now(),
  unique (medication_id, date)
);

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

alter table users enable row level security;
alter table medications enable row level security;
alter table logs enable row level security;
alter table notifications enable row level security;
alter table caretaker_patients enable row level security;

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
