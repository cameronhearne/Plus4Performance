-- Run this in the Supabase SQL editor after creating your project.
-- Enable UUID extension (already enabled by default on Supabase)
create extension if not exists "pgcrypto";

-- ─── PROFILES ────────────────────────────────────────────────────────────────
-- Mirrors auth.users; created automatically via trigger on signup.
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  first_name   text,
  last_name    text,
  created_at   timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── INTAKE SUBMISSIONS ───────────────────────────────────────────────────────
-- Raw intake form data stored as JSONB.
create table public.intake_submissions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  data       jsonb not null,
  created_at timestamptz default now()
);

alter table public.intake_submissions enable row level security;

create policy "Users can read own intake"
  on public.intake_submissions for select
  using (auth.uid() = user_id);

-- ─── SNAPSHOTS ───────────────────────────────────────────────────────────────
-- Lightweight AI output generated immediately after intake (before payment).
create table public.snapshots (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references public.profiles(id) on delete cascade,
  split_recommendation text,
  calorie_target       int,
  protein_target       int,
  goal_timeline        text,
  coach_summary        text,
  created_at           timestamptz default now()
);

alter table public.snapshots enable row level security;

create policy "Users can read own snapshot"
  on public.snapshots for select
  using (auth.uid() = user_id);

-- ─── PLANS ───────────────────────────────────────────────────────────────────
-- Full 12-week plan returned by Anthropic, stored as JSONB.
create table public.plans (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  plan_data    jsonb not null,
  is_active    boolean not null default false,  -- exactly one true per user_id at a time
  generated_at timestamptz default now()
);

alter table public.plans enable row level security;

create policy "Users can read own plans"
  on public.plans for select
  using (auth.uid() = user_id);

grant select, insert, update on public.plans to service_role;
grant select on public.plans to authenticated;

