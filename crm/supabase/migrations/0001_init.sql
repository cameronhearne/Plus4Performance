-- Plus4Performance CRM: initial schema
-- Single-operator internal tool. RLS is enabled on every table and scoped to
-- "any authenticated user" since there is exactly one login for the app.

create extension if not exists "pgcrypto";

create type contact_tier as enum ('high_ticket', 'standard');
create type contact_source as enum ('organic', 'referral', 'paid', 'dm', 'other');
create type contact_stage as enum (
  'lead',
  'contacted',
  'call_booked',
  'call_done',
  'proposal_sent',
  'won',
  'lost'
);
create type activity_type as enum ('note', 'email', 'call', 'stage_change');
create type email_send_status as enum ('pending', 'sent', 'failed');

-- ---------------------------------------------------------------------------
-- contacts
-- ---------------------------------------------------------------------------
create table contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  tier contact_tier not null default 'standard',
  source contact_source not null default 'organic',
  stage contact_stage not null default 'lead',
  value_gbp numeric(10, 2),
  lost_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index contacts_stage_idx on contacts (stage);
create index contacts_tier_idx on contacts (tier);
create index contacts_source_idx on contacts (source);
create index contacts_created_at_idx on contacts (created_at desc);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger contacts_set_updated_at
  before update on contacts
  for each row
  execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- activity_log
-- ---------------------------------------------------------------------------
create table activity_log (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts (id) on delete cascade,
  type activity_type not null,
  content text,
  created_at timestamptz not null default now()
);

create index activity_log_contact_id_idx on activity_log (contact_id, created_at desc);

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------
create table tasks (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts (id) on delete cascade,
  title text not null,
  due_date date,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

create index tasks_contact_id_idx on tasks (contact_id);
create index tasks_due_date_idx on tasks (due_date) where completed = false;

-- ---------------------------------------------------------------------------
-- email_sequences
-- ---------------------------------------------------------------------------
create table email_sequences (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tier contact_tier not null,
  trigger_stage contact_stage not null,
  delay_hours integer not null default 0,
  subject text not null,
  body_template text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index email_sequences_trigger_idx on email_sequences (trigger_stage, tier) where active = true;

create trigger email_sequences_set_updated_at
  before update on email_sequences
  for each row
  execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- email_sends
-- ---------------------------------------------------------------------------
create table email_sends (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts (id) on delete cascade,
  sequence_id uuid not null references email_sequences (id) on delete cascade,
  status email_send_status not null default 'pending',
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  provider_message_id text,
  created_at timestamptz not null default now()
);

create index email_sends_status_idx on email_sends (status, scheduled_for);
create index email_sends_contact_id_idx on email_sends (contact_id);

-- ---------------------------------------------------------------------------
-- RLS: single-operator app — any authenticated user has full access.
-- ---------------------------------------------------------------------------
alter table contacts enable row level security;
alter table activity_log enable row level security;
alter table tasks enable row level security;
alter table email_sequences enable row level security;
alter table email_sends enable row level security;

create policy "authenticated full access" on contacts
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "authenticated full access" on activity_log
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "authenticated full access" on tasks
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "authenticated full access" on email_sequences
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "authenticated full access" on email_sends
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Note: the public lead-capture API route (/api/leads/capture) uses the
-- service-role key server-side and therefore bypasses RLS entirely.
