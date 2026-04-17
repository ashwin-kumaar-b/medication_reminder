create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text unique,
  password text not null,
  role text not null check (role in ('patient', 'caretaker')),
  ui_mode text check (ui_mode in ('younger', 'older')),
  linked_patient_id uuid null references users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table users add column if not exists ui_mode text;
alter table users add column if not exists phone text unique;
alter table users alter column email drop not null;

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

create table if not exists caretakers (
  user_id uuid primary key references users(id) on delete cascade,
  relation text not null check (relation in ('Family', 'Nurse', 'Doctor', 'Other')),
  relation_other text,
  linked_patient_id uuid null references users(id) on delete set null,
  profile_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_caretakers_linked_patient
  on caretakers (linked_patient_id);

alter table caretakers add column if not exists relation text;
alter table caretakers add column if not exists relation_other text;
alter table caretakers add column if not exists linked_patient_id uuid;
alter table caretakers add column if not exists profile_json jsonb default '{}'::jsonb;
alter table caretakers alter column relation set not null;

create table if not exists user_health_profiles (
  user_id uuid primary key references users(id) on delete cascade,
  gender text not null,
  gender_other text,
  blood_group text not null,
  date_of_birth date not null,
  height_cm integer not null,
  weight_kg numeric(6,2) not null,
  chronic_diseases text[] not null default '{}',
  infection_history text[] not null default '{}',
  allergies jsonb not null default '[]'::jsonb,
  emergency_contact_email text not null,
  profile_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_health_profiles_emergency_email
  on user_health_profiles (emergency_contact_email);

-- Backfill from profile_json where possible to prevent NOT NULL migration failures.
update user_health_profiles
set
  gender = coalesce(gender, nullif(profile_json ->> 'gender', '')),
  gender_other = coalesce(gender_other, nullif(profile_json ->> 'genderOther', '')),
  blood_group = coalesce(blood_group, nullif(profile_json ->> 'bloodGroup', '')),
  date_of_birth = coalesce(date_of_birth, nullif(profile_json ->> 'dateOfBirth', '')::date),
  height_cm = coalesce(height_cm, nullif(profile_json ->> 'heightCm', '')::integer),
  weight_kg = coalesce(weight_kg, nullif(profile_json ->> 'weightKg', '')::numeric),
  chronic_diseases = coalesce(chronic_diseases, array(select jsonb_array_elements_text(coalesce(profile_json -> 'chronicDiseases', '[]'::jsonb)))),
  infection_history = coalesce(infection_history, array(select jsonb_array_elements_text(coalesce(profile_json -> 'infectionHistory', '[]'::jsonb)))),
  allergies = coalesce(allergies, coalesce(profile_json -> 'allergies', '[]'::jsonb)),
  emergency_contact_email = coalesce(emergency_contact_email, nullif(profile_json ->> 'emergencyContactEmail', '')),
  updated_at = now();

update user_health_profiles
set
  chronic_diseases = coalesce(chronic_diseases, '{}'),
  infection_history = coalesce(infection_history, '{}'),
  allergies = coalesce(allergies, '[]'::jsonb);

-- Remove only malformed/legacy rows that still violate required health profile fields.
delete from user_health_profiles
where
  gender is null
  or blood_group is null
  or date_of_birth is null
  or height_cm is null
  or weight_kg is null
  or chronic_diseases is null
  or infection_history is null
  or allergies is null
  or emergency_contact_email is null;

-- Enforce required patient profile fields.
alter table user_health_profiles alter column gender set not null;
alter table user_health_profiles alter column blood_group set not null;
alter table user_health_profiles alter column date_of_birth set not null;
alter table user_health_profiles alter column height_cm set not null;
alter table user_health_profiles alter column weight_kg set not null;
alter table user_health_profiles alter column chronic_diseases set not null;
alter table user_health_profiles alter column infection_history set not null;
alter table user_health_profiles alter column allergies set not null;
alter table user_health_profiles alter column emergency_contact_email set not null;

alter table users enable row level security;
alter table medications enable row level security;
alter table logs enable row level security;
alter table notifications enable row level security;
alter table caretaker_patients enable row level security;
alter table caretakers enable row level security;

-- Drop obsolete columns from users table
alter table users drop column if exists gender;
alter table users drop column if exists gender_other;
alter table users drop column if exists blood_group;
alter table users drop column if exists age;
alter table users drop column if exists illness;
alter table users drop column if exists date_of_birth;
alter table users drop column if exists height_cm;
alter table users drop column if exists weight_kg;
alter table users drop column if exists chronic_diseases;
alter table users drop column if exists infection_history;
alter table users drop column if exists allergies;
alter table users drop column if exists emergency_contact_email;
alter table users drop column if exists profile_json;
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

drop policy if exists caretakers_all on caretakers;
create policy caretakers_all on caretakers for all using (true) with check (true);

drop policy if exists user_health_profiles_all on user_health_profiles;
create policy user_health_profiles_all on user_health_profiles for all using (true) with check (true);
