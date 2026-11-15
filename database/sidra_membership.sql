-- REVIEW ONLY — Sidra Tourism dedicated Supabase project; NEVER run against TLI or IK.
-- No existing tables dropped or altered. Customer data remains service-role-only until verified.
create schema if not exists sidra_private;
revoke all on schema sidra_private from PUBLIC, anon, authenticated;
create sequence if not exists sidra_private.sidra_member_number_seq as bigint;

create table if not exists public.sidra_members (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  customer_code text unique not null,
  first_name text not null check (char_length(first_name)<=80),
  middle_name text not null default '' check (char_length(middle_name)<=80),
  last_name text not null check (char_length(last_name)<=80),
  phone text not null default '' check (char_length(phone)<=25),
  identity_status text not null default 'incomplete' check(identity_status in ('incomplete','pending_review','verified','rejected')),
  created_at timestamptz not null default now()
);
create table if not exists public.sidra_member_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'customer' check(role in ('customer','support','operations','finance','admin','super_admin')),
  assigned_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
create table if not exists public.sidra_member_wallets (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null unique references auth.users(id) on delete cascade,
  wallet_code text unique not null,
  currency text not null default 'QAR' check(currency='QAR'),
  status text not null default 'inactive' check(status in ('inactive','active','suspended')),
  created_at timestamptz not null default now()
);
create table if not exists public.sidra_passengers (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  first_name text not null,
  middle_name text not null default '',
  last_name text not null,
  dob date not null,
  nationality text not null,
  citizenship text not null,
  relationship text not null check(relationship in ('self','spouse','child','parent','other')),
  passport_ciphertext text,
  passport_expiry date,
  spid_ciphertext text,
  address_ciphertext text,
  created_at timestamptz not null default now()
);
create index if not exists sidra_passengers_owner_idx on public.sidra_passengers(owner_user_id,created_at desc);
create table if not exists public.sidra_booking_records (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  booking_code text unique not null,
  service text not null check(service in ('flight','hotel','holiday','transfer')),
  status text not null default 'pending_review' check(status in ('pending_review','awaiting_payment','payment_authorized','ticketed','cancelled','refunded','failed')),
  origin text, destination text, departure_date date, return_date date,
  supplier_reference text,
  pnr text,
  ticket_numbers jsonb not null default '[]'::jsonb,
  price_currency text,
  total_minor bigint check(total_minor>=0),
  created_at timestamptz not null default now()
);
create index if not exists sidra_bookings_owner_created_idx on public.sidra_booking_records(owner_user_id,created_at desc);
create table if not exists public.sidra_points_ledger (
  id bigint generated always as identity primary key,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  points_delta integer not null check(points_delta<>0),
  reason text not null,
  booking_id uuid references public.sidra_booking_records(id),
  event_reference text unique not null,
  created_at timestamptz not null default now()
);
create table if not exists public.sidra_credit_ledger (
  id bigint generated always as identity primary key,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  credit_delta_minor bigint not null check(credit_delta_minor<>0),
  currency text not null default 'QAR' check(currency='QAR'),
  event_reference text unique not null,
  booking_id uuid references public.sidra_booking_records(id),
  reason text not null,
  created_at timestamptz not null default now()
);
create index if not exists sidra_points_owner_idx on public.sidra_points_ledger(owner_user_id,created_at desc);
create index if not exists sidra_credits_owner_idx on public.sidra_credit_ledger(owner_user_id,created_at desc);
create table if not exists public.sidra_admin_settings (
  settings_id smallint primary key default 1 check(settings_id=1),
  markup_basis_points integer not null default 0 check(markup_basis_points between 0 and 10000),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
insert into public.sidra_admin_settings(settings_id,markup_basis_points) values (1,0)
on conflict(settings_id) do nothing;
create table if not exists public.sidra_member_audit_events (
  id bigint generated always as identity primary key,
  actor_user_id uuid not null references auth.users(id),
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists public.sidra_document_manifest (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  passenger_id uuid references public.sidra_passengers(id),
  storage_key text unique not null,
  document_kind text not null check(document_kind in ('passport','national_id','profile_photo','visa','other')),
  upload_status text not null default 'pending_review' check(upload_status in ('pending_review','verified','rejected')),
  created_at timestamptz not null default now()
);
create index if not exists sidra_documents_owner_idx on public.sidra_document_manifest(owner_user_id,created_at desc);

-- No RLS policy grants browser read/write access. All reads require server JWT validation + owner scoping.
do $$ declare t text; begin
  foreach t in array array['sidra_members','sidra_member_roles','sidra_member_wallets','sidra_passengers','sidra_booking_records','sidra_points_ledger','sidra_credit_ledger','sidra_admin_settings','sidra_member_audit_events','sidra_document_manifest'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from PUBLIC,anon,authenticated',t);
    execute format('grant select,insert,update,delete on public.%I to service_role',t);
  end loop;
end $$;
grant usage,select on sequence public.sidra_points_ledger_id_seq,public.sidra_credit_ledger_id_seq,public.sidra_member_audit_events_id_seq to service_role;

-- Generates unique, sequence-based SID-QA-year-Nnnnnnn and member wallet IDs with no client input.
create or replace function sidra_private.sidra_membership_bootstrap()
returns trigger language plpgsql security definer set search_path = '' as $$
declare next_number bigint; current_year text; code text;
begin
  next_number := nextval('sidra_private.sidra_member_number_seq');
  current_year := to_char(now() at time zone 'UTC','YYYY');
  if next_number > 999999 then raise exception 'Sidra membership sequence exhausted'; end if;
  code := 'SID-QA-'||current_year||'-N'||lpad(next_number::text,6,'0');
  insert into public.sidra_members (auth_user_id,customer_code,first_name,middle_name,last_name,phone)
  values (new.id,code,
    left(coalesce(new.raw_user_meta_data->>'first_name',''),80),
    left(coalesce(new.raw_user_meta_data->>'middle_name',''),80),
    left(coalesce(new.raw_user_meta_data->>'last_name',''),80),
    left(coalesce(new.raw_user_meta_data->>'phone',''),25))
  on conflict(auth_user_id) do nothing;
  insert into public.sidra_member_roles(user_id,role) values(new.id,'customer') on conflict(user_id) do nothing;
  insert into public.sidra_member_wallets(owner_user_id,wallet_code)
  values(new.id,'SID-WLT-'||current_year||'-'||lpad(next_number::text,6,'0'))
  on conflict(owner_user_id) do nothing;
  return new;
end;
$$;
revoke all on function sidra_private.sidra_membership_bootstrap() from PUBLIC,anon,authenticated;
drop trigger if exists sidra_membership_signup on auth.users;
create trigger sidra_membership_signup after insert on auth.users
for each row execute function sidra_private.sidra_membership_bootstrap();
-- For already registered auth.users, perform reviewed backfill in a separate authorized admin migration.
-- Owner staff roles are manually granted only after Auth UUID and MFA verification.
-- Refund-credit entries and points are immutable business ledgers, NOT a payment wallet or bank balance.
-- Document bucket intentionally NOT created: must provision private storage, retention and scanning separately.

-- Atomic markup change and audit, callable by service_role only after server JWT+role verification.
create or replace function public.sidra_admin_set_markup(p_actor uuid,p_markup integer)
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  if p_markup is null or p_markup < 0 or p_markup > 10000 then raise exception 'Invalid markup'; end if;
  update public.sidra_admin_settings set markup_basis_points=p_markup,updated_by=p_actor,updated_at=now() where settings_id=1;
  if not found then raise exception 'Sidra commercial settings missing'; end if;
  insert into public.sidra_member_audit_events(actor_user_id,action,detail)
  values (p_actor,'markup_updated',jsonb_build_object('markup_basis_points',p_markup));
  return jsonb_build_object('markupBasisPoints',p_markup,'audited',true);
end;
$$;
revoke all on function public.sidra_admin_set_markup(uuid,integer) from PUBLIC, anon, authenticated;
grant execute on function public.sidra_admin_set_markup(uuid,integer) to service_role;