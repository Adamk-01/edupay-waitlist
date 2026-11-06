-- EduPay waitlist schema.
-- Separate from the customer/admin app: no accounts, no wallets, no payments.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- signups
create table if not exists public.waitlist_signups (
  id                        uuid primary key default gen_random_uuid(),
  full_name                 text not null check (char_length(full_name) between 1 and 120),
  email                     text not null check (char_length(email) between 3 and 254),
  email_key                 text not null check (char_length(email_key) between 3 and 254),
  phone                     text check (phone is null or char_length(phone) <= 32),
  audience_type             text not null check (audience_type in ('student','parent_guardian','institution')),
  state                     text check (state is null or char_length(state) <= 80),
  school_name               text check (school_name is null or char_length(school_name) <= 160),
  education_level           text check (education_level is null or char_length(education_level) <= 60),
  institution_name          text check (institution_name is null or char_length(institution_name) <= 160),
  institution_type          text check (institution_type is null or char_length(institution_type) <= 60),
  contact_role              text check (contact_role is null or char_length(contact_role) <= 100),

  -- Waitlist consent is required and recorded separately from marketing consent.
  waitlist_consent          boolean not null,
  waitlist_notice_version   text not null check (char_length(waitlist_notice_version) between 1 and 40),
  waitlist_consent_at       timestamptz not null default now(),
  marketing_consent         boolean not null default false,
  marketing_consent_at      timestamptz,

  status                    text not null default 'pending_verification'
                            check (status in ('pending_verification','verified','removed')),
  verified_at               timestamptz,
  verification_sent_count   integer not null default 0,
  last_verification_sent_at timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  constraint waitlist_signups_consent_given check (waitlist_consent = true),
  constraint waitlist_signups_marketing_consent_at
    check ((marketing_consent = false) = (marketing_consent_at is null)),
  constraint waitlist_signups_verified_at
    check ((status = 'verified') = (verified_at is not null))
);

-- One row per email address (case-insensitive); duplicates rejected by the DB.
create unique index if not exists waitlist_signups_email_key_idx
  on public.waitlist_signups (email_key);
create index if not exists waitlist_signups_status_created_idx
  on public.waitlist_signups (status, created_at desc);

-- ------------------------------------------------------- verification tokens
-- Only the SHA-256 hash of a token is stored, so a database leak cannot be
-- replayed as a valid verification link.
create table if not exists public.waitlist_verification_tokens (
  id           uuid primary key default gen_random_uuid(),
  signup_id    uuid not null references public.waitlist_signups (id) on delete cascade,
  token_hash   text not null unique check (char_length(token_hash) = 64),
  expires_at   timestamptz not null,
  consumed_at  timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists waitlist_tokens_signup_idx
  on public.waitlist_verification_tokens (signup_id);
create index if not exists waitlist_tokens_expires_idx
  on public.waitlist_verification_tokens (expires_at);

-- ------------------------------------------------------------- abuse control
create table if not exists public.waitlist_request_log (
  id         bigserial primary key,
  bucket_key text not null,
  route      text not null,
  created_at timestamptz not null default now()
);

create index if not exists waitlist_request_log_lookup_idx
  on public.waitlist_request_log (bucket_key, route, created_at desc);

-- ------------------------------------------------------------ updated_at
create or replace function public.waitlist_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists waitlist_signups_set_updated_at on public.waitlist_signups;
create trigger waitlist_signups_set_updated_at
  before update on public.waitlist_signups
  for each row execute function public.waitlist_set_updated_at();

-- ------------------------------------------------------------------- RLS
-- Enabled with NO policies: anon and authenticated roles are denied every
-- operation, so waitlist data is only reachable by the service role inside
-- Edge Functions. Matches the posture of the rest of this project.
alter table public.waitlist_signups             enable row level security;
alter table public.waitlist_verification_tokens enable row level security;
alter table public.waitlist_request_log         enable row level security;

comment on table public.waitlist_signups is
  'Pre-launch EduPay waitlist registrations. Not a customer account, wallet or payment record.';
comment on table public.waitlist_verification_tokens is
  'SHA-256 hashes of email verification tokens. Raw tokens are never stored.';