-- ─── SUBSCRIPTIONS ───────────────────────────────────────────────────────────
-- Mirrors Stripe subscription state. Updated by webhook on every event.
create table public.subscriptions (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.profiles(id) on delete cascade,
  stripe_customer_id    text unique,
  stripe_subscription_id text unique,
  stripe_price_id       text,
  status                text not null default 'inactive',
  -- status values: inactive | active | past_due | canceled | trialing
  current_period_end    timestamptz,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

alter table public.subscriptions enable row level security;

create policy "Users can read own subscription"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- Helper: is user's subscription active?
create or replace function public.is_subscribed(user_uuid uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.subscriptions
    where user_id = user_uuid
      and status = 'active'
      and (current_period_end is null or current_period_end > now())
  );
$$;

-- ─── AFFILIATES ──────────────────────────────────────────────────────────────
-- One row per affiliate partner. Created only by admins — no public signup.
create table public.affiliates (
  id               uuid        primary key default gen_random_uuid(),
  name             text        not null,
  email            text        not null unique,
  referral_code    text        not null unique,
  commission_type  text        not null default 'flat' check (commission_type in ('flat', 'percentage')),
  commission_value numeric(10,2) not null default 0,
  status           text        not null default 'active' check (status in ('active', 'inactive')),
  created_at       timestamptz default now()
);

alter table public.affiliates enable row level security;

-- Affiliate can read only their own row; matched by Supabase auth email.
create policy "Affiliates read own row"
  on public.affiliates for select
  to authenticated
  using (email = auth.email());

-- ─── REFERRALS ────────────────────────────────────────────────────────────────
-- One row per referred user. subscription_status is updated manually or later
-- via Rewardful webhook. commission_paid flips to true when admin marks it paid.
create table public.referrals (
  id                  uuid        primary key default gen_random_uuid(),
  affiliate_id        uuid        not null references public.affiliates(id) on delete cascade,
  referred_user_id    uuid        references public.profiles(id) on delete set null,
  signup_date         date        not null default current_date,
  subscription_status text        not null default 'pending' check (subscription_status in ('pending', 'active', 'cancelled', 'expired')),
  commission_owed     numeric(10,2) not null default 0,
  commission_paid     boolean     not null default false,
  created_at          timestamptz default now()
);

alter table public.referrals enable row level security;

-- Affiliates can only read their own referrals.
create policy "Affiliates read own referrals"
  on public.referrals for select
  to authenticated
  using (
    affiliate_id in (select id from public.affiliates where email = auth.email())
  );

-- Add referral tracking column to profiles (nullable — most users have no referrer).
alter table public.profiles add column if not exists referred_by       text;
alter table public.profiles add column if not exists username          text unique;
alter table public.profiles add column if not exists bio               text;
alter table public.profiles add column if not exists avatar_url        text;
alter table public.profiles add column if not exists walkout_song      text;
alter table public.profiles add column if not exists privacy_settings  jsonb not null default '{"bio":"friends","avatar":"friends","one_rep_max":"friends","weight":"friends"}'::jsonb;

grant select, insert, update on public.profiles to service_role;
grant select, insert, update on public.profiles to authenticated;

-- ─── CREATORS (WHITE-LABEL) ───────────────────────────────────────────────────
-- Each creator gets their own subdomain (e.g. gymreaper.plus4performance.com).
-- system_prompt replaces the default coaching bible when generating plans for
-- users who signed up under this creator's subdomain.
create table public.creators (
  id                   uuid         primary key default gen_random_uuid(),
  slug                 text         not null unique,          -- subdomain identifier
  name                 text         not null,
  logo_url             text,
  primary_color        text         not null default '#C0392B',
  secondary_color      text         not null default '#F5F3EE',
  system_prompt        text,                                  -- null → use default bible
  stripe_price_id      text,
  revenue_split_percent numeric(5,2) not null default 70,
  status               text         not null default 'active' check (status in ('active', 'inactive')),
  created_at           timestamptz  default now()
);

alter table public.creators enable row level security;

-- Public read for branding config and marketplace listing (no sensitive fields exposed
-- in the API — system_prompt and stripe_price_id are server-side only).
create policy "Anyone can read active creators"
  on public.creators for select
  using (status = 'active');

-- Link each user to the creator they signed up under (nullable — most users = main site).
alter table public.profiles add column if not exists creator_id uuid references public.creators(id) on delete set null;

-- ── TEST DATA (uncomment and run after creating the table) ─────────────────────
-- insert into public.creators (slug, name, primary_color, secondary_color, system_prompt, status)
-- values (
--   'testcreator',
--   'Test Creator',
--   '#2C3E50',
--   '#ECF0F1',
--   'You are a coach for Test Creator. Focus on functional fitness and mobility alongside strength. All plans should emphasise movement quality over raw numbers. Keep nutrition guidance simple and sustainable.',
--   'active'
-- );

-- ─── EXERCISE VIDEOS ─────────────────────────────────────────────────────────
-- Maps exercise library keys (snake_case IDs generated by AI, e.g. "barbell_squat")
-- to YouTube video IDs. One row per exercise; rows are added as footage is filmed.
-- No user_id — videos are global across all plans.
create table public.exercise_videos (
  exercise_key  text        primary key,  -- matches plan.exercise_library key
  youtube_id    text        not null,
  created_at    timestamptz default now()
);

alter table public.exercise_videos enable row level security;

-- Videos are not sensitive — any authenticated user may read them.
create policy "Authenticated users can read exercise videos"
  on public.exercise_videos for select
  to authenticated
  using (true);

-- ─── WEEKLY SCHEDULE OVERRIDES ───────────────────────────────────────────────
-- One row per user per week. week_start_date is always the Monday of the week.
-- schedule_data: {"0":"Push A","1":"Pull A","2":null,...} — 0=Mon, 6=Sun, null=rest.
-- Rows are ignored automatically after their week passes — no cleanup needed.
create table public.weekly_schedule_overrides (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references public.profiles(id) on delete cascade,
  week_start_date date        not null,
  schedule_data   jsonb       not null,
  created_at      timestamptz default now(),
  unique (user_id, week_start_date)
);

alter table public.weekly_schedule_overrides enable row level security;

create policy "Users can manage own schedule overrides"
  on public.weekly_schedule_overrides for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.weekly_schedule_overrides to service_role;
grant select, insert, update, delete on public.weekly_schedule_overrides to authenticated;

-- ─── FRIENDSHIPS ─────────────────────────────────────────────────────────────
-- Tracks friend requests and accepted friendships between users.
-- Either direction of the pair is valid; the unique index canonicalises ordering.
create table public.friendships (
  id           uuid        primary key default gen_random_uuid(),
  requester_id uuid        not null references public.profiles(id) on delete cascade,
  recipient_id uuid        not null references public.profiles(id) on delete cascade,
  status       text        not null default 'pending'
                           check (status in ('pending', 'accepted', 'declined')),
  created_at   timestamptz default now(),
  responded_at timestamptz,
  constraint no_self_friend check (requester_id != recipient_id)
);

-- Prevents duplicate active relationships in either direction.
-- Declined requests are excluded so a user can re-send after a decline.
create unique index friendships_pair_active_unique
  on public.friendships (
    least(requester_id::text, recipient_id::text),
    greatest(requester_id::text, recipient_id::text)
  )
  where status in ('pending', 'accepted');

alter table public.friendships enable row level security;

create policy "Users can see their own friendships"
  on public.friendships for select to authenticated
  using (auth.uid() = requester_id or auth.uid() = recipient_id);

create policy "Users can send friend requests"
  on public.friendships for insert to authenticated
  with check (auth.uid() = requester_id);

create policy "Recipients can respond to requests"
  on public.friendships for update to authenticated
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);

