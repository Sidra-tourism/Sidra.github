-- Sidra Tourism ONLY. Apply to a new Sidra Supabase project, never TLI or a shared production database.
-- Additive tables; server side service role is the only data access path. No owner is silently seeded.
create table if not exists public.sidra_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now()
);
create table if not exists public.sidra_user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'customer' check (role in ('customer','support','ticketing','reservations','finance','admin','super_admin')),
  assigned_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
create table if not exists public.sidra_service_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  service text not null check (service in ('flights','hotels','cars','holidays','visas','insurance')),
  summary text not null check (char_length(summary) between 3 and 200),
  details text not null default '' check (char_length(details) <= 1200),
  status text not null default 'requested' check (status in ('requested','reviewing','quoted','awaiting_customer','closed')),
  created_at timestamptz not null default now()
);
create table if not exists public.sidra_audit_events (
  id bigint generated always as identity primary key,
  actor_user_id uuid not null references auth.users(id),
  action text not null,
  target_id uuid,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists sidra_requests_customer_created_idx on public.sidra_service_requests(user_id,created_at desc);
create index if not exists sidra_requests_status_created_idx on public.sidra_service_requests(status,created_at desc);
create index if not exists sidra_audit_created_idx on public.sidra_audit_events(created_at desc);
alter table public.sidra_profiles enable row level security;
alter table public.sidra_user_roles enable row level security;
alter table public.sidra_service_requests enable row level security;
alter table public.sidra_audit_events enable row level security;
revoke all on public.sidra_profiles, public.sidra_user_roles, public.sidra_service_requests, public.sidra_audit_events from anon, authenticated;
grant select,insert,update,delete on public.sidra_profiles, public.sidra_user_roles, public.sidra_service_requests, public.sidra_audit_events to service_role;
grant usage,select on sequence public.sidra_audit_events_id_seq to service_role;
create schema if not exists sidra_private;
revoke all on schema sidra_private from public, anon, authenticated;
create or replace function sidra_private.sidra_profile_on_signup()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.sidra_profiles (id,display_name)
  values (new.id, left(coalesce(new.raw_user_meta_data->>'full_name', ''), 100))
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke execute on function sidra_private.sidra_profile_on_signup() from public, anon, authenticated;
drop trigger if exists sidra_profile_signup on auth.users;
create trigger sidra_profile_signup after insert on auth.users for each row execute function sidra_private.sidra_profile_on_signup();
-- Existing users can be backfilled with this safe additive operation:
insert into public.sidra_profiles(id) select id from auth.users on conflict (id) do nothing;
-- Owner bootstrap is intentionally manual: after verifying exact Sidra Auth user UUID,
-- assign super_admin using a one-time audited administrative process; never by public signup.