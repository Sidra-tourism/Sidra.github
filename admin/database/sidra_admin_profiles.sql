-- SIDRA TOURISM WEB ONLY (Supabase ref rcavyshsxnzodoipsbun).
-- Additive owner-only admin profile; no TLI projects, no credential seeding.
create table if not exists public.sidra_admin_profiles (
 user_id uuid primary key references auth.users(id) on delete restrict,
 display_name text not null default 'Imath Mohamed Marzook' check (length(display_name) between 1 and 100),
 role text not null default 'admin' check (role = 'admin'),
 must_change_password boolean not null default true,
 created_at timestamptz not null default now()
);
alter table public.sidra_admin_profiles enable row level security;
revoke all on public.sidra_admin_profiles from anon,authenticated;
grant select on public.sidra_admin_profiles to authenticated;
grant update (must_change_password) on public.sidra_admin_profiles to authenticated;
drop policy if exists sidra_admin_owner_read on public.sidra_admin_profiles;
create policy sidra_admin_owner_read on public.sidra_admin_profiles
  for select to authenticated
  using (user_id=(select auth.uid()));
drop policy if exists sidra_admin_owner_flag on public.sidra_admin_profiles;
create policy sidra_admin_owner_flag on public.sidra_admin_profiles
  for update to authenticated
  using (user_id=(select auth.uid()))
  with check (user_id=(select auth.uid()));
-- After verifying the created Supabase Auth user's exact UUID, manually seed ONE:
-- insert into public.sidra_admin_profiles (user_id,display_name,role,must_change_password)
-- values ('<VERIFIED-SIDRA-AUTH-UUID>','Imath Mohamed Marzook','admin',true)
-- on conflict (user_id) do nothing;