create policy "Either party can remove a friendship"
  on public.friendships for delete to authenticated
  using (auth.uid() = requester_id or auth.uid() = recipient_id);

grant select, insert, update on public.friendships to authenticated;
grant select, insert, update, delete on public.friendships to service_role;

-- ─── 1RM LEADERBOARD MIGRATIONS ──────────────────────────────────────────────
-- Run these after the initial one_rep_maxes table is in place.
alter table public.one_rep_maxes add column if not exists flagged_for_review boolean not null default false;
alter table public.one_rep_maxes add column if not exists flagged_reason text;
-- null = pending review, 'approved' = cleared for leaderboard, 'rejected' = permanent personal-only
alter table public.one_rep_maxes add column if not exists reviewer_action text;

-- ─── COACHING — Phase 1: data layer ──────────────────────────────────────────

-- 1. Coach role + client assignment on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_coach BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS coach_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Prevent authenticated users from setting their own is_coach or coach_id.
-- service_role bypasses RLS and retains full column access for server-side admin ops.
REVOKE UPDATE (is_coach, coach_id) ON public.profiles FROM authenticated;

-- 2. has_dashboard_access() — extends is_subscribed() to also grant access to coaching clients.
-- A user passes the gate when they have an active Stripe subscription OR a non-null coach_id.
CREATE OR REPLACE FUNCTION public.has_dashboard_access(user_uuid UUID)
RETURNS BOOLEAN LANGUAGE SQL SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = user_uuid
      AND status = 'active'
      AND (current_period_end IS NULL OR current_period_end > NOW())
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_uuid
      AND coach_id IS NOT NULL
  );
$$;

-- 3. coaching_checkins table
CREATE TABLE public.coaching_checkins (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  coach_id           UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  submitted_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  period_label       TEXT        NOT NULL,   -- e.g. "Week of 2026-06-30"
  responses          JSONB       NOT NULL DEFAULT '{}',
  photos_included    BOOLEAN     NOT NULL DEFAULT FALSE,
  coach_response     TEXT,
  coach_responded_at TIMESTAMPTZ,
  responded_by       UUID        REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.coaching_checkins ENABLE ROW LEVEL SECURITY;

-- Members: read and submit their own check-ins
CREATE POLICY "Members read own checkins"
  ON public.coaching_checkins FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Members submit checkins"
  ON public.coaching_checkins FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Coaches: read check-ins assigned to them; update only the response columns
CREATE POLICY "Coaches read client checkins"
  ON public.coaching_checkins FOR SELECT TO authenticated
  USING (auth.uid() = coach_id);

CREATE POLICY "Coaches respond to checkins"
  ON public.coaching_checkins FOR UPDATE TO authenticated
  USING (auth.uid() = coach_id);

-- Column-level: restrict which columns authenticated users may UPDATE.
-- Members cannot UPDATE at all (INSERT-only for their own rows).
-- Coaches may only update the three response fields — user_id, responses, etc. are immutable.
REVOKE UPDATE ON public.coaching_checkins FROM authenticated;
GRANT  UPDATE (coach_response, coach_responded_at, responded_by)
  ON public.coaching_checkins TO authenticated;

-- Critical: server-side admin queries run as service_role and must not be blocked by RLS/grants.
GRANT ALL ON public.coaching_checkins TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
